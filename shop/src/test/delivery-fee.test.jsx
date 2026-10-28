import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Totals } from "../main";

const quote = { items: [{ product_id: 1, name: "Rice", quantity: 1, unit_name: "Bag", line_total: 1000 }], delivery_fee: 500, currency: "Ks" };
afterEach(cleanup);
describe("Delivery payment totals", () => {
  it("clearly separates delivery-service payment from the amount due to the shop", () => {
    render(<Totals quote={{ ...quote, delivery_fee_recipient: "delivery_service", delivery_fee: 0, total: 1000 }} />);
    expect(screen.getByText("Delivery fee charged by shop")).toBeInTheDocument();
    expect(screen.getByText("Total payable to shop")).toBeInTheDocument();
    expect(screen.getByText("Delivery fee is paid separately to the delivery service and is excluded from the shop total.")).toBeInTheDocument();
  });
  it("keeps existing shop-collected delivery totals", () => {
    render(<Totals quote={{ ...quote, total: 1500 }} />);
    expect(screen.getByText("Delivery")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.queryByText("Total payable to shop")).not.toBeInTheDocument();
  });
});
