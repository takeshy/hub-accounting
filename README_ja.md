# Accounting - 複式簿記

![Accounting](docs/accounting.png)

Beancount互換の複式簿記を行う [GemiHub](https://github.com/takeshy/gemihub)／GemiHub Desktop共通プラグインです。勘定科目の管理、取引の記録、財務レポートの生成をプレーンテキストで行えます。

[English](README.md)

## 機能

- **Beancount形式** — 標準的な `.beancount` / `.bean` / `.ledger` ファイルの読み書き
- **複式簿記** — すべての取引は貸借一致が必要（借方 = 貸方）
- **勘定科目体系** — 5つの種別による階層的な勘定科目: 資産、負債、収益、費用、純資産
- **取引入力** — サイドバーのフォームから取引先、摘要、複数仕訳、タグ、リンクを入力
- **自動残高計算** — 1つの仕訳の金額を空欄にすると自動で補完
- **財務レポート** — 貸借対照表、損益計算書、試算表
- **バリデーション** — 貸借不一致、未登録の勘定科目、閉鎖済み勘定科目の使用、残高アサーション
- **Beancountディレクティブ** — open、close、balance、pad、commodity、option
- **エクスポート** — Driveに `.beancount` ファイルとして保存
- **多言語UI** — 日本語・英語

## インストール

1. GemiHub の **Settings > Plugins**、またはGemiHub Desktop 0.8.1以降のPlugin managerを開く
2. `takeshy/hub-accounting` を入力
3. **Install** をクリック

両hostが同じGitHub Releaseを使用します。GemiHubは`main.js`を直接読み込み、GemiHub Desktopは`manifest.json`で宣言されたrepository管理の`patches/gemihub-desktop.patch`を適用します（GitHub Releaseではbasenameがasset名になります）。Desktopでは帳簿をactive projectへ保存し、レポート画面を2つ目のsidebar tabとして表示します。Google Sheets出力はhostが任意のSheets APIを提供する場合だけ利用できます。

## 使い方

1. GemiHub サイドバーで Accounting パネルを開く
2. **新規帳簿** をクリックしてデフォルト勘定科目付きの帳簿を作成、または既存の `.beancount` ファイルを開く
3. **勘定科目を開設** で勘定科目を追加 — 種別（資産、負債など）と名前を選択
4. **新規取引** で取引を記録 — 日付、取引先、摘要、2つ以上の仕訳を入力
5. メインビューでレポートを表示 — 仕訳帳、貸借対照表、損益計算書、試算表

## アーキテクチャ

```
src/
├── main.ts                  # プラグインエントリポイント
├── types.ts                 # 共有型定義 (Account, Transaction, LedgerData 等)
├── i18n.ts                  # 国際化 (en/ja)
├── store.ts                 # 状態管理
├── core/
│   ├── parser.ts            # Beancount形式パーサ
│   ├── formatter.ts         # Beancount形式フォーマッタ (LedgerData → テキスト)
│   ├── ledger.ts            # 帳簿エンジン（残高計算、バリデーション、CRUD）
│   └── reports.ts           # レポート生成（貸借対照表、損益計算書、試算表）
└── ui/
    ├── LedgerPanel.tsx      # サイドバーパネル（取引入力、勘定科目管理）
    ├── MainView.tsx         # メインビュー（レポート表示）
    └── SettingsPanel.tsx    # 設定ダイアログ
```

## 設定

| 設定 | デフォルト | 説明 |
|---|---|---|
| デフォルト通貨 | JPY | 新規仕訳に使用する通貨 |
| 日付形式 | yyyy-MM-dd | 日付の表示形式 |
| 小数点桁数 | 0 | 金額の小数点以下桁数 |

## 開発

```bash
npm install
npm run dev      # ウォッチモード
npm run build    # 型チェック + プロダクションビルド
npm test         # vitest 実行
```

### デプロイ

```bash
cp main.js styles.css manifest.json ~/pkg/gemihub/data/plugins/accounting/
```

## ライセンス

MIT
