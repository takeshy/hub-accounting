const translations: Record<string, Record<string, string>> = {
  en: {
    // General
    "plugin.name": "Accounting",
    "currency": "Currency",
    "date": "Date",
    "amount": "Amount",
    "account": "Account",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "close": "Close",
    "search": "Search",
    "filter": "Filter",
    "export": "Export",
    "import": "Import",

    // Account types
    "account.assets": "Assets",
    "account.liabilities": "Liabilities",
    "account.income": "Income",
    "account.expenses": "Expenses",
    "account.equity": "Equity",
    "account.assets.short": "ASS",
    "account.liabilities.short": "LIA",
    "account.income.short": "INC",
    "account.expenses.short": "EXP",
    "account.equity.short": "EQU",

    // Transaction
    "txn.new": "New Transaction",
    "txn.edit": "Edit Transaction",
    "txn.payee": "Payee",
    "txn.narration": "Narration",
    "txn.flag.complete": "Complete",
    "txn.flag.incomplete": "Incomplete",
    "txn.postings": "Postings",
    "txn.addPosting": "Add Posting",
    "txn.balanced": "Balanced",
    "txn.unbalanced": "Unbalanced",

    // Reports
    "report.dashboard": "Dashboard",
    "report.journal": "Journal",
    "report.balanceSheet": "Balance Sheet",
    "report.incomeStatement": "Income Statement",
    "report.trialBalance": "Trial Balance",
    "report.period": "Period",
    "report.total": "Total",
    "report.netIncome": "Net Income",

    // Dashboard
    "dashboard.netWorth": "Net Worth",
    "dashboard.incomeExpenses": "Income vs Expenses",
    "dashboard.netWorthTrend": "Net Worth Trend",
    "dashboard.expenseBreakdown": "Expense Breakdown",

    // Accounts
    "accounts.open": "Open Account",
    "accounts.close": "Close Account",
    "accounts.name": "Account Name",
    "accounts.type": "Account Type",
    "accounts.list": "Accounts",

    // File
    "file.new": "New Ledger",
    "file.open": "Open",
    "file.save": "Save",
    "file.export": "Export as Beancount",

    // Settings
    "settings.defaultCurrency": "Default Currency",
    "settings.dateFormat": "Date Format",
    "settings.decimalPlaces": "Decimal Places",

    // Table
    "table.debit": "Debit",
    "table.credit": "Credit",

    // Misc
    "filter.from": "From",
    "filter.to": "To",
    "txn.empty": "No transactions",
    "txn.showAllAccounts": "Show all accounts",
    "settings.title": "Settings",
    "settings.directory": "Directory",
    "settings.fiscalYearStart": "Fiscal Year Start Month",
    "reset": "Reset",
    "fiscal.year": "FY{0}",
    "fiscal.carryForward": "Year-End Close",
    "fiscal.carryForwardConfirm": "Close current year and create FY{0}?",
    "fiscal.switchYear": "Switch Year",

    // Tax categories
    "tax.category": "Tax Category",
    "tax.taxable_10": "Taxable (10%)",
    "tax.taxable_8": "Taxable (8%)",
    "tax.exempt": "Exempt",
    "tax.non_taxable": "Non-taxable",
    "tax.tax_free": "Tax-free",
    "tax.none": "None",

    // General & subsidiary ledger
    "report.generalLedger": "General Ledger",
    "report.subsidiaryLedger": "Subsidiary Ledger",
    "ledger.selectAccount": "Select account",
    "ledger.selectPayee": "Select payee",
    "ledger.counterpart": "Counterpart",
    "ledger.openingBalance": "Opening Balance",
    "ledger.closingBalance": "Closing Balance",
    "ledger.noPayees": "No payees found",
    "ledger.noEntries": "No entries",
    "ledger.balance": "Balance",

    // Consumption tax report
    "report.consumptionTax": "Consumption Tax",
    "tax.sales": "Sales",
    "tax.purchases": "Purchases",
    "tax.taxAmount": "Tax Amount",
    "tax.netAmount": "Net Amount",
    "tax.totalTax": "Total Tax",
    "tax.netPayable": "Net Tax Payable",
    "tax.rate10": "Standard Rate (10%)",
    "tax.rate8": "Reduced Rate (8%)",

    // Ledger template
    "template.default": "Default",
    "template.japan_sole_proprietor": "Japan - Sole Proprietor",
    "template.select": "Account Template",

    // freee
    "export.freeeCSV": "Export freee CSV",
    "export.googleSheets": "Export to Google Sheets",
    "export.exporting": "Exporting...",

    // CSV Import
    "import.csv": "Import Bank CSV",
    "import.selectFile": "Select CSV File",
    "import.bankAccount": "Bank Account",
    "import.format": "Format",
    "import.preview": "Preview",
    "import.confirm": "Import",
    "import.rowCount": "{0} of {1} rows selected",
    "import.noData": "No data found in file",
    "import.importSuccess": "Imported {0} transactions",
    "import.counterpart": "Counterpart",
    "import.withdrawal": "Withdrawal",
    "import.deposit": "Deposit",
    "import.selectAll": "Select All",
    "import.deselectAll": "Deselect All",
    "import.next": "Next",
    "import.back": "Back",
    "import.preset.generic": "Generic Bank",
    "import.preset.yucho": "Japan Post Bank",
    "import.preset.mufg": "MUFG Bank",
    "import.preset.smbc": "SMBC",
    "import.preset.mizuho": "Mizuho Bank",
    "import.preset.rakuten": "Rakuten Bank",
    "import.preset.creditcard": "Credit Card",

    // Japanese account display names
    "account.Assets:Cash": "Cash",
    "account.Assets:OrdinaryDeposit": "Ordinary Deposit",
    "account.Assets:AccountsReceivable": "Accounts Receivable",
    "account.Liabilities:AccountsPayable": "Accounts Payable",
    "account.Liabilities:AccruedLiabilities": "Accrued Liabilities",
    "account.Liabilities:WithholdingTax": "Withholding Tax",
    "account.Liabilities:Borrowings": "Borrowings",
    "account.Income:Sales": "Sales",
    "account.Income:OtherIncome": "Other Income",
    "account.Expenses:Purchases": "Purchases / COGS",
    "account.Expenses:Salary": "Salary / Wages",
    "account.Expenses:Outsourcing": "Outsourcing",
    "account.Expenses:Rent": "Rent",
    "account.Expenses:Utilities": "Utilities",
    "account.Expenses:Travel": "Travel / Transportation",
    "account.Expenses:Communication": "Communication",
    "account.Expenses:Advertising": "Advertising",
    "account.Expenses:Entertainment": "Entertainment",
    "account.Expenses:Insurance": "Insurance",
    "account.Expenses:Repairs": "Repairs",
    "account.Expenses:Supplies": "Supplies / Consumables",
    "account.Expenses:Depreciation": "Depreciation",
    "account.Expenses:Welfare": "Welfare / Benefits",
    "account.Expenses:PackagingShipping": "Packaging & Shipping",
    "account.Expenses:TaxesDues": "Taxes & Dues",
    "account.Expenses:Fees": "Professional Fees",
    "account.Expenses:Interest": "Interest",
    "account.Expenses:Miscellaneous": "Miscellaneous",
    "account.Equity:OpeningCapital": "Opening Capital",
    "account.Equity:OwnerDraw": "Owner Draw",
    "account.Equity:OwnerContribution": "Owner Contribution",
    "account.Equity:RetainedEarnings": "Retained Earnings",

    // Templates
    "template.title": "Templates",
    "template.new": "New Template",
    "template.edit": "Edit Template",
    "template.name": "Command Name",
    "template.description": "Description",
    "template.narration": "Default Narration",
    "template.payee": "Default Payee",
    "template.multiplier": "Multiplier",
    "template.auto": "Auto",
    "template.postings": "Postings",
    "template.addPosting": "Add Posting",
    "template.success": "Transaction registered from template.",
    "template.error.noLedger": "Error: No ledger loaded. Please open or create a ledger first.",
    "template.error.usage": "Usage:",
    "template.error.unbalanced": "Error: Template produced an unbalanced transaction.",
    "template.error.deleted": "Error: This template has been deleted or renamed.",
    "template.error.duplicateName": "A template with this command name already exists.",
    "template.error.minPostings": "At least 2 postings with accounts are required.",
    "template.error.multiAuto": "Only one auto-balance posting (empty multiplier) is allowed.",
    "template.resetDefaults": "Reset to Defaults",
    "template.resetConfirm": "Reset all templates to defaults? Custom templates will be lost.",

    // AI input
    "ai.button": "AI Input",
    "ai.title": "AI Input",
    "ai.hint": "Type / for templates, or describe a transaction in plain text. You can also attach a receipt or invoice (image/PDF).",
    "ai.placeholder": "/template or free text...",
    "ai.submit": "Generate",
    "ai.loading": "Analyzing...",
    "ai.noApi": "AI is not available.",
    "ai.attach.button": "Attach",
    "ai.attach.remove": "Remove",
    "ai.attach.tooLarge": '"{0}" exceeds the 20MB size limit.',
    "ai.attach.unsupported": '"{0}" is not supported (only image/PDF).',
    "ai.attach.defaultPrompt": "Extract the journal entry from the attached document.",
    "ai.error.noJson": "AI did not return a journal entry. Please add more detail or try again.",

    // Placeholder
    "accounts.nameExample": "Bank:Checking",

    // Errors
    "error.unbalanced": "Transaction is not balanced",
    "error.noAccount": "Account does not exist",
    "error.accountClosed": "Account is closed",
    "error.duplicateAccount": "Account already exists",
    "error.parseError": "Parse error",
  },
  ja: {
    // General
    "plugin.name": "会計",
    "currency": "通貨",
    "date": "日付",
    "amount": "金額",
    "account": "勘定科目",
    "save": "保存",
    "cancel": "キャンセル",
    "delete": "削除",
    "edit": "編集",
    "add": "追加",
    "close": "閉じる",
    "search": "検索",
    "filter": "フィルター",
    "export": "エクスポート",
    "import": "インポート",

    // Account types
    "account.assets": "資産",
    "account.liabilities": "負債",
    "account.income": "収益",
    "account.expenses": "費用",
    "account.equity": "純資産",
    "account.assets.short": "資産",
    "account.liabilities.short": "負債",
    "account.income.short": "収益",
    "account.expenses.short": "費用",
    "account.equity.short": "純資",

    // Transaction
    "txn.new": "新規取引",
    "txn.edit": "取引を編集",
    "txn.payee": "取引先",
    "txn.narration": "摘要",
    "txn.flag.complete": "確定",
    "txn.flag.incomplete": "未確定",
    "txn.postings": "仕訳",
    "txn.addPosting": "仕訳追加",
    "txn.balanced": "貸借一致",
    "txn.unbalanced": "貸借不一致",

    // Reports
    "report.dashboard": "ダッシュボード",
    "report.journal": "仕訳帳",
    "report.balanceSheet": "貸借対照表",
    "report.incomeStatement": "損益計算書",
    "report.trialBalance": "試算表",
    "report.period": "期間",
    "report.total": "合計",
    "report.netIncome": "当期純利益",

    // Dashboard
    "dashboard.netWorth": "純資産",
    "dashboard.incomeExpenses": "収益 vs 費用",
    "dashboard.netWorthTrend": "純資産推移",
    "dashboard.expenseBreakdown": "費用内訳",

    // Accounts
    "accounts.open": "勘定科目を開設",
    "accounts.close": "勘定科目を閉鎖",
    "accounts.name": "勘定科目名",
    "accounts.type": "勘定科目種別",
    "accounts.list": "勘定科目一覧",

    // File
    "file.new": "新規帳簿",
    "file.open": "開く",
    "file.save": "保存",
    "file.export": "Beancount形式でエクスポート",

    // Settings
    "settings.defaultCurrency": "デフォルト通貨",
    "settings.dateFormat": "日付形式",
    "settings.decimalPlaces": "小数点桁数",

    // Table
    "table.debit": "借方",
    "table.credit": "貸方",

    // Misc
    "filter.from": "開始",
    "filter.to": "終了",
    "txn.empty": "取引がありません",
    "txn.showAllAccounts": "全勘定科目を表示",
    "settings.title": "設定",
    "settings.directory": "保存ディレクトリ",
    "settings.fiscalYearStart": "年度開始月",
    "reset": "リセット",
    "fiscal.year": "{0}年度",
    "fiscal.carryForward": "年度繰越",
    "fiscal.carryForwardConfirm": "現在の年度を閉じて{0}年度を作成しますか？",
    "fiscal.switchYear": "年度切替",

    // Tax categories
    "tax.category": "税区分",
    "tax.taxable_10": "課税（10%）",
    "tax.taxable_8": "課税（8%軽減）",
    "tax.exempt": "非課税",
    "tax.non_taxable": "不課税",
    "tax.tax_free": "免税",
    "tax.none": "なし",

    // General & subsidiary ledger
    "report.generalLedger": "勘定元帳",
    "report.subsidiaryLedger": "補助元帳",
    "ledger.selectAccount": "勘定科目を選択",
    "ledger.selectPayee": "取引先を選択",
    "ledger.counterpart": "相手科目",
    "ledger.openingBalance": "前期繰越",
    "ledger.closingBalance": "次期繰越",
    "ledger.noPayees": "取引先がありません",
    "ledger.noEntries": "明細がありません",
    "ledger.balance": "残高",

    // Consumption tax report
    "report.consumptionTax": "消費税集計",
    "tax.sales": "売上",
    "tax.purchases": "仕入・経費",
    "tax.taxAmount": "消費税額",
    "tax.netAmount": "税抜金額",
    "tax.totalTax": "消費税合計",
    "tax.netPayable": "納付消費税額",
    "tax.rate10": "標準税率（10%）",
    "tax.rate8": "軽減税率（8%）",

    // Ledger template
    "template.default": "標準",
    "template.japan_sole_proprietor": "個人事業主（青色申告）",
    "template.select": "勘定科目テンプレート",

    // freee
    "export.freeeCSV": "freee CSV出力",
    "export.googleSheets": "Google Sheets出力",
    "export.exporting": "出力中...",

    // CSV Import
    "import.csv": "銀行CSV取込",
    "import.selectFile": "CSVファイルを選択",
    "import.bankAccount": "銀行口座",
    "import.format": "形式",
    "import.preview": "プレビュー",
    "import.confirm": "取込を実行",
    "import.rowCount": "{1}件中{0}件を取込",
    "import.noData": "データが見つかりません",
    "import.importSuccess": "{0}件の取引を取り込みました",
    "import.counterpart": "相手勘定",
    "import.withdrawal": "出金",
    "import.deposit": "入金",
    "import.selectAll": "すべて選択",
    "import.deselectAll": "すべて解除",
    "import.next": "次へ",
    "import.back": "戻る",
    "import.preset.generic": "一般的な銀行",
    "import.preset.yucho": "ゆうちょ銀行",
    "import.preset.mufg": "三菱UFJ銀行",
    "import.preset.smbc": "三井住友銀行",
    "import.preset.mizuho": "みずほ銀行",
    "import.preset.rakuten": "楽天銀行",
    "import.preset.creditcard": "クレジットカード明細",

    // Default template account names
    "account.Assets:Bank": "銀行預金",
    "account.Liabilities:CreditCard": "クレジットカード",
    "account.Income:Salary": "給与",
    "account.Expenses:Food": "食費",
    "account.Expenses:Transport": "交通費",
    "account.Expenses:Housing": "住居費",
    "account.Expenses:Other": "その他",
    "account.Equity:Opening-Balances": "開始残高",

    // Japanese template account names
    "account.Assets:Cash": "現金",
    "account.Assets:OrdinaryDeposit": "普通預金",
    "account.Assets:AccountsReceivable": "売掛金",
    "account.Liabilities:AccountsPayable": "買掛金",
    "account.Liabilities:AccruedLiabilities": "未払金",
    "account.Liabilities:WithholdingTax": "源泉所得税",
    "account.Liabilities:Borrowings": "借入金",
    "account.Income:Sales": "売上高",
    "account.Income:OtherIncome": "雑収入",
    "account.Expenses:Purchases": "仕入高",
    "account.Expenses:Salary": "給料賃金",
    "account.Expenses:Outsourcing": "外注工賃",
    "account.Expenses:Rent": "地代家賃",
    "account.Expenses:Utilities": "水道光熱費",
    "account.Expenses:Travel": "旅費交通費",
    "account.Expenses:Communication": "通信費",
    "account.Expenses:Advertising": "広告宣伝費",
    "account.Expenses:Entertainment": "接待交際費",
    "account.Expenses:Insurance": "損害保険料",
    "account.Expenses:Repairs": "修繕費",
    "account.Expenses:Supplies": "消耗品費",
    "account.Expenses:Depreciation": "減価償却費",
    "account.Expenses:Welfare": "福利厚生費",
    "account.Expenses:PackagingShipping": "荷造運賃",
    "account.Expenses:TaxesDues": "租税公課",
    "account.Expenses:Fees": "支払手数料",
    "account.Expenses:Interest": "利子割引料",
    "account.Expenses:Miscellaneous": "雑費",
    "account.Equity:OpeningCapital": "元入金",
    "account.Equity:OwnerDraw": "事業主貸",
    "account.Equity:OwnerContribution": "事業主借",
    "account.Equity:RetainedEarnings": "繰越利益",

    // Templates
    "template.title": "定型仕訳テンプレート",
    "template.new": "新規テンプレート",
    "template.edit": "テンプレート編集",
    "template.name": "コマンド名",
    "template.description": "説明",
    "template.narration": "摘要（デフォルト）",
    "template.payee": "取引先（デフォルト）",
    "template.multiplier": "倍率",
    "template.auto": "自動",
    "template.postings": "仕訳明細",
    "template.addPosting": "明細追加",
    "template.success": "テンプレートから仕訳を登録しました。",
    "template.error.noLedger": "エラー: 帳簿が読み込まれていません。帳簿を開くか新規作成してください。",
    "template.error.usage": "使い方:",
    "template.error.unbalanced": "エラー: テンプレートから生成した仕訳の貸借が一致しません。",
    "template.error.deleted": "エラー: このテンプレートは削除または名前変更されています。",
    "template.error.duplicateName": "同じコマンド名のテンプレートが既に存在します。",
    "template.error.minPostings": "勘定科目が設定された仕訳明細が2件以上必要です。",
    "template.error.multiAuto": "自動計算（倍率が空）の明細は1件までです。",
    "template.resetDefaults": "初期値に戻す",
    "template.resetConfirm": "すべてのテンプレートを初期値に戻しますか？カスタムテンプレートは失われます。",

    // AI input
    "ai.button": "AI入力",
    "ai.title": "AI入力",
    "ai.hint": "/ でテンプレート選択、または取引内容を自由に入力してください。領収書・請求書（画像/PDF）を添付することもできます。",
    "ai.placeholder": "/テンプレート名 または自由入力...",
    "ai.submit": "生成",
    "ai.loading": "解析中...",
    "ai.noApi": "AIが利用できません。",
    "ai.attach.button": "添付",
    "ai.attach.remove": "削除",
    "ai.attach.tooLarge": "「{0}」は20MBの上限を超えています。",
    "ai.attach.unsupported": "「{0}」は対応していません（画像/PDFのみ）。",
    "ai.attach.defaultPrompt": "添付された書類から仕訳を抽出してください。",
    "ai.error.noJson": "AIから仕訳が得られませんでした。入力内容を詳しくしてもう一度お試しください。",

    // Placeholder
    "accounts.nameExample": "普通預金",

    // Errors
    "error.unbalanced": "取引の貸借が一致しません",
    "error.noAccount": "勘定科目が存在しません",
    "error.accountClosed": "勘定科目は閉鎖されています",
    "error.duplicateAccount": "勘定科目は既に存在します",
    "error.parseError": "解析エラー",
  },
};

let currentLang = "en";

export function setLanguage(lang: string): void {
  currentLang = lang.startsWith("ja") ? "ja" : "en";
}

export function t(key: string): string {
  return translations[currentLang]?.[key] ?? translations["en"]?.[key] ?? key;
}

/** Translate with placeholder substitution: {0}, {1}, ... */
export function tFormat(key: string, ...args: (string | number)[]): string {
  let result = t(key);
  args.forEach((arg, i) => {
    result = result.replace(`{${i}}`, String(arg));
  });
  return result;
}

/** Translate an account name for display. Falls back to the raw name. */
export function tAccount(name: string): string {
  const translated = translations[currentLang]?.[`account.${name}`];
  if (translated) return translated;
  return name;
}
