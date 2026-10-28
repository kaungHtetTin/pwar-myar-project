import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopPaymentMethods } from "./ShopPaymentMethods";

vi.mock("../api", () => ({ request: vi.fn() }));
const method = { id: "bank", name: "Shop bank", type: "transfer", bank: "Bank", account_name: "Owner", account_no: "00123", is_active: true, provider: "manual" };

describe("Shop payment method management", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    vi.clearAllMocks();
    request.mockImplementation(async (_path, options) => options ? {} : { items: [method] });
  });
  it("edits receiving details while retaining the method identity", async () => {
    render(<ShopPaymentMethods run={(operation) => operation()} refresh={0} busy={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Shop bank" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit payment method" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Shop payment methods" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Account number / phone"), { target: { value: "00456" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment method" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/payment-methods/bank", expect.objectContaining({ method: "PUT" })));
    const submitted = JSON.parse(request.mock.calls.find(([, options]) => options?.method === "PUT")[1].body);
    expect(submitted).toMatchObject({ id: "bank", account_no: "00456", provider: "manual" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
  it("adds a method from the app bar and supports cancelling the modal", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    render(<><div id="workspace-app-bar-actions" /><ShopPaymentMethods run={(operation) => operation()} refresh={0} busy={false} /></>);
    await screen.findByText("Shop bank");
    const add = within(document.getElementById("workspace-app-bar-actions")).getByRole("button", { name: "Add payment method" });
    fireEvent.click(add);
    let modal = screen.getByRole("dialog", { name: "Add payment method" });
    fireEvent.click(within(modal).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    fireEvent.click(add);
    modal = screen.getByRole("dialog", { name: "Add payment method" });
    fireEvent.change(within(modal).getByLabelText("Method name"), { target: { value: "New wallet" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Save payment method" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/payment-methods", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the form and receiving details available after a failed save", async () => {
    request.mockImplementation(async (_path, options) => { if (options) throw new Error("Could not save method"); return { items: [method] }; });
    const run = async (operation) => { try { await operation(); } catch { /* Page displays mutation errors. */ } };
    render(<ShopPaymentMethods run={run} refresh={0} busy={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Shop bank" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Account number / phone"), { target: { value: "00456" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment method" }));
    await screen.findByText("Could not save method");
    expect(screen.getByLabelText("Account number / phone")).toHaveValue("00456");
    expect(screen.getByRole("button", { name: "Save payment method" })).toBeEnabled();
  });
  it("disables a method without deleting receiving details", async () => {
    render(<ShopPaymentMethods run={(operation) => operation()} refresh={0} busy={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Actions for Shop bank" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Disable" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/payment-methods/bank", expect.objectContaining({ method: "PUT" })));
    const submitted = JSON.parse(request.mock.calls.find(([, options]) => options?.method === "PUT")[1].body);
    expect(submitted).toMatchObject({ is_active: false, account_no: "00123" });
  });
});
