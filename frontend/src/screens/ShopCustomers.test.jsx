import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopCustomers } from "./ShopCustomers";
import { ShopScreen } from "./ShopScreen";

vi.mock("../api", () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const buyer = { id: "guest:abc", customer_key: "guest:abc", customer_name: "Shop buyer", phone: "091234", email: "buyer@example.com", account_type: "guest", purchase_count: 2, last_purchase_at: "2026-10-05 08:00:00" };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: { role: "staff" }, permissions: ["ecommerce_orders", "ecommerce_settings"], business: {}, subscription: { is_valid: true } };
    if (path === "/shop-admin/owner-location") return { submitted: true };
    if (path === "/shop-admin/report") return { states: [] };
    if (path.includes("/orders") && path.includes("/customers/")) return { items: [{ id: 12, reference: "O-PURCHASE", created_at: buyer.last_purchase_at, total: 1500, currency: "Ks" }], total: 1 };
    if (path.startsWith("/shop-admin/customers?")) return { items: [buyer], total: 62 };
    return { items: [], total: 0 };
  });
});
describe("Shop customers", () => {
  it("shows blocked and unblocked customer status in the table", async () => {
    request.mockResolvedValue({ items: [{ ...buyer, blocked: true }, { ...buyer, id: 'guest:other', customer_key: 'guest:other', customer_name: 'Other buyer', blocked: false }], total: 2 });
    render(<ShopCustomers refresh={0} timezone="Asia/Rangoon" onViewOrder={vi.fn()} />);
    const table = await screen.findByRole('table', { name: 'Shop customers' });
    expect(await within(table).findByRole('img', { name: 'Blocked' })).toBeInTheDocument();
    expect(within(table).getByRole('img', { name: 'Not blocked' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Block status' })).toBeInTheDocument();
  });
  it("adds a shop Customers menu distinct from the Contact settings menu", async () => {
    render(<ShopScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Customers", exact: true }));
    await screen.findByText("Shop buyer");
    expect(screen.getByRole("table", { name: "Shop customers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Contact", exact: true })).toBeInTheDocument();
    expect(request.mock.calls.every(([path]) => !path.startsWith("/customers"))).toBe(true);
  });
  it("preserves search and account filters across pages and resets after changing sort", async () => {
    render(<ShopCustomers refresh={0} timezone="Asia/Rangoon" onViewOrder={vi.fn()} />);
    await screen.findByText("1-25 of 62");
    fireEvent.change(screen.getByLabelText("Search shop customers"), { target: { value: "buyer" } });
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText("Customer account"), { target: { value: "guest" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filter" }));
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes("q=buyer&account=guest"))).toBe(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("26-50 of 62");
    expect(request).toHaveBeenLastCalledWith("/shop-admin/customers?q=buyer&account=guest&sort=recent&offset=25&limit=25");
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText("Sort customers"), { target: { value: "purchases" } });
    await waitFor(() => expect(request).toHaveBeenLastCalledWith("/shop-admin/customers?q=buyer&account=guest&sort=purchases&offset=0&limit=25"));
    fireEvent.change(screen.getByLabelText('Block status'), { target: { value: 'blocked' } });
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/shop-admin/customers?q=buyer&account=guest&sort=purchases&block_status=blocked&offset=0&limit=25'));
    fireEvent.change(screen.getByLabelText('Block status'), { target: { value: 'not_blocked' } });
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/shop-admin/customers?q=buyer&account=guest&sort=purchases&block_status=not_blocked&offset=0&limit=25'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(request).toHaveBeenLastCalledWith('/shop-admin/customers?q=&account=all&sort=recent&offset=0&limit=25'));
  });
  it("opens purchase history in a modal and links to the selected order", async () => {
    const onViewOrder = vi.fn();
    render(<ShopCustomers refresh={0} timezone="Asia/Rangoon" onViewOrder={onViewOrder} />);
    await screen.findByText("Shop buyer");
    fireEvent.click(screen.getByRole("button", { name: "Actions for Shop buyer" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "View purchases" }));
    const modal = screen.getByRole("dialog", { name: "Customer purchases" });
    expect(modal.closest("table")).toBeNull();
    fireEvent.click(await within(modal).findByRole("button", { name: "O-PURCHASE" }));
    expect(onViewOrder).toHaveBeenCalledWith(12);
    expect(screen.queryByRole("dialog", { name: "Customer purchases" })).not.toBeInTheDocument();
  });
});
