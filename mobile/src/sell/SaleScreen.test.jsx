import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { LocaleProvider } from '../localization/LocaleProvider';
import { CustomerPicker, SaleScreen } from './SaleScreen';
import { printHtmlDocument } from '../utils/printing';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('../utils/printing', async importOriginal => ({ ...await importOriginal(), printHtmlDocument: vi.fn().mockResolvedValue(true) }));
vi.mock('../products/ProductBarcodeScanner.jsx', () => ({
  ProductBarcodeScanner: ({ open, onClose, onDetected, title = 'Scan product barcode' }) => open ? (
    <div role="dialog" aria-label={title}>
      <button type="button" onClick={() => onDetected('FW-1')}>Return scanned barcode</button>
      <button type="button" onClick={onClose}>Cancel scan</button>
    </div>
  ) : null,
}));

const product = {
  id: 7,
  name: 'Fast Water',
  sku: 'FW-1',
  category: 'Drinks',
  base_unit: 'Bottle',
  purchase_unit: 'Carton',
  purchase_conversion_factor: 12,
  price: 1000,
  cost: 700,
  stock: 20,
  prices: [{ name: 'Retail', price: 1000 }],
};

function saleApi(path, options = {}) {
  if (path.startsWith('/products?')) return Promise.resolve({ items: [product], total: 1 });
  if (path === '/products/barcode/FW-1') return Promise.resolve(product);
  if (path === '/categories') return Promise.resolve(['Drinks']);
  if (path === '/settings') return Promise.resolve({ price_types: 'Retail, Wholesale', payment_methods: 'Cash, KPay' });
  if (path === '/sales' && options.method === 'POST') return Promise.resolve({ id: 44, receipt_no: 'S-0044' });
  if (path === '/sales/44/receipt') return Promise.resolve({ sale: { receipt_no: 'S-0044' }, html: '<p>Receipt</p>', text: 'Receipt' });
  return Promise.resolve([]);
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  document.documentElement.lang = 'en';
  apiRequest.mockReset();
  printHtmlDocument.mockClear();
  apiRequest.mockImplementation(saleApi);
});

describe('three-step mobile sale flow', () => {
  it('reprices an existing cart and retains the selected type and alert through checkout and submission', async () => {
    const priced = { ...product, prices: [{ name: 'Retail', price: 1000 }, { name: 'Wholesale', price: 800 }] };
    apiRequest.mockImplementation((path, options) => path.startsWith('/products?') ? Promise.resolve({ items: [priced], total: 1 }) : saleApi(path, options));
    const { rerender } = render(<SaleScreen pathname="/sell" />);
    fireEvent.click(await screen.findByRole('button', { name: /Fast Water.*1,000 Ks/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Price type' }), { target: { value: 'Wholesale' } });
    await screen.findByText('Non-Retail pricing');
    expect(JSON.parse(sessionStorage.getItem('mkpos-mobile-sale-draft-v1'))).toMatchObject({ priceType: 'Wholesale', cart: [{ price_type: 'Wholesale', unit_price: 800 }] });
    rerender(<SaleScreen pathname="/sell/cart" />);
    expect(await screen.findByText('Wholesale · Bottle')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fast Water quantity'), { target: { value: '2' } });
    rerender(<SaleScreen pathname="/sell/checkout" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay full' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale (1,600 Ks)' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/sales', expect.objectContaining({ method: 'POST' })));
    const [, request] = apiRequest.mock.calls.find(([path, options]) => path === '/sales' && options?.method === 'POST');
    expect(JSON.parse(request.body).items).toEqual([{ product_id: 7, price_type: 'Wholesale', unit_price: 800, quantity: 2, foc_quantity: 0 }]);
  });

  it('keeps the cart unchanged if the selected price is unavailable', async () => {
    render(<SaleScreen pathname="/sell" />);
    fireEvent.click(await screen.findByRole('button', { name: /Fast Water.*1,000 Ks/ }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Price type' }), { target: { value: 'Wholesale' } });
    expect(await screen.findByText(/Cannot use Wholesale/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Price type' })).toHaveValue('Retail');
    expect(JSON.parse(sessionStorage.getItem('mkpos-mobile-sale-draft-v1')).cart[0]).toMatchObject({ price_type: 'Retail', unit_price: 1000 });
    expect(screen.queryByText('Non-Retail pricing')).not.toBeInTheDocument();
  });

  it('loads prices for older off-screen cart lines and retains the draft on a failed price lookup', async () => {
    sessionStorage.setItem('mkpos-mobile-sale-draft-v1', JSON.stringify({ cart: [{ product_id: 99, product_name: 'Older product', price_type: 'Retail', unit_price: 1000, quantity: 3, foc_quantity: 1 }], discount: 100, paidAmount: '500' }));
    let failing = true;
    apiRequest.mockImplementation((path, options) => path === '/products/99' ? (failing ? Promise.reject(new Error('Unavailable')) : Promise.resolve({ id: 99, prices: [{ name: 'Retail', price: 1000 }, { name: 'Wholesale', price: 800 }] })) : saleApi(path, options));
    render(<SaleScreen pathname="/sell" />);
    const price = await screen.findByRole('combobox', { name: 'Price type' });
    await screen.findByText('Fast Water');
    fireEvent.change(price, { target: { value: 'Wholesale' } });
    await screen.findByText(/Could not load the selected prices/);
    expect(price).toHaveValue('Retail');
    expect(JSON.parse(sessionStorage.getItem('mkpos-mobile-sale-draft-v1')).cart[0].unit_price).toBe(1000);
    failing = false;
    fireEvent.change(price, { target: { value: 'Wholesale' } });
    await screen.findByText('Non-Retail pricing');
    expect(JSON.parse(sessionStorage.getItem('mkpos-mobile-sale-draft-v1'))).toMatchObject({ priceType: 'Wholesale', discount: 100, paidAmount: '500', cart: [{ product_id: 99, unit_price: 800, quantity: 3, foc_quantity: 1 }] });
  });
  it('keeps a saved sale complete when receipt loading fails, and retries only the receipt', async () => {
    window.sessionStorage.setItem('mkpos-mobile-sale-draft-v1', JSON.stringify({cart:[{product_id:7,product_name:'Fast Water',quantity:2,foc_quantity:0,unit_price:1000,stock:20}],paidAmount:'2000',discount:0,paymentMethod:'Cash',customer:null}));
    let receiptFails = true;
    apiRequest.mockImplementation((path,options)=>path==='/sales/44/receipt' && receiptFails ? Promise.reject(new Error('Receipt unavailable')) : saleApi(path,options));
    render(<SaleScreen pathname="/sell/checkout" />);
    fireEvent.click(await screen.findByRole('button',{name:'Complete sale (2,000 Ks)'}));
    expect(await screen.findByRole('heading',{name:'Sale complete'})).toBeInTheDocument();
    expect(screen.getByText(/Sale saved. The receipt is unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Complete sale (2,000 Ks)'})).not.toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('mkpos-mobile-sale-draft-v1')).cart).toEqual([]);
    receiptFails = false;
    fireEvent.click(screen.getByRole('button',{name:'Print receipt'}));
    await waitFor(()=>expect(printHtmlDocument).toHaveBeenCalled());
    expect(apiRequest.mock.calls.filter(([path,options])=>path==='/sales' && options?.method==='POST')).toHaveLength(1);
    expect(apiRequest.mock.calls.filter(([path])=>path==='/sales/44/receipt')).toHaveLength(2);
  });

  it('guards a pending checkout from duplicate form submissions', async () => {
    window.sessionStorage.setItem('mkpos-mobile-sale-draft-v1', JSON.stringify({cart:[{product_id:7,product_name:'Fast Water',quantity:2,foc_quantity:0,unit_price:1000,stock:20}],paidAmount:'2000',discount:0,paymentMethod:'Cash',customer:null}));
    let resolveSave;
    apiRequest.mockImplementation((path,options)=>path==='/sales' && options?.method==='POST' ? new Promise(resolve=>{resolveSave=resolve;}) : saleApi(path,options));
    render(<SaleScreen pathname="/sell/checkout" />);
    const form = (await screen.findByRole('button',{name:'Complete sale (2,000 Ks)'})).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    expect(apiRequest.mock.calls.filter(([path,options])=>path==='/sales' && options?.method==='POST')).toHaveLength(1);
    resolveSave({id:44,receipt_no:'S-0044'});
    expect(await screen.findByRole('heading',{name:'Sale complete'})).toBeInTheDocument();
  });

  it('confirms customer and create choices explicitly without changing immediate pickers', async () => {
    const customer = {id:2,name:'Emma Wilson',phone:'091234567'};
    apiRequest.mockImplementation((path,options)=>path.startsWith('/customers?') ? Promise.resolve({items:[customer],total:1}) : saleApi(path,options));
    const onSelect=vi.fn(), onCreate=vi.fn();
    render(<CustomerPicker confirmSelection selected={null} onSelect={onSelect} onCreate={onCreate} />);
    fireEvent.click(await screen.findByRole('button',{name:/Emma Wilson/}));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Confirm selection'}));
    expect(onSelect).toHaveBeenCalledWith(customer);
    fireEvent.click(screen.getByRole('button',{name:'New customer'}));
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Confirm selection'}));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('keeps product filter choices unapplied until confirmation and discards them on close', async () => {
    render(<SaleScreen pathname="/sell" />);
    await screen.findByText('Fast Water');
    const requests=()=>apiRequest.mock.calls.filter(([path])=>path.startsWith('/products?')).length;
    const before=requests();
    fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
    fireEvent.click(screen.getByRole('radio',{name:'Drinks',exact:true}));
    expect(requests()).toBe(before);
    fireEvent.click(screen.getByRole('button',{name:'Close filters',exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
    expect(screen.getByRole('radio',{name:'All categories',exact:true})).toBeChecked();
    fireEvent.click(screen.getByRole('radio',{name:'Drinks',exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'Apply filters',exact:true}));
    await waitFor(()=>expect(apiRequest.mock.calls.some(([path])=>path.includes('category=Drinks'))).toBe(true));
  });
  it('keeps Enter submission for an exact barcode from a keyboard scanner', async () => {
    render(<SaleScreen pathname="/sell" onNavigate={vi.fn()} />);

    const quickFind = await screen.findByLabelText('Search sale products');
    fireEvent.change(quickFind, { target: { value: 'FW-1' } });
    fireEvent.submit(quickFind.closest('form'));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products/barcode/FW-1'));
    expect(screen.getByRole('button', { name: 'View cart' }).parentElement).toHaveTextContent('1 units · 1 lines');
    expect(quickFind).toHaveValue('');
  });

  it('opens the camera scanner and adds the decoded product to the cart', async () => {
    render(<SaleScreen pathname="/sell" onNavigate={vi.fn()} />);
    await screen.findByLabelText('Search sale products');

    fireEvent.click(screen.getByRole('button', { name: 'Scan product barcode' }));
    expect(screen.getByRole('dialog', { name: 'Scan barcode' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return scanned barcode' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products/barcode/FW-1'));
    expect(screen.getByRole('button', { name: 'View cart' }).parentElement).toHaveTextContent(/1 units.*1 lines/);
    expect(screen.queryByRole('dialog', { name: 'Scan barcode' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Scan product barcode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Return scanned barcode' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'View cart' }).parentElement).toHaveTextContent(/2 units.*1 lines/));
  });

  it('selects products quickly and carries the draft to the quantity page', async () => {
    const navigate = vi.fn();
    const view = render(<SaleScreen pathname="/sell" onNavigate={navigate} />);
    const productName = await screen.findByText('Fast Water');

    expect(screen.queryByRole('navigation', { name: 'Sale progress' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.click(productName.closest('button'));
    expect(screen.queryByLabelText('Selected products')).not.toBeInTheDocument();
    const quantityButton = screen.getByRole('button', { name: 'View cart' });
    expect(quantityButton.parentElement).toHaveTextContent('1 units · 1 lines');
    fireEvent.click(quantityButton);
    expect(navigate).toHaveBeenCalledWith('/sell/cart');

    view.rerender(<SaleScreen pathname="/sell/cart" onNavigate={navigate} />);
    expect(await screen.findByRole('heading', { name: 'Cart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease Fast Water' })).toHaveClass('sale-quantity-button');
    const increaseButton = screen.getByRole('button', { name: 'Increase Fast Water' });
    expect(increaseButton).toHaveClass('sale-quantity-button');
    fireEvent.click(increaseButton);
    expect(screen.getByLabelText('Fast Water quantity')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: 'Increase Fast Water free quantity' }));
    expect(screen.getByLabelText('Fast Water free quantity')).toHaveValue('1');
    expect(screen.getByText('Line total').parentElement).toHaveTextContent('2,000 Ks');
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Fast Water free quantity' }));
    expect(screen.getByLabelText('Fast Water free quantity')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to checkout' }));
    expect(navigate).toHaveBeenCalledWith('/sell/checkout');
    await waitFor(() => expect(JSON.parse(window.sessionStorage.getItem('mkpos-mobile-sale-draft-v1')).cart[0].quantity).toBe('2'));
  });

  it('shows a product-photo placeholder when no image is available', async () => {
    render(<SaleScreen pathname="/sell" onNavigate={vi.fn()} />);

    const productButton = (await screen.findByText('Fast Water')).closest('button');
    expect(productButton.querySelector('.sale-mobile-product-media')).not.toBeNull();
    expect(productButton.querySelector('.sale-mobile-product-placeholder')).not.toBeNull();
    expect(productButton.querySelector('.sale-mobile-product-photo')).toBeNull();
  });

  it('restores a draft and completes payment from the checkout-only step', async () => {
    window.sessionStorage.setItem('mkpos-mobile-sale-draft-v1', JSON.stringify({ cart: [{ product_id: 7, product_name: 'Fast Water', price_type: 'Retail', unit_price: 1000, unit_cost: 700, base_unit: 'Bottle', quantity: 2, foc_quantity: 0, stock: 20 }], discount: 0, paidAmount: '', paymentMethod: 'Cash', customer: null }));
    const onNavigate = vi.fn();
    render(<SaleScreen pathname="/sell/checkout" onNavigate={onNavigate} />);

    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    const customerField = screen.getByText('Customer').closest('.retail-checkout-panel');
    const paymentField = screen.getByRole('radiogroup', { name: 'Payment method' }).closest('.retail-checkout-panel');
    expect(screen.getByRole('heading', { name: 'Order summary' }).closest('section')).toBe(paymentField);
    expect(screen.getByLabelText('Paid amount').closest('section')).toBe(paymentField);
    expect(customerField.compareDocumentPosition(paymentField) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay full' }));
    expect(screen.getByLabelText('Paid amount')).toHaveValue('2,000');
    fireEvent.click(screen.getByRole('button', { name: 'Complete sale (2,000 Ks)' }));

    expect(await screen.findByRole('heading', { name: 'Sale complete' })).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/sales', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(window.sessionStorage.getItem('mkpos-mobile-sale-draft-v1')).cart).toEqual([]);
    const hardwareBack = new Event('mkpos:hardware-back', { cancelable: true });
    window.dispatchEvent(hardwareBack);
    expect(hardwareBack.defaultPrevented).toBe(false);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Sale complete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous sale step' }));
    expect(onNavigate).toHaveBeenCalledWith('/sell', { back: true });
    fireEvent.click(screen.getByRole('button', { name: 'Start new sale' }));
    expect(onNavigate).toHaveBeenLastCalledWith('/sell', { reset: true, replace: true });
  });

  it('completes an FOC-only sale without payment fields', async () => {
    window.sessionStorage.setItem('mkpos-mobile-sale-draft-v1', JSON.stringify({ cart: [{ product_id: 7, product_name: 'Fast Water', price_type: 'Retail', unit_price: 1000, unit_cost: 700, base_unit: 'Bottle', quantity: 0, foc_quantity: 2, stock: 20 }], discount: 0, paidAmount: '', paymentMethod: 'Cash', customer: null }));
    render(<SaleScreen pathname="/sell/checkout" onNavigate={vi.fn()} />);

    expect(await screen.findByText('FOC sale')).toBeInTheDocument();
    expect(screen.queryByLabelText('Paid amount')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Payment method')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete FOC sale' }));

    await screen.findByRole('heading', { name: 'Sale complete' });
    const saleCall = apiRequest.mock.calls.find(([path, options]) => path === '/sales' && options?.method === 'POST');
    expect(JSON.parse(saleCall[1].body)).toMatchObject({ payment_method: 'FOC', paid_amount: 0, customer_id: null });
  });

  it('renders the complete checkout interaction in Myanmar without changing API values', async () => {
    window.localStorage.setItem('mkpos.language', 'my');
    window.sessionStorage.setItem('mkpos-mobile-sale-draft-v1', JSON.stringify({ cart: [{ product_id: 7, product_name: 'Fast Water', price_type: 'Retail', unit_price: 1000, unit_cost: 700, base_unit: 'Bottle', quantity: 2, foc_quantity: 0, stock: 20 }], discount: 0, paidAmount: '', paymentMethod: 'Cash', customer: null }));
    render(<LocaleProvider><SaleScreen pathname="/sell/checkout" onNavigate={vi.fn()} /></LocaleProvider>);

    expect(await screen.findByRole('heading', { name: 'ငွေရှင်းရန်' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ငွေသား' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'ငွေသား' })).toHaveAttribute('value', 'Cash');
    fireEvent.click(screen.getByRole('button', { name: 'အပြည့်ပေးမည်' }));
    fireEvent.click(screen.getByRole('button', { name: 'အရောင်းပြီးစီးရန် (2,000 Ks)' }));

    expect(await screen.findByRole('heading', { name: 'အရောင်းပြီးမြောက်ပါပြီ' })).toBeInTheDocument();
    const saleCall = apiRequest.mock.calls.find(([path, options]) => path === '/sales' && options?.method === 'POST');
    expect(JSON.parse(saleCall[1].body)).toMatchObject({ payment_method: 'Cash', paid_amount: 2000 });
  });

  it('localizes product selection and quantity steps in Myanmar', async () => {
    window.localStorage.setItem('mkpos.language', 'my');
    const navigate = vi.fn();
    const view = render(<LocaleProvider><SaleScreen pathname="/sell" onNavigate={navigate} /></LocaleProvider>);

    expect(await screen.findByRole('heading', { name: 'အရောင်း' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fast Water').closest('button'));
    expect(screen.queryByLabelText('ရွေးထားသောကုန်ပစ္စည်းများ')).not.toBeInTheDocument();
    const quantityButton = screen.getByRole('button', { name: 'ခြင်းတောင်းကြည့်ရန်' });
    expect(quantityButton.parentElement).toHaveTextContent('1 ခု · 1 မျိုး');
    fireEvent.click(quantityButton);
    expect(navigate).toHaveBeenCalledWith('/sell/cart');

    view.rerender(<LocaleProvider><SaleScreen pathname="/sell/cart" onNavigate={navigate} /></LocaleProvider>);
    expect(await screen.findByRole('heading', { name: 'ခြင်းတောင်း' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ငွေရှင်းရန် ဆက်သွားမည်' })).toBeInTheDocument();
  });
});


it('retains applied POS name sorting through the cart and resets to A-Z', async () => {
  const view = render(<SaleScreen pathname="/sell" />);
  await screen.findByText('Fast Water');
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  fireEvent.click(screen.getByRole('radio', { name: 'Name Z-A' }));
  expect(apiRequest.mock.calls.some(([path]) => path.includes('sort=name_desc'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('sort=name_desc') && path.includes('offset=0'))).toBe(true));
  const reads = apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?')).length;
  view.rerender(<SaleScreen pathname="/sell/cart" />);
  view.rerender(<SaleScreen pathname="/sell" />);
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  expect(screen.getByRole('radio', { name: 'Name Z-A' })).toBeChecked();
  expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?'))).toHaveLength(reads);
  fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
  await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?')).at(-1)[0]).toContain('sort=name_asc'));
});
