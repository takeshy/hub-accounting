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

    // Transaction
    "txn.new": "New Transaction",
    "txn.payee": "Payee",
    "txn.narration": "Narration",
    "txn.flag.complete": "Complete",
    "txn.flag.incomplete": "Incomplete",
    "txn.postings": "Postings",
    "txn.addPosting": "Add Posting",
    "txn.balanced": "Balanced",
    "txn.unbalanced": "Unbalanced",

    // Reports
    "report.journal": "Journal",
    "report.balanceSheet": "Balance Sheet",
    "report.incomeStatement": "Income Statement",
    "report.trialBalance": "Trial Balance",
    "report.period": "Period",
    "report.total": "Total",
    "report.netIncome": "Net Income",

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
    "settings.title": "Settings",
    "reset": "Reset",

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

    // Transaction
    "txn.new": "新規取引",
    "txn.payee": "取引先",
    "txn.narration": "摘要",
    "txn.flag.complete": "確定",
    "txn.flag.incomplete": "未確定",
    "txn.postings": "仕訳",
    "txn.addPosting": "仕訳追加",
    "txn.balanced": "貸借一致",
    "txn.unbalanced": "貸借不一致",

    // Reports
    "report.journal": "仕訳帳",
    "report.balanceSheet": "貸借対照表",
    "report.incomeStatement": "損益計算書",
    "report.trialBalance": "試算表",
    "report.period": "期間",
    "report.total": "合計",
    "report.netIncome": "当期純利益",

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
    "settings.title": "設定",
    "reset": "リセット",

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
