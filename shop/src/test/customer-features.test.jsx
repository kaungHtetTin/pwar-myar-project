import React from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { request, post } from '../api';
import { BuyAgain } from '../BuyAgain';
import { AddressBook, SavedAddressPicker, ShoppingFeaturesProvider, FavoriteButton } from '../CustomerFeatures';
import { StockAlertButton } from '../ShopUpdates';
import { OrderRequests } from '../OrderRequests';
import { catalogFilterQuery, readRecent, rememberProduct, CatalogFilters } from '../ProductDiscovery';
import { receiptHtml } from '../OrderReceipt';
import { translate } from '../i18n';
const { customer, setCustomer } = vi.hoisted(() => ({ customer: { id: 1, name: 'Buyer', phone: '0912345' }, setCustomer: vi.fn() }));
vi.mock('../api', () => ({ request: vi.fn(), post: vi.fn() }));
vi.mock('../CustomerAccount', () => ({ useCustomer: () => ({ customer, setCustomer }), CustomerAuth: () => null }));
const nativeShowModal = HTMLDialogElement.prototype.showModal;
const nativeClose = HTMLDialogElement.prototype.close;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); vi.spyOn(window, 'confirm').mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); HTMLDialogElement.prototype.showModal = nativeShowModal; HTMLDialogElement.prototype.close = nativeClose; });

it('buy again keeps its preview when cart replacement is cancelled', async () => {
  post.mockResolvedValue({ slug: 'test', name: 'Test', items: [{ id: 1, name: 'Rice', price: 1200, currency: 'Ks', quantity: 1, previous_quantity: 2, unit_name: 'Bag' }], skipped: ['Tea'] });
  const onCart = vi.fn().mockReturnValue(false);
  render(<BuyAgain reference="O-1" onCart={onCart} />); fireEvent.click(screen.getByRole('button', { name: 'Buy again' }));
  await screen.findByText('Quantity adjusted to available stock', { exact: false });
  expect(screen.getByRole('dialog', { name: 'Review your repeat order' })).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: 'Use these items in my cart' }));
  expect(onCart).toHaveBeenCalledTimes(1); expect(screen.getByRole('heading', { name: 'Review your repeat order' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close repeat order' }));
  expect(screen.queryByRole('heading', { name: 'Review your repeat order' })).not.toBeInTheDocument();
});

it('buy again shows quantity-based totals and dismisses without changing the cart', async () => {
  post.mockResolvedValue({ name: 'Test Shop', items: [{ id: 1, name: 'Rice', price: 1200, currency: 'Ks', quantity: 2, previous_quantity: 2, unit_name: 'Bag' }], skipped: [] });
  const onCart = vi.fn();
  render(<BuyAgain reference="O-1" onCart={onCart} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buy again' }));
  const modal = await screen.findByRole('dialog', { name: 'Review your repeat order' });
  expect(screen.getByText('K 2,400')).toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent(modal, new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(onCart).not.toHaveBeenCalled();
});

it('buy again disables cart confirmation when every item is unavailable', async () => {
  post.mockResolvedValue({ items: [], skipped: ['Rice'] });
  render(<BuyAgain reference="O-1" onCart={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buy again' }));
  await screen.findByRole('dialog', { name: 'Review your repeat order' });
  expect(screen.getByRole('button', { name: 'Use these items in my cart' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Cancel', exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close repeat order' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('favorites reconcile after mutation and keep state on a failed unsave', async () => {
  request.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ saved: true }).mockRejectedValueOnce(new Error('Save failed'));
  render(<ShoppingFeaturesProvider><FavoriteButton slug="test" productId={1} /></ShoppingFeaturesProvider>);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Save to favorites' }));
  await screen.findByRole('button', { name: 'Remove from favorites' });
  fireEvent.click(screen.getByRole('button', { name: 'Remove from favorites' }));
  await screen.findByRole('alert'); expect(screen.getByRole('button', { name: 'Remove from favorites' })).toHaveAttribute('aria-pressed', 'true');
});

it('address save retains failed draft, retries and cancels deletion without mutation', async () => {
  const saved = { id: 1, label: 'Home', recipient: 'Buyer', phone: '0912345', address: 'Street A', is_default: true };
  request.mockResolvedValueOnce({ items: [] }).mockRejectedValueOnce(new Error('Address failed')).mockResolvedValueOnce({ items: [saved] });
  render(<AddressBook />); await screen.findByText('Save Home, Work or another delivery address.');
  fireEvent.click(screen.getByRole('button', { name: 'Add address' }));
  fireEvent.change(screen.getByLabelText('Address label'), { target: { value: 'Home' } });
  fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: 'Street A' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save address' })); await screen.findByText('Address failed');
  expect(screen.getByLabelText('Delivery address')).toHaveValue('Street A');
  fireEvent.click(screen.getByRole('button', { name: 'Save address' })); await screen.findByText('Default');
  window.confirm.mockReturnValue(false); fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(request).toHaveBeenCalledTimes(3);
});

it('retained checkout address picker reconciles account changes without refetching', async () => {
  request.mockResolvedValueOnce({ items: [] });
  const select = vi.fn(); render(<SavedAddressPicker onSelect={select} />);
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  const address = { id: 4, label: 'Work', recipient: 'Buyer', phone: '0912345', address: 'Office Road' };
  fireEvent(window, new CustomEvent('mkpos:addresses-changed', { detail: { customerId: 1, items: [address] } }));
  fireEvent.change(screen.getByLabelText('Choose a saved address'), { target: { value: '4' } });
  expect(select).toHaveBeenCalledWith(address); expect(request).toHaveBeenCalledTimes(1);
  fireEvent(window, new CustomEvent('mkpos:addresses-changed', { detail: { customerId: 2, items: [] } }));
  expect(screen.getByRole('option', { name: 'Work · Buyer' })).toBeInTheDocument();
});

it('catalog filters validate range before applying and clear resets all fields', async () => {
  const onChange = vi.fn(); const value = { sort: 'rating', in_stock: false, on_sale: false, min_price: '', max_price: '', min_rating: '' };
  render(<CatalogFilters value={value} onChange={onChange} />); fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Minimum price'), { target: { value: '1000' } }); fireEvent.change(screen.getByLabelText('Maximum price'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' })); expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Minimum price must not exceed maximum price.');
  fireEvent.click(screen.getByRole('button', { name: 'Reset' })); expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sort: 'default', min_price: '', max_price: '' }));
  expect(catalogFilterQuery({ sort: 'price_asc', in_stock: true, min_price: '' })).toBe('sort=price_asc&in_stock=1');
});

it('recent views deduplicate by shop/product, cap at 30 and separate customer scope', () => {
  for (let id = 1; id <= 35; id++) rememberProduct(1, { id, store_slug: 'test' });
  rememberProduct(1, { id: 30, store_slug: 'test' });
  expect(readRecent(1)).toHaveLength(30); expect(readRecent(1)[0].id).toBe(30); expect(readRecent(2)).toEqual([]); expect(readRecent()).toEqual([]);
});

it('stock alert enrollment and cancellation keep clear confirmation states', async () => {
  request.mockResolvedValueOnce({ active: false }).mockResolvedValueOnce({ active: true }).mockResolvedValueOnce({ active: false });
  render(<StockAlertButton product={{ id: 1, store_slug: 'test' }} />); await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Notify me when available' })); await screen.findByRole('button', { name: 'Cancel stock alert' });
  expect(screen.getByRole('status')).toHaveTextContent('Stock is not reserved.');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel stock alert' })); await screen.findByRole('button', { name: 'Notify me when available' });
});

it('order request failure retains the reason, successful retry reconciles the order', async () => {
  const order = { reference: 'O-1', status: 'pending', payment_status: 'unpaid', customer_requests: [] };
  request.mockRejectedValueOnce(new Error('Request failed')).mockResolvedValueOnce({ ...order, status: 'cancelled' });
  const onChange = vi.fn(); render(<OrderRequests order={order} credentials={{ reference: 'O-1', credential: 'secret' }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Request cancellation' })); fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Wrong quantity ordered' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' })); await screen.findByText('Request failed'); expect(screen.getByLabelText('Reason')).toHaveValue('Wrong quantity ordered');
  fireEvent.click(screen.getByRole('button', { name: 'Submit request' })); await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' })));
  expect(request.mock.calls[1][1].body.get('reason')).toBe('Wrong quantity ordered');
});

it('downloaded receipt escapes business text and excludes private tracking secrets', () => {
  const html = receiptHtml({ reference: 'O-1', credential: 'never-export', tracking_hash: 'never-export', status: 'pending', payment_status: 'unpaid', currency: 'Ks', total: 1000, items: [{ name: '<script>alert(1)</script>', quantity: 1, line_total: 1000 }], receipt: { shop_name: '<b>Shop</b>' } });
  expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('never-export'); expect(html).toContain('This order summary does not confirm payment.');
});

it('new feature titles and status copy have Myanmar translations', () => {
  for (const title of ['Buy again', 'Favorites', 'Saved addresses', 'Updates', 'Stock alerts', 'Recently viewed', 'Request cancellation', 'Request return/refund', 'Opening hours', 'Order receipt', 'Back in stock']) expect(translate('my', title)).toMatch(/[\u1000-\u109f]/);
});
