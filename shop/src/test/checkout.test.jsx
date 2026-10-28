import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "../main";
import { saveCart, readCarts } from "../cart";

it("offers direct delivery-service payment without configured zones and submits the customer choice", async () => {
  const quote = { items: [{ product_id: 1, name: "Rice", quantity: 1, unit_name: "Bag", line_total: 1000 }],
    subtotal: 1000, delivery_fee: 0, delivery_fee_recipient: "delivery_service", total: 1000, currency: "Ks", quote_hash: "a".repeat(64) };
  const fetchMock = vi.fn(async (url) => ({ ok: true, json: async () => url.endsWith("/quote") ? quote : {
    display_name: "Test", accepting_orders: true, currency: "Ks", payment_methods: [{ id: "cash", name: "Cash on delivery", type: "cash" }], delivery_zones: [],
  } }));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await screen.findByLabelText("Your name");
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Buyer" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "09000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  fireEvent.change(screen.getByLabelText("Receive your order"), { target: { value: "delivery" } });
  fireEvent.change(screen.getByLabelText("Delivery zone"), { target: { value: "__delivery_service__" } });
  fireEvent.click(screen.getByRole('button', { name: 'Edit delivery address' }));
  fireEvent.change(screen.getByRole("textbox", { name: /address/i }), { target: { value: "Buyer address" } });
  fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Review order" }));
  await screen.findByText("Total payable to shop");
  const submitted = JSON.parse(fetchMock.mock.calls.find(([url]) => url.endsWith("/quote"))[1].body);
  expect(submitted).toMatchObject({ fulfillment: "delivery", delivery_zone_id: "__delivery_service__" });
  expect(screen.getByText("Delivery fee charged by shop")).toBeInTheDocument();
});

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL() { return "blob:payment-preview"; }
    static revokeObjectURL() {}
  });
  localStorage.clear();
  sessionStorage.clear();
  window.location.hash = "/store/test/checkout";
  window.scrollTo = vi.fn();
  saveCart({
    slug: "test",
    name: "Test",
    origin: "storefront",
    items: [{ id: 1, name: "Rice", quantity: 1 }],
  });
});

it('pulls fresh shop data without remounting checkout or clearing buyer fields', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ display_name: 'Test', accepting_orders: true, currency: 'Ks', payment_methods: [{ id: 'cash', name: 'Cash', type: 'cash' }], delivery_zones: [] }) }));
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  const name = await screen.findByLabelText('Your name');
  fireEvent.change(name, { target: { value: 'Keep buyer draft' } });
  fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0912345678' } });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  const shell = screen.getByRole('region', { name: 'Pull to refresh page' });
  const reads = fetchMock.mock.calls.length;
  fireEvent.touchStart(shell, { touches: [{ clientX: 10, clientY: 10 }] });
  fireEvent.touchMove(shell, { touches: [{ clientX: 10, clientY: 190 }], cancelable: true });
  fireEvent.touchEnd(shell);
  await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(reads));
  await waitFor(() => expect(shell).toHaveAttribute('aria-busy', 'false'));
  expect(screen.getByLabelText('Your name')).toBe(name);
  expect(name).toHaveValue('Keep buyer draft');
  expect(screen.getByLabelText('Phone number')).toHaveValue('0912345678');
  expect(readCarts()[0].items[0].quantity).toBe(1);
});

it.each(["attached", "omitted", "upload fails", "checkout response lost", "no receiving account"])("places an order safely with the optional screenshot scenario: %s", async (scenario) => {
  const quote = { items: [{ product_id: 1, name: "Rice", quantity: 1, unit_name: "Bag", line_total: 1000 }],
    subtotal: 1000, delivery_fee: 0, total: 1000, currency: "Ks", quote_hash: "a".repeat(64) };
  const method = scenario === "no receiving account" ? { id: "cash", name: "Cash", type: "cash", provider: "manual" }
    : { id: "bank", name: "Bank", type: "transfer", provider: "manual" };
  const uploaded = ["attached", "checkout response lost", "no receiving account"].includes(scenario);
  const submissions = [];
  const order = { ...quote, reference: "O-OPTIONAL", status: "pending", payment_status: uploaded ? "proof_submitted" : "unpaid",
    payment_method: method, payment_reviews: uploaded ? [{ id: 1, status: "pending" }] : [] };
  const fetchMock = vi.fn(async (url, options) => {
    let data;
    if (url.endsWith("/stores/test")) data = { display_name: "Test", accepting_orders: true, payment_methods: [method], delivery_zones: [] };
    else if (url.endsWith("/quote")) data = quote;
    else if (url.endsWith("/checkout")) {
      submissions.push(options.body);
      if (scenario === "checkout response lost" && submissions.length === 1) throw new Error("Connection lost");
      data = { reference: order.reference, tracking_credential: "c".repeat(64) };
    }
    else if (url.endsWith("/proofs")) {
      expect(options.body).toBeInstanceOf(FormData);
      expect(options.body.get("reference")).toBe(order.reference);
      expect(options.body.get("credential")).toBe("c".repeat(64));
      expect(options.body.get("proof").name).toBe("receipt.png");
      if (scenario === "upload fails") throw new Error("Connection lost");
      data = { ok: true };
    } else if (url.endsWith("/tracking")) data = order;
    else throw new Error("Unexpected request");
    return { ok: true, json: async () => data };
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  await screen.findByLabelText("Your name");
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Buyer" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "09000000" } });
  const file = new File(["receipt"], "receipt.png", { type: "image/png" });
  if (scenario !== "omitted") fireEvent.change(screen.getByLabelText("Payment screenshot (optional)"), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Review order" }));
  fireEvent.click(await screen.findByRole("button", { name: "Place order" }));
  if (scenario === "checkout response lost") fireEvent.click(await screen.findByRole("button", { name: "Retry submission" }));
  await screen.findByRole("heading", { name: order.reference });
  expect(submissions).toHaveLength(scenario === "checkout response lost" ? 2 : 1);
  if (scenario === "checkout response lost") expect(submissions[0]).toBe(submissions[1]);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/proofs"))).toHaveLength(scenario === "omitted" ? 0 : 1);
  expect(sessionStorage.getItem("mkpos.shop.pending.test")).toBeNull();
  expect(JSON.parse(sessionStorage.getItem("mkpos.shop.tracking")).reference).toBe(order.reference);
  if (scenario === "upload fails") {
    expect(screen.getByText(/Your order was placed, but the screenshot upload could not be confirmed/)).toBeInTheDocument();
    expect(screen.getByLabelText("Payment proof (JPG, PNG or WebP, up to 2 MB)")).toBeInTheDocument();
  }
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([false, true])('keeps Review mounted through submission and safely hands off the confirmed order (detail read fails: %s)', async readFails => {
  const method = { id: 'bank', name: 'Bank', type: 'transfer', provider: 'manual' };
  const quote = { items: [{ product_id: 1, name: 'Rice', quantity: 1, unit_name: 'Bag', line_total: 1000 }],
    subtotal: 1000, delivery_fee: 0, total: 1000, currency: 'Ks', quote_hash: 'a'.repeat(64) };
  const order = { ...quote, reference: 'O-SINGLE-STATE', status: 'pending', payment_status: 'proof_submitted',
    payment_method: method, payment_reviews: [{ id: 1, status: 'pending' }] };
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const checkout = deferred(), proof = deferred(), tracking = deferred();
  const response = data => ({ ok: true, json: async () => data });
  let trackingReads = 0;
  const fetchMock = vi.fn(url => {
    if (url.endsWith('/stores/test')) return Promise.resolve(response({ display_name: 'Test', accepting_orders: true, payment_methods: [method], delivery_zones: [] }));
    if (url.endsWith('/quote')) return Promise.resolve(response(quote));
    if (url.endsWith('/checkout')) return checkout.promise;
    if (url.endsWith('/proofs')) return proof.promise;
    if (url.endsWith('/tracking')) return ++trackingReads === 1 ? tracking.promise : Promise.resolve(response(order));
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await screen.findByLabelText('Your name');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Buyer' } });
  fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '09000000' } });
  fireEvent.change(screen.getByLabelText('Payment screenshot (optional)'), { target: { files: [new File(['receipt'], 'receipt.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Review order' }));
  const place = await screen.findByRole('button', { name: 'Place order' });
  const summary = place.closest('.order-summary');
  const submittedName = screen.getByLabelText('Your name');
  fireEvent.click(place);
  fireEvent.click(place);
  const expectSubmitting = () => {
    expect(screen.getByRole('button', { name: 'Placing order…' })).toBe(place);
    expect(place).toBeDisabled();
    expect(summary).toBeVisible();
    expect(screen.queryByText('Finish your order')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry submission' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-page-loading]')).toBeNull();
  };
  expectSubmitting();
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/checkout'))).toHaveLength(1);
  await act(async () => checkout.resolve(response({ reference: order.reference, tracking_credential: 'c'.repeat(64) })));
  expectSubmitting();
  await act(async () => proof.resolve(response({ ok: true })));
  expectSubmitting();
  expect(sessionStorage.getItem('mkpos.shop.pending.test')).not.toBeNull();
  await act(async () => tracking.resolve(readFails ? { ok: false, status: 503, json: async () => ({ message: 'Temporarily unavailable' }) } : response(order)));
  await screen.findByRole('heading', { name: order.reference });
  expect(document.querySelector('[data-page-loading]')).toBeNull();
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/tracking'))).toHaveLength(readFails ? 2 : 1);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/checkout'))).toHaveLength(1);
  expect(sessionStorage.getItem('mkpos.shop.pending.test')).toBeNull();
  expect(readCarts()).toEqual([]);
  await waitFor(() => expect(submittedName).toHaveValue(''));
});

it('reviews a coupon, displays the discount, and preserves its code on a safe checkout retry', async () => {
  const writes = [], reviews = [];
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    if (url.includes('/quote')) {
      reviews.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ items: [{ product_id: 1, name: 'Rice', quantity: 1, unit_name: 'Bag', line_total: 800 }],
        subtotal: 800, discount: 80, delivery_fee: 0, total: 720, currency: 'Ks', quote_hash: 'a'.repeat(64),
        promotions: [{ id: 10, type: 'flash_sale', name: 'Rice sale', discount: 200 }, { id: 11, type: 'coupon', name: 'Welcome', code: 'WELCOME', discount: 80 }] }) };
    }
    if (url.includes('/checkout')) { writes.push(options.body); throw new Error('Connection lost'); }
    return { ok: true, json: async () => ({ slug: 'test', display_name: 'Test', accepting_orders: true,
      payment_methods: [{ id: 'cash', name: 'Cash', type: 'cash' }], delivery_zones: [] }) };
  }));
  render(<App />);
  await screen.findByLabelText('Your name');
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Buyer' } });
  fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '099999999' } });
  fireEvent.change(screen.getByLabelText('Coupon code (optional)'), { target: { value: 'welcome' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Review order' }));
  await screen.findByText('Coupon WELCOME');
  expect(screen.getByText('−80 Ks')).toBeInTheDocument();
  expect(screen.getByText('720 Ks')).toBeInTheDocument();
  expect(screen.getByText(/Flash sale.*Rice sale/)).toBeInTheDocument();
  expect(reviews[0].coupon_code).toBe('WELCOME');
  fireEvent.click(screen.getByRole('button', { name: 'Place order' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry submission' }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[0]).toBe(writes[1]);
  expect(JSON.parse(writes[0]).coupon_code).toBe('WELCOME');
});

it('shows the sale price and limits additional cart quantity to the remaining flash-sale allowance', async () => {
  window.location.hash = '/store/test/products/1';
  saveCart(null);
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: true, json: async () => url.includes('/reviews') ? { items: [], has_more: false, summary: { count: 0, average: null } } : url.includes('/products/1') ? {
    id: 1, name: 'Flash rice', unit_name: 'Bag', currency: 'Ks', store_slug: 'test', store_name: 'Test', price: 800, original_price: 1000,
    available_quantity: 5, flash_sale: { id: 10, name: 'Rice sale', remaining_quantity: 0.5, ends_at: '2026-10-09T12:00:00Z' },
  } : {} })));
  render(<App />);
  await screen.findByText('Flash rice');
  expect(screen.getByText('1,000 Ks', { selector: 'del' })).toBeInTheDocument();
  expect(screen.getByText(/Flash sale.*Rice sale/)).toBeInTheDocument();
  const quantity = screen.getByLabelText('Quantity');
  expect(quantity).toHaveAttribute('max', '0.5');
  fireEvent.change(quantity, { target: { value: '0.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
  expect(readCarts()[0].items[0].quantity).toBe(0.5);
});
it("requires the original customer account before retrying a pending signed-in order", async () => {
  const payload = { idempotency_key: "saved-key", customer_name: "Buyer" };
  sessionStorage.setItem("mkpos.shop.pending.test", JSON.stringify(payload));
  sessionStorage.setItem("mkpos.shop.pending.test.customer", "42");
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry submission" }));
  await screen.findByText("Sign in to the account used for this order before retrying.");
  expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/checkout"))).toBe(false);
  expect(JSON.parse(sessionStorage.getItem("mkpos.shop.pending.test"))).toEqual(payload);
});

it("preserves the exact submission and checkout key when the response is lost", async () => {
  const submissions = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      if (url.endsWith("/stores/test"))
        return {
          ok: true,
          json: async () => ({
            display_name: "Test",
            accepting_orders: true,
            payment_methods: [{ id: "cash", name: "Cash" }],
            delivery_zones: [],
          }),
        };
      if (url.endsWith("/quote"))
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                product_id: 1,
                name: "Rice",
                quantity: 1,
                unit_name: "Bag",
                line_total: 1000,
              },
            ],
            subtotal: 1000,
            delivery_fee: 0,
            total: 1000,
            currency: "Ks",
            quote_hash: "a".repeat(64),
          }),
        };
      if (url.endsWith("/checkout")) {
        submissions.push(options.body);
        throw new Error("Connection lost");
      }
      throw new Error("Unexpected request");
    }),
  );
  render(<App />);
  await screen.findByLabelText("Your name");
  fireEvent.change(screen.getByLabelText("Your name"), {
    target: { value: "Test buyer" },
  });
  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "000000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Review order" }));
  fireEvent.click(await screen.findByRole("button", { name: "Place order" }));
  await screen.findByRole("button", { name: "Retry submission" });
  fireEvent.click(screen.getByRole("button", { name: "Retry submission" }));
  await waitFor(() => expect(submissions).toHaveLength(2));
  expect(submissions[1]).toBe(submissions[0]);
  expect(JSON.parse(submissions[0]).idempotency_key).toBeTruthy();
  expect(localStorage.getItem("mkpos.shop.cart.v1")).toContain("Rice");
});
