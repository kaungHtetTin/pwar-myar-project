import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, requestDownload } from "../api";
import { ShopOrderRowActions } from "./ShopOrderRowActions";
import { ShopScreen } from "./ShopScreen";

vi.mock("../api", () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const base = { id: 1, reference: "O-ROW", status: "pending", payment_status: "proof_submitted", fulfillment: "pickup",
  customer_name: "Buyer", currency: "Ks", total: 1000, created_at: "2026-10-05 08:00:00", items: [], events: [],
  payment_method: { name: "Bank", type: "transfer", provider: "manual" }, payments: [{ id: 4, type: "proof", status: "pending" }] };
const props = { can: () => true, busy: false, run: (operation) => operation(), onView: vi.fn(), timezone: "Asia/Rangoon" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:proof"; } static revokeObjectURL() {} });
  request.mockImplementation(async (_path, options) => options ? {} : base);
  requestDownload.mockResolvedValue({ blob: new Blob(["proof"], { type: "image/png" }) });
});
afterEach(() => vi.unstubAllGlobals());
function choose(title) {
  fireEvent.click(screen.getByRole("button", { name: "Actions for O-ROW" }));
  fireEvent.click(screen.getByRole("menuitem", { name: title }));
}

describe("Order table action modals", () => {
  it("updates only the submitted row while preserving pagination and avoiding a list reload", async () => {
    request.mockImplementation(async (path, options) => {
      if (options) return { ...base, status: "accepted" };
      if (path === "/auth/me") return { user: { role: "staff" }, permissions: ["ecommerce_orders", "ecommerce_process", "ecommerce_payments", "ecommerce_refunds"], business: {}, subscription: { is_valid: true } };
      if (path === "/shop-admin/owner-location") return { submitted: true };
      if (path === "/shop-admin/report") return { states: [] };
      if (path.startsWith("/shop-admin/orders?")) return { items: [base, { ...base, id: 2, reference: "O-OTHER", customer_name: "Other buyer" }], total: 62 };
      return base;
    });
    const before = location.href;
    render(<ShopScreen />);
    await screen.findByText("O-ROW");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("26-50 of 62");
    const editedRow = screen.getByText("O-ROW").closest("tr");
    const otherRow = screen.getByText("O-OTHER").closest("tr");
    const listReads = request.mock.calls.filter(([path]) => path.startsWith("/shop-admin/orders?")).length;
    choose("Accept order");
    const modal = await screen.findByRole("dialog", { name: "Accept order" });
    await within(modal).findByText("Buyer");
    expect(request).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "POST" }));
    fireEvent.click(within(modal).getByRole("button", { name: "Accept order" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/transition", { method: "POST", body: JSON.stringify({ status: "accepted", reason: "", return_confirmed: false }) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(editedRow).getByText("accepted")).toBeInTheDocument();
    expect(within(otherRow).getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("O-ROW").closest("tr")).toBe(editedRow);
    expect(screen.getByText("O-OTHER").closest("tr")).toBe(otherRow);
    expect(screen.getByText("26-50 of 62")).toBeInTheDocument();
    expect(request.mock.calls.filter(([path]) => path.startsWith("/shop-admin/orders?"))).toHaveLength(listReads);
    fireEvent.click(screen.getByRole("button", { name: "Actions for O-ROW" }));
    expect(screen.getByRole("menuitem", { name: "Start packing" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Accept order" })).not.toBeInTheDocument();
    expect(location.href).toBe(before);
  });

  it("requires a reason and returned goods before cancelling an awaiting-return order", async () => {
    const order = { ...base, status: "return_pending", fulfillment: "delivery", payment_status: "paid" };
    request.mockImplementation(async (_path, options) => options ? {} : order);
    render(<ShopOrderRowActions {...props} order={order} />);
    choose("Cancel order");
    const modal = screen.getByRole("dialog", { name: "Cancel order" });
    const submit = within(modal).getByRole("button", { name: "Cancel order" });
    fireEvent.change(await within(modal).findByLabelText("Reason (required for cancellation or failed delivery)"), { target: { value: "Returned by courier" } });
    expect(submit).toBeDisabled();
    fireEvent.click(within(modal).getByLabelText("Goods physically returned"));
    fireEvent.click(submit);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/transition", { method: "POST", body: JSON.stringify({ status: "cancelled", reason: "Returned by courier", return_confirmed: true }) }));
  });

  it.each([
    ["accepted", "pickup", "Start packing", "packing"],
    ["packing", "pickup", "Ready for pickup", "ready_for_pickup"],
    ["packing", "delivery", "Dispatch order", "dispatched"],
    ["dispatched", "delivery", "Complete order", "completed"],
    ["dispatched", "delivery", "Record failed delivery", "return_pending"],
  ])("submits %s/%s through the matching action modal", async (status, fulfillment, title, next) => {
    const order = { ...base, status, fulfillment, payment_status: "paid" };
    request.mockImplementation(async (_path, options) => options ? {} : order);
    render(<ShopOrderRowActions {...props} order={order} />);
    choose(title);
    const modal = screen.getByRole("dialog", { name: title });
    await within(modal).findByText("Buyer");
    if (next === "return_pending") fireEvent.change(within(modal).getByLabelText("Reason (required for cancellation or failed delivery)"), { target: { value: "Recipient unavailable" } });
    fireEvent.click(within(modal).getByRole("button", { name: title }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/transition", { method: "POST", body: JSON.stringify({ status: next, reason: next === "return_pending" ? "Recipient unavailable" : "", return_confirmed: false }) }));
  });

  it.each([
    ["pending", "proof_submitted", "Approve full payment", "confirm"],
    ["cancelled", "proof_submitted", "Record payment for refund", "confirm"],
    ["cancelled", "refund_pending", "Record full refund", "refund"],
  ])("verifies %s/%s from its modal using the latest total and an optional reference", async (status, payment_status, title, endpoint) => {
    const order = { ...base, status, payment_status };
    request.mockImplementation(async (_path, options) => options ? {} : { ...order, total: 2000 });
    requestDownload.mockReturnValue(new Promise(() => {}));
    render(<ShopOrderRowActions {...props} order={order} />);
    choose(title);
    const modal = screen.getByRole("dialog", { name: title });
    const submit = within(modal).getByRole("button", { name: title });
    expect(await within(modal).findByLabelText("Payment / refund reference (optional)")).not.toBeRequired();
    expect(submit).toBeDisabled();
    fireEvent.click(within(modal).getByLabelText(endpoint === "refund" ? "I checked that the full refund was sent to the customer." : "I checked that the full payment was received by this shop."));
    fireEvent.click(submit);
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/shop-admin/orders/1/payments/${endpoint}`, { method: "POST", body: JSON.stringify({ amount: 2000, reference: "", verified: true, review_note: "" }) }));
  });

  it("keeps a failed rejection form open for correction and retry", async () => {
    const onSaved = vi.fn();
    request.mockImplementation(async (_path, options) => { if (options) throw new Error("Review failed"); return base; });
    render(<ShopOrderRowActions {...props} order={base} onSaved={onSaved} />);
    choose("Reject proof");
    const modal = screen.getByRole("dialog", { name: "Reject proof" });
    const submit = within(modal).getByRole("button", { name: "Reject proof" });
    expect(submit).toHaveClass("danger-button");
    fireEvent.change(await within(modal).findByLabelText("Customer-visible rejection reason"), { target: { value: "Payment not received" } });
    fireEvent.click(submit);
    await within(modal).findByText("Review failed");
    expect(submit).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/payments/reject", { method: "POST", body: JSON.stringify({ reason: "Payment not received" }) });
  });

  it("restricts the menu by permissions, fulfillment, provider and payment state", () => {
    const view = render(<ShopOrderRowActions {...props} order={{ ...base, status: "packing", fulfillment: "delivery", payment_method: { provider: "gateway" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions for O-ROW" }));
    expect(screen.getByRole("menuitem", { name: "Dispatch order" })).toBeEnabled();
    expect(screen.queryByRole("menuitem", { name: "Ready for pickup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Approve full payment" })).not.toBeInTheDocument();
    view.rerender(<ShopOrderRowActions {...props} order={{ ...base, status: "ready_for_pickup" }} />);
    expect(screen.getByRole("menuitem", { name: "Complete order" })).toBeDisabled();
    view.rerender(<ShopOrderRowActions {...props} order={base} can={() => false} />);
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([" View order", "Order history"]);
  });

  it("blocks an action that became unavailable since the table was loaded", async () => {
    request.mockResolvedValue({ ...base, status: "cancelled" });
    render(<ShopOrderRowActions {...props} order={base} />);
    choose("Accept order");
    const modal = screen.getByRole("dialog", { name: "Accept order" });
    await within(modal).findByText(/This action is no longer available/);
    expect(within(modal).getByRole("button", { name: "Accept order" })).toBeDisabled();
  });

  it("shows history and reopens eligible expired orders in separate modals", async () => {
    const order = { ...base, status: "expired", events: [{ id: 2, event: "proof_submitted", created_at: "2026-10-05 08:00:00", reason: "Customer uploaded proof" }] };
    request.mockImplementation(async (_path, options) => options ? {} : order);
    render(<div className="module-view"><table><tbody><tr><td className="table-actions-cell"><ShopOrderRowActions {...props} order={order} /></td></tr></tbody></table></div>);
    choose("Order history");
    const history = screen.getByRole("dialog", { name: "Order history" });
    expect(history.closest("table")).toBeNull();
    expect(history.parentElement.parentElement).toBe(document.body);
    await within(history).findByText("Customer uploaded proof");
    fireEvent.click(within(history).getByRole("button", { name: "Close", exact: true }));
    choose("Reopen for payment review");
    const modal = screen.getByRole("dialog", { name: "Reopen for payment review" });
    await within(modal).findByText(/Available stock will be checked/);
    fireEvent.click(within(modal).getByRole("button", { name: "Reopen for payment review" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/reopen", { method: "POST" }));
  });
});

it('refreshes a live action on another-device change without clearing the entered reason', async () => {
  let current = base;
  request.mockImplementation(async () => current);
  render(<ShopOrderRowActions {...props} order={base} />);
  choose('Cancel order');
  const modal = await screen.findByRole('dialog', { name: 'Cancel order' });
  const reason = await within(modal).findByLabelText(/Reason \(required/);
  fireEvent.change(reason, { target: { value: 'Buyer requested cancellation' } });
  current = { ...base, status: 'completed', payment_status: 'paid' };
  fireEvent(window, new CustomEvent('mkpos:shop-order-changed', { detail: { orderIds: [1] } }));
  await within(modal).findByText(/This action is no longer available/);
  expect(reason).toHaveValue('Buyer requested cancellation');
  expect(within(modal).getByRole('button', { name: 'Cancel order' })).toBeDisabled();
});
