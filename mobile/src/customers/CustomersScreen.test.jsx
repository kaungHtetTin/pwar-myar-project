import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { CustomersScreen } from "./CustomersScreen";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const customer = {
  id: 7,
  name: "Moe Customer",
  phone: "09123",
  address: "Yangon",
  note: "VIP",
  balance: 1600,
};
const detail = {
  customer,
  summary: {
    balance: 1600,
    credit_total: 2000,
    paid_total: 500,
    payout_total: 100,
  },
};
const sale = {
  id: 11,
  created_at: "2026-08-07",
  receipt_no: "R-001",
  total: 2500,
  credit_amount: 2000,
};
const payment = {
  id: 14,
  customer_id: 7,
  created_at: "2026-08-08",
  direction: "customer_to_shop",
  payment_method: "Cash",
  amount: 500,
  note: "Deposit",
};

function customerApi(path, options = {}) {
  if (path.startsWith("/customers?"))
    return Promise.resolve({
      items: [customer],
      total: 1,
      account_summary: {
        total_customers: 1,
        receivable_total: 1600,
        payable_total: 0,
        open_accounts: 1,
      },
    });
  if (path === "/customers/7/detail") return Promise.resolve(detail);
  if (path.startsWith("/customers/7/sales?"))
    return Promise.resolve({ items: [sale], total: 1, limit: 20, offset: 0 });
  if (path.startsWith("/customers/7/payments?"))
    return Promise.resolve({
      items: [payment],
      total: 1,
      limit: 20,
      offset: 0,
    });
  if (path === "/customer-payments/14" && !options.method)
    return Promise.resolve(payment);
  if (path === "/settings")
    return Promise.resolve({
      payment_methods: "Cash, Credit, KBZ Pay",
      shop_name: "PwarMyar Shop",
    });
  if (path === "/customers" && options.method === "POST")
    return Promise.resolve(customer);
  if (path === "/customers/7" && options.method === "PUT")
    return Promise.resolve(customer);
  if (path === "/customers/7" && options.method === "DELETE")
    return Promise.resolve({ ok: true });
  if (path === "/customers/7/payments" && options.method === "POST")
    return Promise.resolve(payment);
  if (path === "/customer-payments/14" && options.method === "PUT")
    return Promise.resolve(payment);
  if (path === "/customer-payments/14" && options.method === "DELETE")
    return Promise.resolve({ id: 14, customer_id: 7, deleted: true });
  if (path.startsWith("/customers/7/statement"))
    return Promise.resolve({
      ...detail,
      start: null,
      end: null,
      sales: [sale],
      payments: [payment],
      summary: { ...detail.summary, current_balance: 1600 },
    });
  return Promise.resolve({});
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation(customerApi);
});

afterEach(() => vi.restoreAllMocks());

it('keeps a failed customer draft and clears it only after a confirmed create', async () => {
  let fail = true;
  apiRequest.mockImplementation((path, options = {}) => path === '/customers' && options.method === 'POST'
    ? fail ? Promise.reject(new Error('Save unavailable')) : Promise.resolve(customer)
    : customerApi(path, options));
  const navigate = vi.fn();
  render(<CustomersScreen pathname="/customers/new" onNavigate={navigate} />);
  const name = await screen.findByLabelText('Customer name');
  fireEvent.change(name, { target: { value: 'First customer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
  await screen.findByText('Save unavailable');
  expect(name).toHaveValue('First customer');
  expect(navigate).not.toHaveBeenCalled();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
  await waitFor(() => expect(navigate).toHaveBeenCalled());
  expect(name).toHaveValue('');
  fireEvent.change(name, { target: { value: 'Second customer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save customer' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledTimes(2));
  const posts = apiRequest.mock.calls.filter(([path, options]) => path === '/customers' && options?.method === 'POST');
  expect(JSON.parse(posts.at(-1)[1].body).name).toBe('Second customer');
});

describe("mobile customers workspace", () => {
  it('loads email on edit deep links and shows server email validation beside the field', async () => {
    apiRequest.mockImplementation((path, options = {}) => {
      if (path === '/customers/7/detail') return Promise.resolve({ ...detail, customer: { ...customer, email: 'buyer@example.com' } });
      if (path === '/customers/7' && options.method === 'PUT') return Promise.reject(Object.assign(new Error('Invalid email'), { payload: { errors: { email: ['Enter a valid email address.'] } } }));
      return customerApi(path, options);
    });
    render(<CustomersScreen pathname="/customers/7/edit" onNavigate={vi.fn()} />);
    const email = await screen.findByLabelText('Email (optional)');
    await waitFor(() => expect(email).toHaveValue('buyer@example.com'));
    fireEvent.change(email, { target: { value: 'invalid' } });
    fireEvent.submit(email.closest('form'));
    expect(await screen.findByText('Enter a valid email address.')).toHaveAttribute('id', 'customer-email-error');
    expect(email).toHaveAttribute('aria-describedby', 'customer-email-error');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it("renders account metrics and the endless customer directory", async () => {
    render(<CustomersScreen />);
    expect(await screen.findByText("Moe Customer")).toBeInTheDocument();
    expect(screen.getAllByText("1,600 Ks").length).toBeGreaterThan(0);
    expect(screen.getByText("1 customers")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actions for Moe Customer" }),
    ).toBeInTheDocument();
    const customerControls = screen
      .getByLabelText("Search customers")
      .closest(".customer-controls");
    expect(customerControls).not.toContainElement(screen.getByRole("button", { name: "Export CSV" }));
    expect(screen.getByRole("button", { name: "Export CSV" }).closest('header')).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Moe Customer" }),
    ).not.toBeInTheDocument();
    expect(
      apiRequest.mock.calls.some(
        ([path]) =>
          path.includes("/customers?") &&
          path.includes("with_total=true") &&
          path.includes("offset=0"),
      ),
    ).toBe(true);
  });

  it("moves customer actions into the compact item menu", async () => {
    render(<CustomersScreen />);
    await screen.findByText("Moe Customer");
    fireEvent.click(
      screen.getByRole("button", { name: "Actions for Moe Customer" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Customer actions" }),
    ).toHaveClass("mobile-sheet--action-menu");
    expect(document.querySelector(".mobile-action-menu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByRole("dialog", { name: "Delete customer?" }),
    ).toHaveTextContent("history will remain linked");
  });

  it("creates customers on a dedicated page with field validation", async () => {
    render(<CustomersScreen />);
    await screen.findByText("Moe Customer");
    fireEvent.click(screen.getByRole("button", { name: "New customer" }));
    expect(
      screen.getByRole("heading", { name: "New customer" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Customer name is required.",
    );
    fireEvent.change(screen.getByLabelText("Customer name"), {
      target: { value: " Moe Customer " },
    });
    const email = screen.getByLabelText('Email (optional)');
    expect(email).not.toBeRequired();
    fireEvent.change(email, { target: { value: ' Buyer@Example.com ' } });
    fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/customers",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"email":"buyer@example.com"'),
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Moe Customer" }),
    ).toBeInTheDocument();
  });

  it("shows credit sales and payment histories on the customer detail page", async () => {
    const navigate = vi.fn();
    render(<CustomersScreen pathname="/customers/7" onNavigate={navigate} />);
    expect(await screen.findByText("R-001")).toBeInTheDocument();
    expect(screen.getAllByText("2,000 Ks").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "View sale R-001" }));
    expect(navigate).toHaveBeenCalledWith("/sales/11", {});
    const profile = screen.getByLabelText("Customer profile");
    const tabs = screen.getByRole("navigation", { name: "Customer detail sections" });
    expect(profile).toHaveTextContent("Address");
    expect(profile).toHaveTextContent("Yangon");
    expect(profile).toHaveTextContent("Note");
    expect(profile).toHaveTextContent("VIP");
    expect(profile.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tabs).toHaveClass("transaction-tabs");
    expect(document.querySelectorAll(".customer-detail-summary > span")).toHaveLength(4);
    expect(screen.queryByRole('button', {name:'Customer actions'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Export CSV'}));
    expect(screen.getByRole('dialog', {name:'Export customer data'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Credit sales CSV'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Payment records CSV'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Cancel'})).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name:'Close Export customer data'})[1]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', {name:'Edit customer'})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name:'Delete customer'}));
    expect(screen.getByRole('dialog', {name:'Delete customer?'})).toHaveTextContent('Sales and payment history will remain linked');
    fireEvent.click(screen.getByRole('button', {name:'Cancel'}));
    expect(apiRequest.mock.calls.some(([,options])=>options?.method==='DELETE')).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: "Payment records" }));
    expect(await screen.findByText("Customer pays shop")).toBeInTheDocument();
    expect(screen.getByText("Deposit")).toBeInTheDocument();
    expect(
      apiRequest.mock.calls.some(
        ([path]) =>
          path.includes("/customers/7/payments?") &&
          path.includes("with_total=true"),
      ),
    ).toBe(true);
  });

  it("creates payments on a separate full page", async () => {
    const navigate = vi.fn();
    render(
      <CustomersScreen
        pathname="/customers/7/payments/new"
        onNavigate={navigate}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "New payment" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/customers/7/payments",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(navigate).toHaveBeenCalledWith("/customers/7", { replace: true });
    expect(screen.getByLabelText("Amount")).toHaveValue(null);
  });

  it("loads payment edit deep links from the single-payment endpoint", async () => {
    render(
      <CustomersScreen
        pathname="/customers/7/payments/14/edit"
        onNavigate={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "Edit payment" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toHaveValue(500);
    expect(apiRequest).toHaveBeenCalledWith(
      "/customer-payments/14",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("prints a statement containing shop and customer data", async () => {
    const printWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      close: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(printWindow);
    render(<CustomersScreen pathname="/customers/7" onNavigate={vi.fn()} />);
    await screen.findByText("R-001");
    fireEvent.click(screen.getByRole("button", { name: "Statement" }));
    await waitFor(() => expect(printWindow.document.write).toHaveBeenCalled());
    expect(printWindow.document.write.mock.calls[0][0]).toContain(
      "Moe Customer",
    );
    expect(printWindow.document.write.mock.calls[0][0]).toContain("PwarMyar Shop");
  });

  it("confirms payment deletion and recalculates the detail", async () => {
    render(<CustomersScreen pathname="/customers/7" onNavigate={vi.fn()} />);
    await screen.findByText("R-001");
    fireEvent.click(screen.getByRole("tab", { name: "Payment records" }));
    await screen.findByText("Deposit");
    fireEvent.click(
      screen.getByRole("button", { name: "Actions for payment 14" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete payment 14" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "balance will be recalculated",
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete payment" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/customer-payments/14", {
        method: "DELETE",
      }),
    );
  });
  it("keeps shop payouts separate from total received in payment records", async () => {
    apiRequest.mockImplementation((path, options) => path.startsWith('/customers/7/payments?')
      ? Promise.resolve({ items: [payment, { ...payment, id: 15, direction: 'shop_to_customer', amount: 200, note: 'Refund' }], total: 2 })
      : customerApi(path, options));
    render(<CustomersScreen pathname="/customers/7" />);
    await screen.findByText('R-001');
    fireEvent.click(screen.getByRole('tab', { name: 'Payment records' }));
    await screen.findByText('Customer pays shop');
    expect(screen.getByText('Shop pays customer')).toBeInTheDocument();
    expect(screen.getByText(/Total received/)).toHaveTextContent('500 Ks');
    expect(screen.getByRole('button', { name: 'Actions for payment 15' })).toBeInTheDocument();
  });

});
