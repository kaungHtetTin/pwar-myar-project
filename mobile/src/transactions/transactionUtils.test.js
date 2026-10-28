import { describe, expect, it } from "vitest";
import {
  transactionPageFromPath,
  transactionPath,
  transactionSummary,
} from "./transactionUtils";

describe("mobile transaction helpers", () => {
  it("builds bounded endpoints for sales and payment history", () => {
    const filters = {
      q: "abc",
      start: "2026-01-01",
      end: "2026-01-31",
      payment_type: "credit",
      payment_method: "KPay",
      direction: "all",
    };
    expect(transactionPath("sales", filters, 20, 40)).toContain("/sales?");
    expect(transactionPath("sales", filters, 20, 40)).toContain("offset=40");
    expect(transactionPath("payments", filters, 20, 0)).toContain(
      "start=2026-01-01",
    );
    expect(transactionPath("supplierPayments", filters, 20, 0)).toContain(
      "/supplier-payments?",
    );
    expect(() => transactionPath("purchases", filters, 20, 0)).toThrow(
      "Unsupported transaction type",
    );
  });

  it("summarizes loaded rows and recognizes full-page edit routes", () => {
    expect(
      transactionSummary("sales", [
        { total: 1000, paid_amount: 700, credit_amount: 300 },
      ]),
    ).toMatchObject({ total: 1000, paid: 700, credit: 300 });
    expect(transactionPageFromPath("/transactions/payments/9/edit")).toEqual({
      kind: "edit",
      tab: "payments",
      id: 9,
    });
    expect(transactionPageFromPath("/sales/12")).toEqual({
      kind: "detail",
      tab: "sales",
      id: 12,
    });
    expect(transactionPageFromPath("/sales/12/edit")).toEqual({
      kind: "edit",
      tab: "sales",
      id: 12,
    });
    expect(
      transactionPageFromPath("/transactions/supplier-payments/5/edit"),
    ).toEqual({ kind: "edit", tab: "supplier-payments", id: 5 });
    expect(
      transactionSummary("supplierPayments", [
        { direction: "shop_to_supplier", amount: 700 },
        { direction: "supplier_to_shop", amount: 200 },
      ]),
    ).toMatchObject({ total: 900, outgoing: 700, incoming: 200 });
  });
});
