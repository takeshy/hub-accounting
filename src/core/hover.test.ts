import { describe, it, expect } from "vitest";
import {
  getAccountHoverInfo,
  getCurrencyHoverInfo,
  formatAccountHover,
  formatCurrencyHover,
} from "./hover";
import { createEmptyLedger } from "./ledger";

describe("getAccountHoverInfo", () => {
  it("returns hover info for existing account", () => {
    const ledger = createEmptyLedger("JPY");
    const info = getAccountHoverInfo(ledger, "Assets:Cash");
    expect(info).not.toBeNull();
    expect(info!.name).toBe("Assets:Cash");
    expect(info!.type).toBe("Assets");
    expect(info!.currencies).toContain("JPY");
  });

  it("returns null for non-existent account", () => {
    const ledger = createEmptyLedger("JPY");
    const info = getAccountHoverInfo(ledger, "Assets:NonExistent");
    expect(info).toBeNull();
  });

  it("includes close date when present", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.accounts[0].closeDate = "2024-12-31";
    const info = getAccountHoverInfo(ledger, ledger.accounts[0].name);
    expect(info!.closeDate).toBe("2024-12-31");
  });
});

describe("getCurrencyHoverInfo", () => {
  it("returns null when no commodity or price exists", () => {
    const ledger = createEmptyLedger("JPY");
    const info = getCurrencyHoverInfo(ledger, "BTC");
    expect(info).toBeNull();
  });

  it("returns info when commodity directive exists", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push({ type: "commodity", date: "2024-01-01", currency: "BTC" });
    const info = getCurrencyHoverInfo(ledger, "BTC");
    expect(info).not.toBeNull();
    expect(info!.currency).toBe("BTC");
  });

  it("returns latest price on or before context date", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push({
      type: "price",
      date: "2024-01-01",
      currency: "USD",
      amount: 140,
      targetCurrency: "JPY",
    });
    ledger.directives.push({
      type: "price",
      date: "2024-06-01",
      currency: "USD",
      amount: 155,
      targetCurrency: "JPY",
    });
    ledger.directives.push({
      type: "price",
      date: "2024-12-01",
      currency: "USD",
      amount: 160,
      targetCurrency: "JPY",
    });
    const info = getCurrencyHoverInfo(ledger, "USD", "2024-08-01");
    expect(info!.latestPrice).toBeDefined();
    expect(info!.latestPrice!.amount).toBe(155);
    expect(info!.latestPrice!.date).toBe("2024-06-01");
  });

  it("ignores prices after context date", () => {
    const ledger = createEmptyLedger("JPY");
    ledger.directives.push({ type: "commodity", date: "2024-01-01", currency: "USD" });
    ledger.directives.push({
      type: "price",
      date: "2025-01-01",
      currency: "USD",
      amount: 160,
      targetCurrency: "JPY",
    });
    const info = getCurrencyHoverInfo(ledger, "USD", "2024-12-31");
    expect(info).not.toBeNull();
    expect(info!.latestPrice).toBeUndefined();
  });
});

describe("formatAccountHover", () => {
  it("formats basic account info as tooltip text", () => {
    const info = {
      name: "Assets:Cash",
      type: "Assets",
      openDate: "2024-01-01",
      currencies: ["JPY"],
    };
    const md = formatAccountHover(info);
    expect(md).toContain("Assets:Cash");
    expect(md).not.toContain("**");
    expect(md).toContain("Assets");
    expect(md).toContain("2024-01-01");
    expect(md).toContain("JPY");
  });

  it("includes close date when present", () => {
    const info = {
      name: "Assets:Old",
      type: "Assets",
      openDate: "2024-01-01",
      closeDate: "2024-12-31",
      currencies: ["JPY"],
    };
    const md = formatAccountHover(info);
    expect(md).toContain("Closed");
    expect(md).toContain("2024-12-31");
  });
});

describe("formatCurrencyHover", () => {
  it("formats currency with price", () => {
    const info = {
      currency: "USD",
      latestPrice: {
        amount: 155,
        targetCurrency: "JPY",
        date: "2024-06-01",
      },
    };
    const md = formatCurrencyHover(info, "2024-08-01");
    expect(md).toContain("USD");
    expect(md).not.toContain("**");
    expect(md).toContain("155");
    expect(md).toContain("JPY");
    expect(md).toContain("2024-06-01");
  });

  it("formats currency without price", () => {
    const info = { currency: "BTC" };
    const md = formatCurrencyHover(info, "2024-08-01");
    expect(md).toContain("No price recorded");
  });
});
