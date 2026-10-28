import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { request, requestDownload } from "../api";
import { OrderDetail } from "./ShopScreen";

vi.mock("../api", () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const order = { id: 1, reference: "O-REVIEW", status: "pending", payment_status: "proof_submitted", fulfillment: "pickup", origin: "storefront",
  customer_name: "Buyer", currency: "Ks", delivery_fee: 0, total: 1000, items: [], events: [],
  payment_method: { name: "Bank", type: "transfer", provider: "manual" }, payments: [{ id: 4, type: "proof", status: "pending" }] };
const props = { id: 1, refresh: 0, can: () => true, timezone: "Asia/Rangoon" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:proof"; } static revokeObjectURL() {} });
  request.mockImplementation(async (_path, options) => options ? {} : order);
  requestDownload.mockResolvedValue({ blob: new Blob(["proof"], { type: "image/png" }) });
});
afterEach(() => vi.unstubAllGlobals());

describe("Order payment review flow", () => {
  it("requires a cancellation reason in a separate modal", async () => {
    render(<OrderDetail {...props} run={(operation) => operation()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel order" }));
    const modal = screen.getByRole("dialog", { name: "Cancel order" });
    expect(modal).toHaveClass("mkpos-modal");
    const confirm = within(modal).getByRole("button", { name: "Cancel order" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(modal).getByLabelText("Reason (required for cancellation or failed delivery)"), { target: { value: "Customer requested cancellation" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/transition", { method: "POST", body: JSON.stringify({ status: "cancelled", reason: "Customer requested cancellation", return_confirmed: false }) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("processes the order directly from the app bar", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<><div id="workspace-app-bar-actions" /><OrderDetail {...props} run={(operation) => operation()} /></>);
    const action = await within(document.getElementById("workspace-app-bar-actions")).findByRole("button", { name: "Accept order" });
    fireEvent.click(action);
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/transition", { method: "POST", body: JSON.stringify({ status: "accepted", reason: "", return_confirmed: false }) }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens order history from the app bar in a dismissible drawer", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    request.mockResolvedValue({ ...order, events: [{ id: 9, event: "accepted", created_at: "2026-10-05 08:00:00", reason: "Ready to process" }] });
    render(<><div id="workspace-app-bar-actions" /><OrderDetail {...props} run={(operation) => operation()} /></>);
    const action = await within(document.getElementById("workspace-app-bar-actions")).findByRole("button", { name: "Order history" });
    expect(screen.queryByText("Ready to process")).not.toBeInTheDocument();
    fireEvent.click(action);
    const drawer = await screen.findByRole("dialog", { name: "Order history" });
    expect(drawer).toHaveClass("mkpos-filter-drawer");
    expect(within(drawer).getByText("accepted")).toBeInTheDocument();
    expect(within(drawer).getByText("Ready to process")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Order history" })).not.toBeInTheDocument();
    expect(action).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    ["pending", "proof_submitted", "Approve full payment"],
    ["expired", "proof_submitted", "Record payment for refund"],
    ["expired", "refund_pending", "Record full refund"],
  ])("allows %s/%s with a blank reference after verification", async (status, payment_status, action) => {
    request.mockImplementation(async (_path, options) => options ? {} : { ...order, status, payment_status });
    render(<OrderDetail {...props} run={(operation) => operation()} />);
    const button = await screen.findByRole("button", { name: action });
    expect(screen.getByLabelText("Payment / refund reference (optional)")).not.toBeRequired();
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: payment_status === "refund_pending"
      ? "I checked that the full refund was sent to the customer." : "I checked that the full payment was received by this shop." }));
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(true));
    const submitted = JSON.parse(request.mock.calls.find(([, options]) => options?.method === "POST")[1].body);
    expect(submitted).toMatchObject({ reference: "", verified: true, amount: 1000 });
  });
  it("loads proof independently while keeping review and order processing available", async () => {
    requestDownload.mockReturnValue(new Promise(() => {}));
    const run = vi.fn((operation) => operation());
    render(<OrderDetail {...props} run={run} />);
    await screen.findByText("Loading payment screenshot…");
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Accept order" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Approve full payment" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Payment / refund reference (optional)"), { target: { value: "Bank receipt 1" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "I checked that the full payment was received by this shop." }));
    fireEvent.click(screen.getByRole("button", { name: "Approve full payment" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/payments/confirm", expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(request.mock.calls.find(([path]) => path.endsWith("/confirm"))[1].body)).toMatchObject({ reference: "Bank receipt 1", verified: true, amount: 1000 });
  });

  it("keeps proof rejection separate from fulfillment reasons and recovers failed previews", async () => {
    requestDownload.mockRejectedValue(new Error("Screenshot unavailable"));
    const run = vi.fn((operation) => operation());
    render(<OrderDetail {...props} run={run} />);
    await screen.findByText("Screenshot unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    fireEvent.change(screen.getByLabelText("Reason (required for cancellation or failed delivery)"), { target: { value: "Fulfillment reason" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: "Cancel order" })).getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText("Customer-visible rejection reason")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reject proof" }));
    const dialog = screen.getByRole("dialog", { name: "Reject proof" });
    expect(within(dialog).getByRole("button", { name: "Reject proof" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Customer-visible rejection reason"), { target: { value: "Please send a readable receipt" } });
    fireEvent.submit(screen.getByLabelText("Customer-visible rejection reason").closest("form"));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/payments/reject", { method: "POST", body: JSON.stringify({ reason: "Please send a readable receipt" }) }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    requestDownload.mockResolvedValue({ blob: new Blob(["proof"], { type: "image/png" }) });
    fireEvent.click(screen.getByRole("button", { name: "Retry screenshot" }));
    await screen.findByAltText("Customer payment proof");
  });

  it("cancels rejection without submitting and keeps the reason when submission fails", async () => {
    request.mockImplementation(async (_path, options) => {
      if (options) throw new Error("Review could not be saved");
      return order;
    });
    const run = async (operation) => { try { await operation(); } catch { /* The page reports mutation errors. */ } };
    render(<OrderDetail {...props} run={run} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject proof" }));
    fireEvent.change(screen.getByLabelText("Customer-visible rejection reason"), { target: { value: "Unreadable receipt" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Reject proof" }));
    fireEvent.submit(screen.getByLabelText("Customer-visible rejection reason").closest("form"));
    await screen.findByText("Review could not be saved");
    expect(screen.getByLabelText("Customer-visible rejection reason")).toHaveValue("Unreadable receipt");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Reject proof" })).toBeEnabled();
  });

  it("offers stock-checked reopening and refund resolution for already-expired proof orders", async () => {
    request.mockResolvedValue({ ...order, status: "expired" });
    const run = vi.fn((operation) => operation());
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<OrderDetail {...props} run={run} />);
      fireEvent.click(await screen.findByRole("button", { name: "Reopen for payment review" }));
      await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/orders/1/reopen", { method: "POST" }));
      expect(screen.queryByRole("button", { name: "Approve full payment" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Record payment for refund" })).toBeDisabled();
    } finally { confirm.mockRestore(); }
  });
});
