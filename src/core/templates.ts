/**
 * Journal entry templates: default templates and execution logic.
 * Each template is registered as a slash command in GemiHub.
 *
 * This module has no dependency on store.ts or React so it can be tested standalone.
 */

import { JournalTemplate, TemplatePosting, Transaction, Posting, LedgerData, AccountingSettings } from "../types";
import { addTransaction, autoBalance, isBalanced } from "./ledger";
import { t } from "../i18n";

/** Default templates for Japanese sole proprietor (個人事業主) */
export function getDefaultTemplates(): JournalTemplate[] {
  return [
    {
      id: "tpl_sales_receipt",
      name: "売上入金",
      description: "売上の入金（普通預金/売上高）",
      narration: "売上入金",
      postings: [
        { account: "Assets:OrdinaryDeposit", multiplier: 1, taxCategory: undefined },
        { account: "Income:Sales", multiplier: null, taxCategory: "taxable_10" },
      ],
    },
    {
      id: "tpl_purchases",
      name: "仕入支払",
      description: "仕入の支払い（仕入高/普通預金）",
      narration: "仕入支払",
      postings: [
        { account: "Expenses:Purchases", multiplier: 1, taxCategory: "taxable_10" },
        { account: "Assets:OrdinaryDeposit", multiplier: null },
      ],
    },
    {
      id: "tpl_salary",
      name: "給与支払",
      description: "給与の支払い（給料賃金/普通預金）",
      narration: "給与支払",
      postings: [
        { account: "Expenses:Salary", multiplier: 1 },
        { account: "Assets:OrdinaryDeposit", multiplier: null },
      ],
    },
    {
      id: "tpl_rent",
      name: "家賃支払",
      description: "家賃の支払い（地代家賃/普通預金）",
      narration: "家賃支払",
      postings: [
        { account: "Expenses:Rent", multiplier: 1, taxCategory: "non_taxable" },
        { account: "Assets:OrdinaryDeposit", multiplier: null },
      ],
    },
    {
      id: "tpl_transport",
      name: "交通費",
      description: "交通費の支払い（旅費交通費/現金）",
      narration: "交通費",
      postings: [
        { account: "Expenses:Travel", multiplier: 1, taxCategory: "taxable_10" },
        { account: "Assets:Cash", multiplier: null },
      ],
    },
    {
      id: "tpl_supplies",
      name: "消耗品購入",
      description: "消耗品の購入（消耗品費/現金）",
      narration: "消耗品購入",
      postings: [
        { account: "Expenses:Supplies", multiplier: 1, taxCategory: "taxable_10" },
        { account: "Assets:Cash", multiplier: null },
      ],
    },
    {
      id: "tpl_entertainment",
      name: "接待交際",
      description: "接待交際費の支払い（接待交際費/現金）",
      narration: "接待交際費",
      postings: [
        { account: "Expenses:Entertainment", multiplier: 1, taxCategory: "taxable_10" },
        { account: "Assets:Cash", multiplier: null },
      ],
    },
    {
      id: "tpl_communication",
      name: "通信費",
      description: "通信費の支払い（通信費/普通預金）",
      narration: "通信費支払",
      postings: [
        { account: "Expenses:Communication", multiplier: 1, taxCategory: "taxable_10" },
        { account: "Assets:OrdinaryDeposit", multiplier: null },
      ],
    },
    {
      id: "tpl_utilities",
      name: "水道光熱費",
      description: "水道光熱費の支払い（水道光熱費/普通預金）",
      narration: "水道光熱費支払",
      postings: [
        { account: "Expenses:Utilities", multiplier: 1, taxCategory: "taxable_10" },
        { account: "Assets:OrdinaryDeposit", multiplier: null },
      ],
    },
    {
      id: "tpl_owner_draw",
      name: "事業主貸",
      description: "事業主への支払い（事業主貸/普通預金）",
      narration: "事業主貸",
      postings: [
        { account: "Equity:OwnerDraw", multiplier: 1 },
        { account: "Assets:OrdinaryDeposit", multiplier: null },
      ],
    },
    {
      id: "tpl_owner_contribution",
      name: "事業主借",
      description: "事業主からの受入（普通預金/事業主借）",
      narration: "事業主借",
      postings: [
        { account: "Assets:OrdinaryDeposit", multiplier: 1 },
        { account: "Equity:OwnerContribution", multiplier: null },
      ],
    },
  ];
}

/** Parse execute args: "{amount} [{narration}]" */
export function parseArgs(args: string): { amount: number; narration?: string } | null {
  const trimmed = args.trim();
  if (!trimmed) return null;

  // Match number at the start, rest is optional narration
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)\s*(.*)?$/);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return null;

  return {
    amount,
    narration: match[2] || undefined,
  };
}

/** Build postings from template and user-supplied amount */
export function buildPostings(
  templatePostings: TemplatePosting[],
  amount: number,
  defaultCurrency: string,
  decimalPlaces: number,
): Posting[] {
  return templatePostings.map((tp) => ({
    account: tp.account,
    amount: tp.multiplier !== null
      ? Math.round(amount * tp.multiplier * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
      : null,
    currency: tp.currency || defaultCurrency,
    ...(tp.taxCategory ? { taxCategory: tp.taxCategory } : {}),
  }));
}

/** Format postings as a readable string for the response */
function formatResult(txn: Transaction): string {
  const lines = txn.postings.map((p) => {
    const amt = p.amount !== null ? `${p.amount.toLocaleString()} ${p.currency}` : "(auto)";
    return `  ${p.account}: ${amt}`;
  });
  return lines.join("\n");
}

export interface ExecuteContext {
  ledger: LedgerData;
  settings: AccountingSettings;
  onUpdate: (ledger: LedgerData) => Promise<void>;
}

/**
 * Execute a template slash command.
 * Pure logic: receives context explicitly so it can be tested without store/React.
 * Returns { result: string, ledger?: LedgerData }.
 */
export function applyTemplate(
  template: JournalTemplate,
  args: string,
  ctx: ExecuteContext,
): { result: string; ledger?: LedgerData } {
  const parsed = parseArgs(args);
  if (!parsed) {
    return { result: `${t("template.error.usage")}\n/${template.name} {${t("amount")}} [${t("txn.narration")}]` };
  }

  const { amount, narration } = parsed;
  const { settings, ledger } = ctx;

  const postings = buildPostings(
    template.postings,
    amount,
    settings.defaultCurrency,
    settings.decimalPlaces,
  );

  const today = new Date().toISOString().slice(0, 10);
  const txnData: Omit<Transaction, "id"> = {
    date: today,
    flag: "*",
    payee: template.payee,
    narration: narration || template.narration,
    postings,
    tags: ["template"],
    links: [],
  };

  // Auto-balance before validation
  const balanced = autoBalance({ ...txnData, id: "__tmp__" });
  if (!isBalanced(balanced)) {
    return { result: t("template.error.unbalanced") };
  }

  const newLedger = addTransaction(ledger, { ...txnData, postings: balanced.postings });
  const displayTxn = newLedger.transactions[newLedger.transactions.length - 1] || balanced;

  return {
    result: `${t("template.success")}\n${today} ${narration || template.narration}\n${formatResult(displayTxn)}`,
    ledger: newLedger,
  };
}
