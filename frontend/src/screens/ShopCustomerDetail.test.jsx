import React, { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request } from "../api";
import { ShopCustomerDetail } from "./ShopCustomerDetail";
import { ShopScreen } from "./ShopScreen";

vi.mock("../api", () => ({ request: vi.fn(), requestDownload: vi.fn() }));
const key = "guest:abc";
const customer = { customer_key: key, customer_name: "Shop buyer", phone: "091234", email: "buyer@example.com", address: "Yangon", account_type: "guest" };
const report = { total_orders: 4, completed_orders: 2, active_orders: 1, cancelled_orders: 1, expired_orders: 0, first_purchase_at: "2026-10-01 08:00:00", last_purchase_at: "2026-10-02 08:00:00",
  currencies: [{ currency: "Ks", completed_spend: 3000, average_purchase: 3000, refunded: 0, refund_pending: 1000 }, { currency: "USD", completed_spend: 5, average_purchase: 5, refunded: 0, refund_pending: 0 }] };
const order = { id: 12, reference: "O-HISTORY", created_at: "2026-10-03 08:00:00", total: 1500, currency: "Ks", status: "accepted", payment_status: "unpaid", fulfillment: "pickup" };
beforeEach(() => {
  request.mockReset();
  history.replaceState(null, "", "/");
  request.mockImplementation(async (path) => {
    if (path === "/auth/me") return { user: { role: "staff" }, permissions: ["ecommerce_orders"], business: {}, subscription: { is_valid: true } };
    if (path === "/shop-admin/owner-location") return { submitted: true };
    if (path === "/shop-admin/report") return { states: [] };
    if (path.startsWith("/shop-admin/customers?")) return { items: [{ ...customer, id: key, purchase_count: 2, last_purchase_at: report.last_purchase_at }], total: 1 };
    if (path.includes("/history?")) return { items: [order], total: 62 };
    if (path.startsWith("/shop-admin/customers/")) return { customer, report };
    if (path === "/shop-admin/orders/12") return { ...order, customer_name: customer.customer_name, payment_method: { name: "Cash", provider: "manual" }, payments: [], items: [], events: [], delivery_fee: 0 };
    return { items: [], total: 0 };
  });
});
afterEach(() => history.replaceState(null, "", "/"));
describe("Shop customer detail", () => {
  it("retains the floating platform customer chat draft when returning from order detail", async () => {
    window.scrollTo = vi.fn();
    history.replaceState(null, '', '/?shopCustomer=account%3A9');
    const original = request.getMockImplementation();
    request.mockImplementation(async (path, options) => {
      if (path === '/auth/me') return { ...(await original(path, options)), permissions: ['ecommerce_orders', 'ecommerce_process'] };
      if (path === '/shop-admin/chat/config') return { enabled: true, realtime_enabled: false };
      if (path === '/shop-admin/customers/account%3A9/chat') return { thread: { uuid: 'platform-thread' } };
      if (path.includes('/platform-thread/messages')) return { items: [], thread: {}, has_more: false };
      if (path === '/shop-admin/customers/account%3A9') return { customer: { ...customer, account_type: 'account' }, report };
      return original(path, options);
    });
    function Workspace() {
      const [back, setBack] = useState(null);
      return <div className="module-view">{back && <button onClick={back.onClick}>{back.label}</button>}<ShopScreen onDetailChange={setBack} /></div>;
    }
    render(<Workspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open chat with Shop buyer' }));
    const draft = await screen.findByRole('textbox', { name: 'Message' });
    fireEvent.change(draft, { target: { value: 'Keep this customer reply' } });
    const chatReads = request.mock.calls.filter(([path]) => path.includes('/platform-thread/messages')).length;
    fireEvent.click(await screen.findByRole('button', { name: 'O-HISTORY' }));
    await screen.findByRole('button', { name: 'Back to customer' });
    expect(draft).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to customer' }));
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Keep this customer reply');
    expect(request.mock.calls.filter(([path]) => path.includes('/platform-thread/messages'))).toHaveLength(chatReads);
    expect(request.mock.calls.filter(([path]) => path.endsWith('/account%3A9/chat'))).toHaveLength(1);
  });
  it("does not offer customer chat for guests even with chat permission", async () => {
    render(<ShopCustomerDetail customerKey={key} refresh={0} timezone="Asia/Rangoon" onViewOrder={vi.fn()} canChat />);
    await screen.findByRole('heading', { name: 'Shop buyer' });
    expect(screen.queryByRole('complementary', { name: /Chat with/ })).not.toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path.includes('/chat'))).toBe(false);
  });
  it("returns from customer and order detail to the actual chat source with its draft and loaded history retained", async () => {
    window.scrollTo = vi.fn();
    const original = request.getMockImplementation();
    const thread = { uuid: 'demo-thread', customer_key: key, customer_name: 'Chat buyer', owner_read_id: 0, customer_read_id: 0 };
    request.mockImplementation(async (path, options) => {
      if (path === '/auth/me') return { ...(await original(path, options)), permissions: ['ecommerce_orders', 'ecommerce_process'] };
      if (path === '/shop-admin/chat/config') return { enabled: true, realtime_enabled: false, channel: 'private-shop.chat.business.1' };
      if (path.startsWith('/shop-admin/chat?')) return { items: [thread], total: 1, next_cursor: null };
      if (path.startsWith('/shop-admin/chat/demo-thread/messages')) return { items: [], thread, has_more: false };
      return original(path, options);
    });
    function Workspace() {
      const [back, setBack] = useState(null);
      return <div className="module-view">{back && <button onClick={back.onClick}>{back.label}</button>}<ShopScreen onDetailChange={setBack} /></div>;
    }
    render(<Workspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chat' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chat buyer' }));
    const draft = await screen.findByRole('textbox', { name: 'Message' });
    fireEvent.change(draft, { target: { value: 'Keep this unsent reply' } });
    const chatReads = request.mock.calls.filter(([path]) => path.includes('/demo-thread/messages')).length;
    fireEvent.click(screen.getByRole('button', { name: 'View customer Chat buyer' }));
    const historySearch = await screen.findByRole('textbox', { name: 'Search customer order history' });
    fireEvent.change(historySearch, { target: { value: 'O-HISTORY' } });
    await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('/history?') && path.includes('O-HISTORY'))).toBe(true));
    const historyReads = request.mock.calls.filter(([path]) => path.includes('/history?')).length;
    fireEvent.click(screen.getByRole('button', { name: 'O-HISTORY' }));
    await screen.findByRole('button', { name: 'Order history' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to customer' }));
    await waitFor(() => expect(historySearch).toBeVisible());
    expect(historySearch).toHaveValue('O-HISTORY');
    expect(request.mock.calls.filter(([path]) => path.includes('/history?'))).toHaveLength(historyReads);
    fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
    await waitFor(() => expect(draft).toBeVisible());
    expect(draft).toHaveValue('Keep this unsent reply');
    expect(request.mock.calls.filter(([path]) => path.includes('/demo-thread/messages'))).toHaveLength(chatReads);
  });
  it("opens customer detail from the customer name in the orders table", async () => {
    const original = request.getMockImplementation();
    request.mockImplementation((path, options) => path.startsWith('/shop-admin/orders?')
      ? Promise.resolve({ items: [{ ...order, customer_name: customer.customer_name, customer_key: key, payment_method: { provider: 'manual' } }], total: 1 }) : original(path, options));
    render(<ShopScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Shop buyer' }));
    await screen.findByRole('heading', { name: 'Shop buyer' });
    expect(new URLSearchParams(location.search).get('shopCustomer')).toBe(key);
    expect(screen.getByRole('region', { name: 'Customer purchase summary' })).toBeInTheDocument();
  });
  it("confirms block and credit actions and updates the profile without reloading history", async () => {
    request.mockImplementation(async (path, options) => {
      if (path.endsWith('/block')) return { customer: { ...customer, blocked: JSON.parse(options.body).blocked } };
      if (path.endsWith('/credit-contact')) return { customer: { ...customer, blocked: false, credit_customer_id: 42 } };
      if (path.includes('/history?')) return { items: [order], total: 1 };
      return { customer, report };
    });
    render(<ShopCustomerDetail customerKey={key} refresh={0} timezone="Asia/Rangoon" onViewOrder={vi.fn()} canBlock canAddCredit />);
    await screen.findByRole('button', { name: 'O-HISTORY' });
    const historyReads = request.mock.calls.filter(([path]) => path.includes('/history?')).length;
    fireEvent.click(screen.getByRole('button', { name: 'Block customer' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Block customer' })).getByRole('button', { name: 'Block customer' }));
    await screen.findByText('Blocked');
    fireEvent.click(screen.getByRole('button', { name: 'Unblock customer' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Unblock customer' })).getByRole('button', { name: 'Unblock customer' }));
    await waitFor(() => expect(screen.queryByText('Blocked')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add to credit customers' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Add to credit customers' })).getByRole('button', { name: 'Add to credit customers' }));
    expect(await screen.findByRole('button', { name: 'Added to credit customers' })).toBeDisabled();
    expect(request.mock.calls.filter(([path]) => path.includes('/history?'))).toHaveLength(historyReads);
  });
  it("shows profile, purchase summary and separate currency totals", async () => {
    render(<ShopCustomerDetail customerKey={key} refresh={0} timezone="Asia/Rangoon" onViewOrder={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Shop buyer" })).toBeInTheDocument();
    expect(screen.getByText("Yangon")).toBeInTheDocument();
    const summary = screen.getByRole("region", { name: "Customer purchase summary" });
    expect(within(summary).getByText("4")).toBeInTheDocument();
    expect(within(summary).getByText("2")).toBeInTheDocument();
    const spending = screen.getByRole("region", { name: "Customer spending report" });
    expect(within(spending).getAllByText("3,000 Ks")).toHaveLength(2);
    expect(within(spending).getAllByText("5 USD")).toHaveLength(2);
    expect(within(spending).getByText("1,000 Ks")).toBeInTheDocument();
    await screen.findByRole("button", { name: "O-HISTORY" });
    expect(screen.queryByRole("dialog", { name: "Customer purchases" })).not.toBeInTheDocument();
  });
  it("paginates and filters history without changing the all-time report", async () => {
    const onViewOrder = vi.fn();
    render(<ShopCustomerDetail customerKey={key} refresh={0} timezone="Asia/Rangoon" onViewOrder={onViewOrder} />);
    await screen.findByText("1-25 of 62");
    const reportReads = request.mock.calls.filter(([path]) => path === "/shop-admin/customers/guest%3Aabc").length;
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("26-50 of 62");
    fireEvent.change(screen.getByLabelText("Search customer order history"), { target: { value: "HISTORY" } });
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByLabelText("Order status"), { target: { value: "accepted" } });
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/customers/guest%3Aabc/history?q=HISTORY&status=accepted&offset=0&limit=25"));
    expect(request.mock.calls.filter(([path]) => path === "/shop-admin/customers/guest%3Aabc")).toHaveLength(reportReads);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-05" } });
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/customers/guest%3Aabc/history?q=HISTORY&status=accepted&date_from=2026-10-01&date_to=2026-10-05&offset=0&limit=25"));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-06" } });
    expect(screen.getByRole("alert")).toHaveTextContent("From date cannot be later than To date.");
    expect(screen.getByRole("button", { name: "Apply Filter" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("/shop-admin/customers/guest%3Aabc/history?q=&status=&offset=0&limit=25"));
    expect(request.mock.calls.filter(([path]) => path === "/shop-admin/customers/guest%3Aabc")).toHaveLength(reportReads);
    fireEvent.click(screen.getByRole("button", { name: "O-HISTORY" }));
    expect(onViewOrder).toHaveBeenCalledWith(12);
  });
  it("navigates from customer name to detail and back through the app bar, retaining customer context for an order", async () => {
    const onDetailChange = vi.fn();
    render(<ShopScreen onDetailChange={onDetailChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "Customers", exact: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Shop buyer" }));
    await screen.findByRole("heading", { name: "Shop buyer" });
    expect(new URLSearchParams(location.search).get("shopCustomer")).toBe(key);
    await waitFor(() => expect(onDetailChange.mock.lastCall[0].label).toBe("Back to customers"));
    fireEvent.click(await screen.findByRole("button", { name: "O-HISTORY" }));
    await screen.findByRole("heading", { name: "O-HISTORY" });
    await waitFor(() => expect(onDetailChange.mock.lastCall[0].label).toBe("Back to customer"));
    fireEvent.click(render(<button onClick={onDetailChange.mock.lastCall[0].onClick}>Test back</button>).getByRole("button", { name: "Test back" }));
    await screen.findByRole("heading", { name: "Shop buyer" });
    expect(new URLSearchParams(location.search).get("shopOrder")).toBeNull();
  });
  it("keeps a direct customer URL and supports retry after a loading failure", async () => {
    request.mockRejectedValueOnce(new Error("Customer unavailable"));
    render(<ShopCustomerDetail customerKey={key} refresh={0} timezone="Asia/Rangoon" onViewOrder={vi.fn()} />);
    await screen.findByText("Customer unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("heading", { name: "Shop buyer" });
  });
});
