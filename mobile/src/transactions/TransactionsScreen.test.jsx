import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/client";
import { SalesHistoryScreen } from "./SalesHistoryScreen";
import { TransactionsScreen } from "./TransactionsScreen";

vi.mock("../api/client", () => ({ apiRequest: vi.fn() }));

const sale = {
  id: 12,
  receipt_no: "R260808-0012",
  customer_id: null,
  customer_name: null,
  payment_type: "cash",
  payment_method: "Cash",
  subtotal: 3000,
  discount: 0,
  total: 3000,
  paid_amount: 3000,
  credit_amount: 0,
  status: "completed",
  created_at: "2026-08-08 10:00:00",
  items: [
    {
      id: 31,
      product_id: 4,
      product_name: "Drinking Water",
      unit_name: "Bottle",
      price_type: "Retail",
      quantity: 2,
      foc_quantity: 0,
      unit_price: 1500,
      line_total: 3000,
    },
  ],
};
const supplierPayment = {
  id: 5,
  supplier_id: 3,
  supplier_name: "Green Wholesale",
  direction: "shop_to_supplier",
  payment_method: "Cash",
  amount: 2000,
  note: "Part payment",
  created_at: "2026-08-08 11:00:00",
};
const customerPayment = {
  id: 6,
  customer_id: 2,
  customer_name: "Mya Mya",
  direction: "customer_to_shop",
  payment_method: "Cash",
  amount: 1500,
  note: "Account payment",
  created_at: "2026-08-08 12:00:00",
};
let adminPinSet = "0";

function transactionApi(path, options = {}) {
  if (path === "/categories") return Promise.resolve(["Beverages", "Food"]);
  if (path.startsWith("/products?"))
    return Promise.resolve({
      items: [{ id: 8, name: "Orange Juice", sku: "OJ-8", category: "Beverages", base_unit: "Bottle", price: 1200, prices: [{ name: "Retail", price: 1200 }] }],
      total: 1,
    });
  if (path === "/settings")
    return Promise.resolve({
      price_types: "Retail",
      payment_methods: "Cash,KPay",
      admin_pin_set: adminPinSet,
    });
  if (path === "/sales/12" && options.method === "PUT")
    return Promise.resolve({ ...sale, ...JSON.parse(options.body) });
  if (path === "/sales/12" && options.method === "DELETE")
    return Promise.resolve({ id: 12, deleted: true });
  if (path === "/sales/12") return Promise.resolve(sale);
  if (path.startsWith("/sales?"))
    return Promise.resolve({ items: [sale], total: 1 });
  if (path.startsWith("/customer-payments?"))
    return Promise.resolve({ items: [customerPayment], total: 1 });
  if (path.startsWith("/supplier-payments?"))
    return Promise.resolve({ items: [supplierPayment], total: 1 });
  if (path === "/supplier-payments/5") return Promise.resolve(supplierPayment);
  return Promise.resolve({ items: [], total: 0 });
}

beforeEach(() => {
  adminPinSet = "0";
  window.localStorage.clear();
  apiRequest.mockReset();
  apiRequest.mockImplementation(transactionApi);
});

describe("mobile sales and transaction history separation", () => {

  it('updates the edit-cart amount and totals from the selected product price and saves a manual override', async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === '/settings') return Promise.resolve({ price_types: 'Retail,Wholesale', payment_methods: 'Cash', admin_pin_set: '0' });
      if (path === '/products/4') return Promise.resolve({ price: 1500, prices: [{ name: 'Retail', price: 1500 }, { name: 'Wholesale', price: 1200 }] });
      return transactionApi(path, options);
    });
    render(<SalesHistoryScreen pathname="/sales/12/edit" onNavigate={vi.fn()} />);
    const selector = await screen.findByLabelText('Price type for Drinking Water');
    const price = screen.getByLabelText('Drinking Water unit price');
    expect(price).toHaveValue(1500);
    fireEvent.change(selector, { target: { value: 'Wholesale' } });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await waitFor(() => expect(price).toHaveValue(1200));
    expect(selector).toHaveValue('Wholesale');
    expect(screen.getAllByText('2,400 Ks').length).toBeGreaterThan(0);
    fireEvent.change(price, { target: { value: '1250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByLabelText('Drinking Water unit price')).toHaveValue(1250);
    expect(screen.getByLabelText('Price type for Drinking Water')).toHaveValue('Wholesale');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Paid amount'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(apiRequest.mock.calls.some(([path, options]) => path === '/sales/12' && options?.method === 'PUT')).toBe(true));
    const payload = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body);
    expect(payload.items[0]).toMatchObject({ price_type: 'Wholesale', unit_price: 1250, quantity: 2 });
  });

  it('preserves the previous type and amount on lookup failure or a missing named price, and allows retry', async () => {
    let calls = 0;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/settings') return Promise.resolve({ price_types: 'Retail,Wholesale', payment_methods: 'Cash' });
      if (path === '/products/4') {
        calls++;
        if (calls === 1) return Promise.reject(new Error('Unable to load product prices.'));
        return Promise.resolve({ price: 1500, prices: calls === 2 ? [{ name: 'Retail', price: 1500 }] : [{ name: 'Wholesale', price: 1000 }] });
      }
      return transactionApi(path, options);
    });
    render(<SalesHistoryScreen pathname="/sales/12/edit" onNavigate={vi.fn()} />);
    const selector = await screen.findByLabelText('Price type for Drinking Water');
    fireEvent.change(selector, { target: { value: 'Wholesale' } });
    await screen.findByText('Unable to load product prices.');
    expect(selector).toHaveValue('Retail');
    expect(screen.getByLabelText('Drinking Water unit price')).toHaveValue(1500);
    fireEvent.change(selector, { target: { value: 'Wholesale' } });
    await screen.findByText('Wholesale price is not set for Drinking Water.');
    expect(selector).toHaveValue('Retail');
    fireEvent.change(selector, { target: { value: 'Wholesale' } });
    await waitFor(() => expect(screen.getByLabelText('Drinking Water unit price')).toHaveValue(1000));
    expect(selector).toHaveValue('Wholesale');
  });
  it('discards unapplied drawer edits and keeps the filter count tied to the visible results', async () => {
    render(<SalesHistoryScreen pathname="/sales" onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'View sale R260808-0012' });
    const requests = apiRequest.mock.calls.filter(([path]) => path.startsWith('/sales?')).length;
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'KPay' } });
    expect(screen.getByRole('button', { name: 'Filters', exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close filters', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    expect(screen.getByLabelText('Payment method')).toHaveValue('');
    expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/sales?'))).toHaveLength(requests);
  });

  it('validates reversed dates and closes the drawer when Reset restores defaults', async () => {
    render(<SalesHistoryScreen pathname="/sales" onNavigate={vi.fn()} />);
    await screen.findByRole('button', { name: 'View sale R260808-0012' });
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-01' } });
    const requests = apiRequest.mock.calls.filter(([path]) => path.startsWith('/sales?')).length;
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(await screen.findByText('From date cannot be later than To date.')).toBeInTheDocument();
    expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/sales?'))).toHaveLength(requests);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
    expect(screen.getByLabelText('From')).toHaveValue('');
    expect(screen.getByLabelText('To')).toHaveValue('');
    expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/sales?'))).toHaveLength(requests);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(screen.queryByLabelText('From')).not.toBeInTheDocument());
  });
  it("marks online sales, hides their edit action, and applies and resets the channel filter", async () => {
    const onlineSale = { ...sale, source: "ecommerce" };
    apiRequest.mockImplementation((path, options) => path.startsWith("/sales?")
      ? Promise.resolve({ items: [onlineSale], total: 1 }) : transactionApi(path, options));
    render(<SalesHistoryScreen pathname="/sales" onNavigate={vi.fn()} />);
    expect(await screen.findByText("Online", { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Actions for sale ${sale.receipt_no}` }));
    expect(screen.queryByRole("button", { name: "Edit sale", exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View sale details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print sale receipt" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close Sale actions" })[1]);
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(screen.queryByRole('button', { name: 'Customer filter' })).not.toBeInTheDocument();
    expect(screen.queryByText('More filters')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sale channel')).toBeVisible();
    expect(screen.getByLabelText('Sale channel').closest('details')).toBeNull();
    fireEvent.change(screen.getByLabelText("Sale channel"), { target: { value: "online" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply filters/ }));
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes("sale_channel=online") && path.includes("offset=0"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reset", exact: true }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(screen.getByLabelText("Sale channel")).toHaveValue("all");
  });

  it('preserves sale checkout drafts and cart quantities through Previous and the Cart step button', async () => {
    render(<SalesHistoryScreen pathname="/sales/12/edit" onNavigate={vi.fn()} />);
    const page = await screen.findByRole('heading', { name: 'Edit sale' });
    fireEvent.change(screen.getByLabelText('Drinking Water FOC quantity'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Discount'), { target: { value: '200' } });
    const requests = apiRequest.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByLabelText('Drinking Water FOC quantity')).toHaveValue('1');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Discount')).toHaveValue(200);
    fireEvent.click(screen.getByRole('button', { name: 'Cart', exact: true }));
    expect(screen.getByLabelText('Drinking Water FOC quantity')).toHaveValue('1');
    expect(screen.getByRole('heading', { name: 'Edit sale' })).toBe(page);
    expect(apiRequest.mock.calls.length).toBe(requests);
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  });
  it("opens sale details from the compact sale row and keeps actions in a menu", async () => {
    const navigate = vi.fn();
    render(<SalesHistoryScreen pathname="/sales" onNavigate={navigate} />);

    const saleRow = await screen.findByRole("button", {
      name: "View sale R260808-0012",
    });
    expect(
      screen.queryByRole("button", { name: "Edit sale" }),
    ).not.toBeInTheDocument();
    fireEvent.click(saleRow);
    expect(navigate).toHaveBeenCalledWith("/sales/12");

    fireEvent.click(
      screen.getByRole("button", { name: "Actions for sale R260808-0012" }),
    );
    expect(screen.getByRole("dialog", { name: "Sale actions" })).toHaveClass(
      "mobile-sheet--action-menu",
    );
    expect(document.querySelector(".mobile-action-menu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View sale details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Print sale receipt" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit sale" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete sale" }),
    ).toBeInTheDocument();
  });

  it("keeps the styled From and To date controls wired to the transaction query", async () => {
    render(<SalesHistoryScreen pathname="/sales" onNavigate={vi.fn()} />);

    expect(
      await screen.findByRole("heading", { name: "Sales" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Transaction types" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const from = screen.getByLabelText("From");
    const to = screen.getByLabelText("To");
    expect(from).toHaveAttribute("type", "date");
    expect(to).toHaveAttribute("type", "date");
    expect(from.closest(".sales-history-filter-panel")).toBeInTheDocument();

    fireEvent.change(from, { target: { value: "2026-08-01" } });
    fireEvent.change(to, { target: { value: "2026-08-08" } });
    fireEvent.click(screen.getByRole("button", { name: /Apply filters/ }));

    await waitFor(() =>
      expect(
        apiRequest.mock.calls.some(
          ([path]) =>
            path.startsWith("/sales?") &&
            path.includes("start=2026-08-01") &&
            path.includes("end=2026-08-08"),
        ),
      ).toBe(true),
    );
  });

  it("uses the Expenses-style Sales controls and compact filter fields", async () => {
    render(<SalesHistoryScreen pathname="/sales" onNavigate={vi.fn()} />);

    await screen.findByRole("button", { name: "View sale R260808-0012" });
    const filterButton = screen.getByRole("button", { name: "Filters" });
    const controlRow = filterButton.closest(".sales-history-control-row");
    expect(controlRow).not.toContainElement(screen.getByRole("button", { name: "Export sales" }));
    expect(screen.getByRole("button", { name: "Export sales" }).closest('header')).toBeInTheDocument();
    expect(screen.getByLabelText("Search sales").closest(".mobile-search")).toBeInTheDocument();

    fireEvent.click(filterButton);
    expect(screen.getByLabelText("From").closest(".product-filter-field")).toBeInTheDocument();
    expect(screen.getByLabelText("To").closest(".product-filter-field")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment type").closest(".product-filter-field")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment method").closest(".product-filter-field")).toBeInTheDocument();
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeInTheDocument();
  });

  it("opens the sale edit deep link and submits the Laravel update payload", async () => {
    const navigate = vi.fn();
    render(
      <SalesHistoryScreen pathname="/sales/12/edit" onNavigate={navigate} />,
    );

    expect(
      await screen.findByRole("heading", { name: "Edit sale" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Admin PIN")).not.toBeInTheDocument();
    const progress = screen.getByRole("navigation", { name: "Sale edit progress" });
    expect(progress).toHaveClass("sales-reference-progress");
    expect(screen.getByRole("button", { name: "Cart" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/Bottle/)).toBeInTheDocument();
    const focInput = screen.getByLabelText("Drinking Water FOC quantity");
    fireEvent.change(focInput, { target: { value: "" } });
    expect(focInput).toHaveValue("");
    fireEvent.blur(focInput);
    expect(focInput).toHaveValue("0");
    expect(screen.queryByLabelText("Discount")).not.toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: "Continue" });
    fireEvent.submit(continueButton.closest("form"));
    expect(screen.getByRole("button", { name: "Cart" })).toHaveAttribute("aria-current", "step");
    fireEvent.click(continueButton);
    expect(screen.getByRole("button", { name: "Checkout" })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Save changes" })).toBe(continueButton);
    expect(
      apiRequest.mock.calls.some(
        ([path, options]) => path === "/sales/12" && options?.method === "PUT",
      ),
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Discount"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Paid amount"), {
      target: { value: "2800" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        "/sales/12",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            items: [
              {
                product_id: 4,
                price_type: "Retail",
                quantity: 2,
                foc_quantity: 0,
                unit_price: 1500,
              },
            ],
            discount: 200,
            payment_type: "cash",
            payment_method: "Cash",
            paid_amount: 2800,
            customer_id: null,
          }),
        }),
      ),
    );
    expect(navigate).toHaveBeenCalledWith("/sales", { replace: true });
  });

  it("filters add-product choices by product category instead of price type", async () => {
    render(<SalesHistoryScreen pathname="/sales/12/edit" onNavigate={vi.fn()} />);

    await screen.findByRole("heading", { name: "Edit sale" });
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));

    const category = await screen.findByLabelText("Product category");
    expect(category).toHaveValue("");
    expect(screen.getByRole("option", { name: "All categories" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Beverages" })).toBeInTheDocument();
    expect(category.closest(".mobile-filter-drawer").querySelector('[aria-label="Price type"]')).toBeNull();

    fireEvent.change(category, { target: { value: "Beverages" } });
    await waitFor(() =>
      expect(apiRequest.mock.calls.some(([path]) =>
        path.startsWith("/products?") && path.includes("category=Beverages"),
      )).toBe(true),
    );
  });

  it('stages drawer selections, cancels without changing the cart, and adds once on confirmation', async () => {
    render(<SalesHistoryScreen pathname="/sales/12/edit" onNavigate={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Edit sale' });
    const originalQuantity = screen.getByLabelText('Drinking Water quantity');
    fireEvent.change(originalQuantity, { target: { value: '3' } });
    expect(originalQuantity.closest('.sale-cart-card')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add product', exact: true }));
    let drawer = screen.getByRole('dialog', { name: 'Add product' });
    fireEvent.click(await within(drawer).findByRole('checkbox', { name: 'Select Orange Juice' }));
    expect(within(drawer).getByRole('button', { name: 'Add 1 product' })).toBeEnabled();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Orange Juice quantity')).not.toBeInTheDocument();
    expect(originalQuantity).toHaveValue('3');
    fireEvent.click(screen.getByRole('button', { name: 'Add product', exact: true }));
    drawer = screen.getByRole('dialog', { name: 'Add product' });
    expect(within(drawer).getByRole('button', { name: 'Add 0 products' })).toBeDisabled();
    fireEvent.click(await within(drawer).findByRole('checkbox', { name: 'Select Orange Juice' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Clear all' }));
    expect(within(drawer).getByRole('button', { name: 'Add 0 products' })).toBeDisabled();
    fireEvent.click(within(drawer).getByRole('checkbox', { name: 'Select Orange Juice' }));
    fireEvent.click(within(drawer).getByRole('button', { name: 'Add 1 product' }));
    expect(screen.getAllByLabelText('Orange Juice quantity')).toHaveLength(1);
    expect(screen.getByLabelText('Drinking Water quantity')).toHaveValue('3');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByLabelText('Drinking Water quantity')).toHaveValue('3');
    expect(screen.getByLabelText('Orange Juice quantity')).toHaveValue('1');
  });

  it("shows and submits the admin PIN for a protected sale update", async () => {
    adminPinSet = "1";
    render(
      <SalesHistoryScreen pathname="/sales/12/edit" onNavigate={vi.fn()} />,
    );

    await screen.findByRole("heading", { name: "Edit sale" });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText("Admin PIN")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      screen.getByText("Enter the admin PIN to update this sale."),
    ).toBeInTheDocument();
    expect(
      apiRequest.mock.calls.some(
        ([path, options]) => path === "/sales/12" && options?.method === "PUT",
      ),
    ).toBe(false);

    fireEvent.change(screen.getByLabelText(/Admin PIN/), {
      target: { value: "2468" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      const call = apiRequest.mock.calls.find(
        ([path, options]) => path === "/sales/12" && options?.method === "PUT",
      );
      expect(JSON.parse(call[1].body).admin_pin).toBe("2468");
    });
  });

  it("deletes a sale without showing a PIN field when protection is off", async () => {
    render(<SalesHistoryScreen pathname="/sales" onNavigate={vi.fn()} />);
    await screen.findByRole("button", {
      name: "Actions for sale R260808-0012",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Actions for sale R260808-0012" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete sale" }));

    await screen.findByRole("button", { name: "Delete transaction" });
    expect(screen.queryByLabelText("Admin PIN")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete transaction" }));

    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith("/sales/12", {
        method: "DELETE",
      }),
    );
  });

  it("hides Edit on an online sale detail page and keeps receipt printing", async () => {
    apiRequest.mockImplementation((path, options) => path === "/sales/12"
      ? Promise.resolve({ ...sale, source: "ecommerce" }) : transactionApi(path, options));
    render(<SalesHistoryScreen pathname="/sales/12" onNavigate={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: sale.receipt_no })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit sale" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Print receipt" })[0]).toBeInTheDocument();
  });

  it("loads a full sale detail route", async () => {
    const navigate = vi.fn();
    render(<SalesHistoryScreen pathname="/sales/12" onNavigate={navigate} />);
    expect(await screen.findByRole("heading", { name: "R260808-0012" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Items (1)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Drinking Water")).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      "/sales/12",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit sale" }));
    expect(navigate).toHaveBeenCalledWith("/sales/12/edit");
  });

  it("keeps only customer and supplier payment tabs on Transactions", async () => {
    render(
      <TransactionsScreen pathname="/transactions" onNavigate={vi.fn()} />,
    );
    expect(await screen.findByText("Mya Mya")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Customers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Suppliers" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sales" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Purchases" }),
    ).not.toBeInTheDocument();
    expect(
      apiRequest.mock.calls.some(([path]) => path.startsWith("/sales?")),
    ).toBe(false);
    expect(
      apiRequest.mock.calls.some(([path]) => path.startsWith("/purchases?")),
    ).toBe(false);
    const customerFilter = screen.getByRole("button", { name: "Filters" });
    expect(customerFilter.closest(".payment-reference-controls")).not.toContainElement(screen.getByRole("button", { name: "Export CSV" }));
    expect(screen.getByRole("button", { name: "Export CSV" }).closest('header')).toBeInTheDocument();
    expect(screen.getByLabelText("Search transactions").closest(".mobile-search")).toBeInTheDocument();

    fireEvent.click(customerFilter);
    expect(screen.getByRole("group", {name:"Payment direction"})).toBeInTheDocument();
    expect(screen.getByRole("group", {name:"Payment method"})).toBeInTheDocument();
  });

  it("opens customer payment actions in the shared bottom menu", async () => {
    const navigate = vi.fn();
    render(
      <TransactionsScreen pathname="/transactions" onNavigate={navigate} />,
    );

    const actions = await screen.findByRole("button", {
      name: "Actions for customer payment 6",
    });
    expect(actions).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Edit customer payment" }),
    ).not.toBeInTheDocument();

    fireEvent.click(actions);

    expect(
      screen.getByRole("dialog", { name: "Customer payment actions" }),
    ).toHaveClass("mobile-sheet--action-menu");
    expect(
      screen.getByRole("button", { name: "Edit customer payment" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete customer payment" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Edit customer payment" }),
    );
    expect(navigate).toHaveBeenCalledWith("/transactions/payments/6/edit");
  });

  it("shows supplier payments in their own endless transaction tab", async () => {
    render(
      <TransactionsScreen pathname="/transactions" onNavigate={vi.fn()} />,
    );
    await screen.findByRole("heading", { name: "Transactions" });
    fireEvent.click(screen.getByRole("button", { name: "Suppliers" }));
    expect(await screen.findByText("Green Wholesale")).toBeInTheDocument();
    expect(screen.getAllByText("2,000 Ks").length).toBeGreaterThan(0);
    const supplierFilter = screen.getByRole("button", { name: "Filters" });
    expect(supplierFilter.closest(".payment-reference-controls")).not.toContainElement(screen.getByRole("button", { name: "Export CSV" }));
    expect(screen.getByRole("button", { name: "Export CSV" }).closest('header')).toBeInTheDocument();
    expect(screen.getByLabelText("Search supplier payments").closest(".mobile-search")).toBeInTheDocument();
    fireEvent.click(supplierFilter);
    expect(within(screen.getByRole("group",{name:"Payment direction"})).getByRole("radio",{name:"All",exact:true})).toBeChecked();
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
    expect(
      apiRequest.mock.calls.some(
        ([path]) =>
          path.startsWith("/supplier-payments?") && path.includes("offset=0"),
      ),
    ).toBe(true);
  });
});
