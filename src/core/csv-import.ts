/**
 * Bank CSV import: format presets, parsing, and transaction conversion.
 */

import { Transaction, Posting, LedgerData } from "../types";
import { refreshErrors } from "./ledger";

/** Bank CSV format preset */
export interface BankFormatPreset {
  id: string;
  nameKey: string;
  encoding: "Shift_JIS" | "UTF-8";
  headerRows: number;
  columns: {
    date: number;
    description: number;
    withdrawal: number;
    deposit: number;
  };
  dateFormat: "yyyy/MM/dd" | "yyyy-MM-dd" | "yyyyMMdd";
  delimiter: string;
}

/** All available presets */
export const BANK_PRESETS: BankFormatPreset[] = [
  {
    id: "generic",
    nameKey: "import.preset.generic",
    encoding: "Shift_JIS",
    headerRows: 1,
    columns: { date: 0, description: 1, withdrawal: 2, deposit: 3 },
    dateFormat: "yyyy/MM/dd",
    delimiter: ",",
  },
  {
    id: "yucho",
    nameKey: "import.preset.yucho",
    encoding: "Shift_JIS",
    headerRows: 1,
    columns: { date: 0, description: 3, withdrawal: 4, deposit: 5 },
    dateFormat: "yyyy/MM/dd",
    delimiter: ",",
  },
  {
    id: "mufg",
    nameKey: "import.preset.mufg",
    encoding: "Shift_JIS",
    headerRows: 1,
    columns: { date: 0, description: 1, withdrawal: 2, deposit: 3 },
    dateFormat: "yyyy/MM/dd",
    delimiter: ",",
  },
  {
    id: "smbc",
    nameKey: "import.preset.smbc",
    encoding: "Shift_JIS",
    headerRows: 1,
    columns: { date: 0, description: 1, withdrawal: 2, deposit: 3 },
    dateFormat: "yyyy/MM/dd",
    delimiter: ",",
  },
  {
    id: "mizuho",
    nameKey: "import.preset.mizuho",
    encoding: "Shift_JIS",
    headerRows: 1,
    columns: { date: 0, description: 1, withdrawal: 2, deposit: 3 },
    dateFormat: "yyyy/MM/dd",
    delimiter: ",",
  },
  {
    id: "rakuten",
    nameKey: "import.preset.rakuten",
    encoding: "UTF-8",
    headerRows: 1,
    columns: { date: 0, description: 1, withdrawal: 2, deposit: 3 },
    dateFormat: "yyyyMMdd",
    delimiter: ",",
  },
  {
    id: "creditcard",
    nameKey: "import.preset.creditcard",
    encoding: "Shift_JIS",
    headerRows: 1,
    columns: { date: 0, description: 1, withdrawal: 2, deposit: -1 },
    dateFormat: "yyyy/MM/dd",
    delimiter: ",",
  },
];

/** Parsed CSV row */
export interface ParsedRow {
  rowIndex: number;
  date: string;
  description: string;
  withdrawal: number;
  deposit: number;
  counterpartAccount: string;
  enabled: boolean;
}

/** Decode file buffer with specified encoding */
export function decodeFile(buffer: ArrayBuffer, encoding: string): string {
  try {
    const label = encoding === "Shift_JIS" ? "shift_jis" : "utf-8";
    const decoder = new TextDecoder(label);
    return decoder.decode(buffer);
  } catch {
    // Fallback to UTF-8 if encoding unsupported
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(buffer);
  }
}

/** Parse a CSV line handling quoted fields */
export function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Clean amount string: remove yen sign, commas, full-width chars */
export function cleanAmount(raw: string): number {
  if (!raw || !raw.trim()) return 0;
  const cleaned = raw
    .replace(/[￥¥]/g, "")
    .replace(/,/g, "")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[^\d.\-]/g, "")
    .trim();
  return Number(cleaned) || 0;
}

/** Parse date string to ISO yyyy-MM-dd */
export function parseDate(raw: string, format: string): string {
  const s = raw.trim();
  if (format === "yyyy/MM/dd") {
    const m = s.match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  } else if (format === "yyyy-MM-dd") {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return s;
  } else if (format === "yyyyMMdd") {
    const m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  // Fallback: try yyyy年MM月dd日
  const jm = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jm) return `${jm[1]}-${jm[2].padStart(2, "0")}-${jm[3].padStart(2, "0")}`;
  return s;
}

/** Auto-detect bank format from header line */
export function detectFormat(headerLine: string): string | null {
  if (headerLine.includes("取扱日") && headerLine.includes("入金額")) return "yucho";
  if (headerLine.includes("お取引内容") && headerLine.includes("お引出し")) return "smbc";
  if (headerLine.includes("お支払い金額") && headerLine.includes("お預かり金額")) return "mufg";
  if (headerLine.includes("お支払金額") && headerLine.includes("お預り金額")) return "mizuho";
  if (headerLine.includes("ご利用日") && headerLine.includes("ご利用金額")) return "creditcard";
  return null;
}

/** Parse CSV text into rows */
export function parseCSV(text: string, preset: BankFormatPreset): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows: ParsedRow[] = [];
  const { columns, dateFormat, delimiter, headerRows } = preset;

  for (let i = headerRows; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i], delimiter);
    const date = parseDate(fields[columns.date] || "", dateFormat);
    const description = (fields[columns.description] || "").trim();
    const withdrawal = cleanAmount(fields[columns.withdrawal] || "");
    const deposit = columns.deposit >= 0 ? cleanAmount(fields[columns.deposit] || "") : 0;

    if (!date || (!withdrawal && !deposit)) continue;

    rows.push({
      rowIndex: i + 1,
      date,
      description: description || "-",
      withdrawal,
      deposit,
      counterpartAccount: withdrawal > 0 ? "Expenses:Miscellaneous" : "Income:OtherIncome",
      enabled: true,
    });
  }

  return rows;
}

/** Convert a parsed row to a transaction */
export function rowToTransaction(
  row: ParsedRow,
  bankAccount: string,
  currency: string
): Omit<Transaction, "id"> {
  const postings: Posting[] = row.withdrawal > 0
    ? [
        { account: row.counterpartAccount, amount: row.withdrawal, currency },
        { account: bankAccount, amount: -row.withdrawal, currency },
      ]
    : [
        { account: bankAccount, amount: row.deposit, currency },
        { account: row.counterpartAccount, amount: -row.deposit, currency },
      ];

  return {
    date: row.date,
    flag: "*",
    narration: row.description,
    postings,
    tags: ["csv-import"],
    links: [],
  };
}

/** Generate a unique id */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Import enabled rows as transactions into a ledger */
export function importRows(
  ledger: LedgerData,
  rows: ParsedRow[],
  bankAccount: string,
  currency: string
): LedgerData {
  const enabledRows = rows.filter((r) => r.enabled);
  const newTransactions = [...ledger.transactions];
  const newDirectives = [...ledger.directives];

  for (const row of enabledRows) {
    const txn = rowToTransaction(row, bankAccount, currency);
    const fullTxn: Transaction = { ...txn, id: uid() };
    newTransactions.push(fullTxn);
    newDirectives.push({ type: "transaction", data: fullTxn });
  }

  newTransactions.sort((a, b) => a.date.localeCompare(b.date));

  return refreshErrors({
    ...ledger,
    transactions: newTransactions,
    directives: newDirectives,
  });
}
