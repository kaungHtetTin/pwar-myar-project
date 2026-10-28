import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SalesActionCard } from './SalesActionCard';
import { SalesReadout } from './SalesReadout';
vi.mock('./api', () => ({ requestChatImage: vi.fn(async () => ({ blob: new Blob(['image']) })) }));
afterEach(cleanup);

it('requires a transfer screenshot review before confirming and submits order with pending proof', async () => {
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:receipt'); URL.revokeObjectURL = vi.fn();
  try {
    const transfer = { ...draft, options: { ...draft.options, payment_methods: [{ id: 'cash', name: 'Cash', type: 'cash' }, { id: 'bank', name: 'Bank transfer', type: 'transfer' }] } };
    const missing = { ...reviewed, options: transfer.options, values: { ...reviewed.values, payment_method_id: 'bank' }, preview: { ...reviewed.preview, ready: false, payment_method: { name: 'Bank transfer', type: 'transfer' }, payment_proof_required: true } };
    const attached = { ...missing, revision: 3, preview_hash: 'c'.repeat(64), has_image: true, preview: { ...missing.preview, ready: true } };
    const api = vi.fn().mockResolvedValueOnce(transfer).mockResolvedValueOnce(missing).mockResolvedValueOnce(attached)
      .mockResolvedValueOnce({ ...attached, status: 'completed', result: { order_created: true, reference: 'O-TRANSFER', payment_status: 'proof_submitted', payment_verified: false } });
    mount(api); await open(); fillCheckout();
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'bank' } });
    expect(screen.getByLabelText('Review image file')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Calculate and review quote' }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
    const file = new File(['receipt'], 'payment.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Review image file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate and review quote' }));
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    expect(api.mock.calls[2][1].body.get('image')).toBe(file);
    expect(JSON.parse(api.mock.calls[2][1].body.get('values')).payment_method_id).toBe('bank');
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }));
    await screen.findByText('Order and payment proof submitted. Awaiting shop verification.');
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

it.each([422, 429])('retains transfer fields and the selected receipt after a %s review failure and close/reopen', async status => {
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:receipt'); URL.revokeObjectURL = vi.fn();
  try {
    const transfer = { ...reviewed, options: { ...draft.options, payment_methods: [{ id: 'bank', name: 'Bank', type: 'transfer' }] }, values: { ...reviewed.values, payment_method_id: 'bank' }, preview: { ...reviewed.preview, ready: false, payment_proof_required: true } };
    const api = vi.fn().mockResolvedValueOnce(transfer).mockRejectedValueOnce(Object.assign(new Error('Please review again'), { status, retryAfterMs: status === 429 ? 45000 : undefined }));
    const cache = new Map(); const first = mount(api, summary, { cache }); await open();
    const file = new File(['receipt'], 'retry.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Review image file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate and review quote' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Close review' })); first.unmount();
    mount(api, summary, { cache }); await open();
    expect(screen.getByLabelText('Customer name')).toHaveValue('Buyer');
    expect(cache.get('proposal').file).toBe(file);
    expect(api).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

const summary = { id: 'proposal', kind: 'checkout', status: 'pending' };
const item = { product_id: 1, name: 'Soap / ဆပ်ပြာ', unit_name: 'Unit', quantity: 2, unit_price: 100, line_total: 200 };
const draft = { ...summary, revision: 1, preview_hash: 'a'.repeat(64), expires_at: '2099-01-01T00:00:00Z', preview: { items: [item], subtotal: 200, currency: 'MMK', ready: false }, values: { items: [{ product_id: 1, quantity: 2 }] }, options: { delivery_zones: [{ id: 'town', name: 'Town', fee: 500 }], payment_methods: [{ id: 'cash', name: 'Cash' }] } };
const reviewed = { ...draft, revision: 2, preview_hash: 'b'.repeat(64), preview: { ...draft.preview, ready: true, discount: 0, delivery_fee: 0, total: 200, payment_method: { name: 'Cash' } }, values: { items: draft.values.items, customer_name: 'Buyer', phone: '09999', email: null, address: null, notes: null, fulfillment: 'pickup', payment_method_id: 'cash', coupon_code: null } };
const mount = (api, action = summary, props = {}) => render(<SalesActionCard action={action} uuid="thread" basePath="/chat" apiRequest={api} {...props} />);
async function open() { fireEvent.click(screen.getByRole('button', { name: 'Review', exact: true })); await screen.findByRole('table', { name: 'Review products' }); }
function fillCheckout() {
  fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Buyer' } });
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '09999' } });
  fireEvent.change(screen.getByLabelText('Fulfillment'), { target: { value: 'pickup' } });
  fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'cash' } });
}

it('requires real checkout choices, a fresh quote and customer consent before posting once', async () => {
  let finish;
  const api = vi.fn().mockResolvedValueOnce(draft).mockResolvedValueOnce(reviewed).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  mount(api); await open();
  expect(screen.getByRole('checkbox')).toBeDisabled(); expect(screen.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
  fillCheckout(); fireEvent.click(screen.getByRole('button', { name: 'Calculate and review quote' }));
  await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
  const sent = JSON.parse(api.mock.calls[1][1].body);
  expect(sent).toMatchObject({ revision: 1, preview_hash: draft.preview_hash, values: { customer_name: 'Buyer', fulfillment: 'pickup', payment_method_id: 'cash' } });
  expect(sent.values).not.toHaveProperty('confirmed');
  fireEvent.click(screen.getByRole('checkbox'));
  const confirm = screen.getByRole('button', { name: 'Confirm order' }); fireEvent.click(confirm); fireEvent.click(confirm);
  expect(api.mock.calls.filter(([path]) => path.endsWith('/confirm'))).toHaveLength(1);
  expect(JSON.parse(api.mock.calls[2][1].body)).toEqual({ revision: 2, preview_hash: reviewed.preview_hash, confirmed: true });
  await act(async () => finish({ ...reviewed, status: 'completed', options: null, result: { order_created: true, reference: 'O-123', total: 200 } }));
  expect(screen.getByText('Order submitted. Payment is not verified.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'View order · O-123' })).toHaveAttribute('href', '#/orders/track?reference=O-123');
});

it('invalidates consent on edits and preserves the edited form when quote validation fails', async () => {
  const api = vi.fn().mockResolvedValueOnce(reviewed).mockRejectedValueOnce(new Error('Not enough available stock'));
  mount(api); await open(); fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText(`Quantity ${item.name}`), { target: { value: '7' } });
  expect(screen.getByRole('checkbox')).not.toBeChecked(); expect(screen.getByRole('button', { name: 'Confirm order' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate and review quote' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText(`Quantity ${item.name}`)).toHaveValue(7);
  expect(api.mock.calls.some(([path]) => path.endsWith('/confirm'))).toBe(false);
});

it('retains the review and draft across close and remount without an initial reload or retained consent', async () => {
  const cache = new Map(), api = vi.fn().mockResolvedValue(draft);
  const view = mount(api, summary, { cache }); await open();
  fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Retained buyer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close review' }));
  expect(screen.getByRole('button', { name: 'Review', exact: true })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Review', exact: true })); expect(api).toHaveBeenCalledTimes(1);
  view.unmount(); mount(api, summary, { cache });
  expect(screen.getByLabelText('Customer name')).toHaveValue('Retained buyer');
  expect(screen.getByRole('checkbox')).not.toBeChecked(); expect(api).toHaveBeenCalledTimes(1);
});

it('recovers completed status after a confirmation timeout without posting again', async () => {
  const api = vi.fn().mockResolvedValueOnce(reviewed).mockRejectedValueOnce(new Error('Request timed out')).mockResolvedValueOnce({ ...reviewed, status: 'completed', result: { order_created: true, reference: 'O-SAVED' } });
  mount(api); await open(); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm order' }));
  await screen.findByRole('alert'); fireEvent.click(screen.getByRole('button', { name: 'Check action status' }));
  await screen.findByText('Order submitted. Payment is not verified.');
  expect(api.mock.calls.filter(([path]) => path.endsWith('/confirm'))).toHaveLength(1);
});

it('cancels a cart proposal without a cart write and displays the cleared status', async () => {
  const cart = { ...draft, kind: 'cart', preview: { ...draft.preview, ready: true } };
  const api = vi.fn().mockResolvedValueOnce(cart).mockResolvedValueOnce({ ...cart, status: 'cancelled' });
  mount(api, { ...summary, kind: 'cart' }); await open();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel proposal' }));
  await screen.findByText('Proposal cancelled. Ask for a new proposal if needed.');
  expect(api.mock.calls.filter(([path]) => path.endsWith('/confirm'))).toHaveLength(0);
  expect(api.mock.calls.filter(([path]) => path.endsWith('/cancel'))).toHaveLength(1);
});

it('shows owner observers a status without any customer confirmation controls or calls', () => {
  const api = vi.fn(); mount(api, summary, { selfSender: 'owner' });
  expect(screen.getByText(/Customer confirmation required/)).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument(); expect(api).not.toHaveBeenCalled();
});

it('stages an uploaded receipt for review before allowing customer submission', async () => {
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  URL.createObjectURL = vi.fn(() => 'blob:review'); URL.revokeObjectURL = vi.fn();
  try {
    const proof = { ...draft, kind: 'proof', values: {}, preview: { reference: 'O-123', total: 200, currency: 'MMK', ready: false } };
    const api = vi.fn().mockResolvedValueOnce(proof).mockResolvedValueOnce({ ...proof, revision: 2, preview_hash: 'b'.repeat(64), has_image: true, preview: { ...proof.preview, ready: true } }).mockResolvedValueOnce({ ...proof, status: 'completed', result: { reference: 'O-123', payment_status: 'proof_submitted', payment_verified: false } });
    mount(api, { ...summary, kind: 'proof' });
    fireEvent.click(screen.getByRole('button', { name: 'Review', exact: true }));
    const input = await screen.findByLabelText('Review image file');
    expect(screen.getByRole('checkbox')).toBeDisabled();
    fireEvent.change(input, { target: { files: [new File(['png'], 'receipt.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Review image', exact: true }));
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    expect(api.mock.calls[1][1].body.get('revision')).toBe('1');
    expect(api.mock.calls[1][1].body.get('image').name).toBe('receipt.png');
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Submit payment proof' }));
    await screen.findByText('Payment proof submitted. Awaiting shop verification.');
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});

it('requires a new review after editing an after-sales reason', async () => {
  const change = { ...draft, kind: 'change', values: { reason: 'Please change my address', changes: { address: 'New address' } }, preview: { reference: 'O-123', reason: 'Please change my address', ready: true } };
  const api = vi.fn().mockResolvedValueOnce(change).mockResolvedValueOnce({ ...change, revision: 2 });
  mount(api, { ...summary, kind: 'change' });
  fireEvent.click(screen.getByRole('button', { name: 'Review', exact: true }));
  fireEvent.change(await screen.findByLabelText('Reason'), { target: { value: 'Please use my new delivery address' } });
  expect(screen.getByRole('button', { name: 'Submit change request' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh review' }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(JSON.parse(api.mock.calls[1][1].body).values).toEqual({ reason: 'Please use my new delivery address', changes: { address: 'New address' } });
});

it('shows public product comparisons and quotation totals without checkout approval controls', () => {
  render(<SalesReadout content={{ products: [{ id: 1, name: 'Soap', price: 100, currency: 'MMK', unit_name: 'Unit', available_quantity: 5, store_slug: 'shop' }, { id: 2, name: 'Rice', price: 200, currency: 'MMK', unit_name: 'Kg', available_quantity: 3, store_slug: 'shop' }], quote: { items: [item], subtotal: 200, discount: 0, delivery_fee: 0, total: 200, currency: 'MMK' } }} />);
  expect(screen.getByRole('table', { name: 'Product comparison' })).toBeVisible(); expect(screen.getByRole('table', { name: 'Quoted products' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Soap' })).toHaveAttribute('href', '#/store/shop/products/1');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(screen.getByText('Quotation only. No order has been placed and no stock is reserved.')).toBeVisible();
});
