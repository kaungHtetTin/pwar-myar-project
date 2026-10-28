import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ProductsScreen } from './ProductsScreen';
import { RetainedViews } from '../navigation/RetainedViews';
import { PageRouteContext } from '../navigation/pageRefresh';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('./ProductBarcodeScanner', () => ({
  ProductBarcodeScanner: ({ open, onClose, onDetected, title = 'Scan product barcode' }) => open ? (
    <div role="dialog" aria-label={title}>
      <button type="button" onClick={() => onDetected('8851001')}>Return scanned barcode</button>
      <button type="button" onClick={onClose}>Cancel scan</button>
    </div>
  ) : null,
}));
vi.mock('./ProductPhotoCamera', () => ({
  ProductPhotoCamera: ({ open, onClose, onCapture }) => open ? (
    <div role="dialog" aria-label="Take product photo">
      <button type="button" onClick={() => onCapture(new File(['camera-photo'], 'camera.jpg', { type: 'image/jpeg' }))}>Capture photo</button>
      <button type="button" onClick={onClose}>Cancel camera</button>
    </div>
  ) : null,
}));
vi.mock('./productPhoto', () => ({
  PRODUCT_PHOTO_ACCEPT: 'image/jpeg,image/png,image/webp',
  cropProductPhoto: vi.fn(async () => new File(['small-photo'], 'product-photo.jpg', { type: 'image/jpeg' })),
}));

const session = {
  user: { id: 1, name: 'Owner', email: 'owner@example.com', role: 'owner' },
  business: { id: 3, name: 'Mobile Shop' },
};

const product = {
  id: 10,
  name: 'Drinking Water',
  sku: 'WATER-1',
  barcode: '8851001',
  category: 'Drinks',
  base_unit: 'Piece',
  purchase_unit: 'Carton',
  purchase_conversion_factor: 24,
  price: 1000,
  cost: 700,
  stock: 4,
  low_stock_threshold: 5,
  prices: [{ name: 'Retail', price: 1000, is_manual: true }],
};

function productApi(path, options = {}) {
  if (path === '/products/marketplace-categories') return Promise.resolve({items:[{id:7,path:'Food / Drinks',name_en:'Drinks',effective_active:true}]});
  if (path === '/products/barcode/8851001') return Promise.resolve(product);
  if (path.startsWith('/products?') && !path.includes('stock_status=')) return Promise.resolve({ items: [product], total: 1 });
  if (path === '/categories') return Promise.resolve(['Drinks']);
  if (path === '/products/summary') return Promise.resolve({ total_products: 1, total_stock_units: 4, low_stock: 1, out_of_stock: 0 });
  if (path === '/price-types') return Promise.resolve({ items: ['Retail'], rules: [{ name: 'Retail', pricing_mode: 'manual' }] });
  if (path === '/products/10' && !options.method) return Promise.resolve(product);
  if (path === '/products/10/stock-movements') return Promise.resolve([]);
  if (path.startsWith('/products/10/adjust-stock')) return Promise.resolve({ ...product, stock: 6 });
  if (path === '/products' && options.method === 'POST') return Promise.resolve({ ...product, id: 11 });
  return Promise.resolve([]);
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:product-photo') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  apiRequest.mockReset();
  apiRequest.mockImplementation(productApi);
});

describe('mobile products workspace', () => {
  function RetainedProductsWorkspace() {
    const [pathname, setPathname] = useState('/products');
    return <RetainedViews activeKey={pathname}><PageRouteContext.Provider value={pathname}><ProductsScreen pathname={pathname} onNavigate={setPathname} session={session} /></PageRouteContext.Provider></RetainedViews>;
  }

  it.each([false, true])('clears the retained creation form and wizard after saving (photo failure: %s)', async (photoFails) => {
    apiRequest.mockImplementation((path, options) => {
      if (path === '/products/11/photo') return photoFails ? Promise.reject(new Error('Photo upload failed')) : Promise.resolve({});
      return productApi(path, options);
    });
    render(<RetainedProductsWorkspace />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search products' }), { target: { value: 'Water' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Water'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'Saved product' } });
    fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'SAVED-SKU' } });
    fireEvent.change(screen.getByLabelText('Barcode'), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText('Base unit'), { target: { value: 'bottle' } });
    fireEvent.change(screen.getByLabelText('Choose product photo'), { target: { files: [new File(['source'], 'source.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await screen.findByAltText('Product preview');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Current stock quantity'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Average purchase cost per bottle'), { target: { value: '700' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Retail price'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByRole('textbox', { name: 'Search products' })).toHaveValue('Water');
    expect(apiRequest.mock.calls.filter(([path, options]) => path === '/products' && options?.method === 'POST')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByLabelText('Product name')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Basic information' })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByLabelText('SKU')).toHaveValue('');
    expect(screen.getByLabelText('Barcode')).toHaveValue('');
    expect(screen.getByLabelText('Base unit')).toHaveValue('Unit');
    expect(screen.queryByAltText('Product preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Current stock quantity')).toHaveValue(0);
    expect(screen.getByLabelText('Average purchase cost per Unit')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Retail price')).toHaveValue('0');
  });

  it('preserves a failed product submission and retries the same draft', async () => {
    let attempts = 0;
    apiRequest.mockImplementation((path, options) => {
      if (path === '/products' && options?.method === 'POST' && attempts++ === 0) return Promise.reject(new Error('Save failed'));
      return productApi(path, options);
    });
    render(<RetainedProductsWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'Retry product' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Retail price'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await screen.findByText('Save failed');
    expect(screen.getByLabelText('Retail price')).toHaveValue('1,500');
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await screen.findByRole('button', { name: 'Add product' });
    const submissions = apiRequest.mock.calls.filter(([path, options]) => path === '/products' && options?.method === 'POST');
    expect(submissions).toHaveLength(2);
    expect(JSON.parse(submissions[1][1].body)).toEqual(JSON.parse(submissions[0][1].body));
  });

  it.each(['Cancel', 'Back to products'])('preserves an unsaved draft and source inventory on %s', async (control) => {
    render(<RetainedProductsWorkspace />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search products' }), { target: { value: 'Water' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Water'))).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'Unsaved product' } });
    const inventoryCalls = () => apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?')).length;
    const beforeBack = inventoryCalls();
    fireEvent.click(screen.getByRole('button', { name: control, exact: true }));
    expect(await screen.findByRole('textbox', { name: 'Search products' })).toHaveValue('Water');
    expect(inventoryCalls()).toBe(beforeBack);
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(await screen.findByLabelText('Product name')).toHaveValue('Unsaved product');
    expect(inventoryCalls()).toBe(beforeBack);
  });

  it('retains the source search and loaded inventory when returning from import without a mutation', async () => {
    function Workspace() {
      const [pathname, setPathname] = useState('/products');
      return <RetainedViews activeKey={pathname}><PageRouteContext.Provider value={pathname}><ProductsScreen pathname={pathname} onNavigate={setPathname} session={session} /></PageRouteContext.Provider></RetainedViews>;
    }
    render(<Workspace />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Search products' }), { target: { value: 'Water' } });
    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('q=Water'))).toBe(true));
    const inventoryCalls = () => apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?')).length;
    const before = inventoryCalls();
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    await screen.findByRole('heading', { name: 'Import products' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to products' })[0]);
    expect(await screen.findByRole('textbox', { name: 'Search products' })).toHaveValue('Water');
    expect(screen.getByRole('heading', { name: 'Drinking Water' })).toBeInTheDocument();
    expect(inventoryCalls()).toBe(before);
  });

  it('opens the dedicated CSV import page and returns to products', async () => {
    render(<ProductsScreen session={session} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    await screen.findByRole('heading', { name: 'Import products' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Product CSV file')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to products' })[0]);
    await screen.findByRole('heading', { name: 'Drinking Water' });
  });

  it('waits for configured pricing rules before initializing a directly opened new form', async () => {
    let resolveRules;
    apiRequest.mockImplementation((path, options) => path === '/price-types' ? new Promise(resolve => { resolveRules = resolve; }) : productApi(path, options));
    render(<ProductsScreen pathname="/products/new" session={session} />);
    expect(screen.queryByLabelText('Product name')).not.toBeInTheDocument();
    await waitFor(() => expect(resolveRules).toBeTypeOf('function'));
    resolveRules({ items: ['Retail', 'Wholesale'], rules: [{ name: 'Wholesale', pricing_mode: 'automatic', markup_percent: 20, rounding: 100 }] });
    fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'Configured product' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Average purchase cost per Unit'), { target: { value: '14000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Wholesale pricing mode')).toHaveValue('automatic');
    expect(screen.getByLabelText('Wholesale price')).toHaveValue('16,800');
    expect(screen.getByLabelText('Markup on cost')).toHaveAttribute('readonly');
  });

  it('saves the supported product description through the existing edit contract', async () => {
    render(<ProductsScreen pathname="/products/10/edit" session={session} />);
    fireEvent.change(await screen.findByLabelText('Description (optional)'), { target: { value: '  Product description  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products/10', expect.objectContaining({ method: 'PUT' })));
    const payload = JSON.parse(apiRequest.mock.calls.find(([path, options]) => path === '/products/10' && options?.method === 'PUT')[1].body);
    expect(payload).toMatchObject({ online_description: 'Product description', sku: 'WATER-1', stock: 4, purchase_conversion_factor: 24 });
  });

  it('guards duplicate product submissions and disables editing while a save is in flight', async () => {
    let resolveSave;
    const navigate = vi.fn();
    apiRequest.mockImplementation((path, options) => path === '/products' && options?.method === 'POST' ? new Promise(resolve => { resolveSave = resolve; }) : productApi(path, options));
    render(<ProductsScreen pathname="/products/new" session={session} onNavigate={navigate} />);
    fireEvent.change(await screen.findByLabelText('Product name'), { target: { value: 'Single submission' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    const form = screen.getByRole('button', { name: 'Save product' }).closest('form');
    fireEvent.submit(form); fireEvent.submit(form);
    expect(apiRequest.mock.calls.filter(([path, options]) => path === '/products' && options?.method === 'POST')).toHaveLength(1);
    expect(screen.getByLabelText('Retail price')).toBeDisabled();
    resolveSave({ ...product, id: 11 });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/products', { back: true }));
  });
  it('loads inventory summary and renders touch-friendly product cards', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Drinking Water' })).toBeInTheDocument();
    expect(screen.getByText('4 Low stock')).toBeInTheDocument();
    expect(screen.getByText('WATER-1')).toBeInTheDocument();
    expect(screen.getByText('Low stock items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Drinking Water' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('opens the camera scanner and searches by the decoded barcode', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });

    fireEvent.click(screen.getByRole('button', { name: 'Scan product barcode' }));
    expect(screen.getByRole('dialog', { name: 'Scan product barcode' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return scanned barcode' }));

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search products' })).toHaveValue('8851001'));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products/barcode/8851001', expect.objectContaining({ signal: expect.any(AbortSignal) })));
    expect(screen.queryByRole('dialog', { name: 'Scan product barcode' })).not.toBeInTheDocument();
  });

  it('keeps the current product search when barcode scanning is cancelled', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), { target: { value: 'water' } });

    fireEvent.click(screen.getByRole('button', { name: 'Scan product barcode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel scan' }));

    expect(screen.getByRole('textbox', { name: 'Search products' })).toHaveValue('water');
    expect(screen.queryByRole('dialog', { name: 'Scan product barcode' })).not.toBeInTheDocument();
  });

  it('creates a product with the existing API contract', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    expect(screen.getByRole('heading', { name: 'New product' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'New Product' } });
    await screen.findByRole('option', {name:'Food / Drinks'});
    fireEvent.change(screen.getByLabelText('Marketplace category (optional)'), {target:{value:'7'}});
    expect(screen.queryByLabelText('Cost')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Basic information' }).querySelector('svg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Selling price' })).toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([path, options]) => path === '/products' && options?.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByLabelText('Retail price'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products', expect.objectContaining({ method: 'POST' })));
    expect(JSON.parse(apiRequest.mock.calls.find(([path, options])=>path==='/products'&&options?.method==='POST')[1].body)).toMatchObject({marketplace_category_id:7,marketplace_category_version:0});
  });

  it('clears a marketplace link explicitly while preserving the shop category', async()=>{
    apiRequest.mockImplementation((path,options)=>path==='/products/10'&&!options?.method?Promise.resolve({...product,marketplace_category_id:7,marketplace_category_version:3,marketplace_category:{id:7,path:'Food / Drinks'}}):productApi(path,options));
    render(<ProductsScreen pathname="/products/10/edit" session={session}/>);
    await screen.findByRole('option',{name:'Food / Drinks'});
    await waitFor(()=>expect(screen.getByLabelText('Marketplace category (optional)')).toHaveValue('7'));
    fireEvent.change(screen.getByLabelText('Marketplace category (optional)'),{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.click(screen.getByRole('button',{name:'Continue'}));fireEvent.click(screen.getByRole('button',{name:'Save product'}));
    await waitFor(()=>expect(apiRequest.mock.calls.some(([path,options])=>path==='/products/10'&&options?.method==='PUT')).toBe(true));
    expect(JSON.parse(apiRequest.mock.calls.find(([path, options])=>path==='/products/10'&&options?.method==='PUT')[1].body)).toMatchObject({category:'Drinks',marketplace_category_id:null,marketplace_category_version:3});
  });

  it('scans a barcode into the create product form without losing other form values', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Scanned Product' } });

    fireEvent.click(screen.getByRole('button', { name: 'Scan barcode for product' }));
    expect(screen.getByRole('dialog', { name: 'Scan barcode' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Return scanned barcode' }));

    expect(screen.getByLabelText('Barcode')).toHaveValue('8851001');
    expect(screen.getByLabelText('Product name')).toHaveValue('Scanned Product');
    expect(screen.queryByRole('dialog', { name: 'Scan barcode' })).not.toBeInTheDocument();
  });

  it('crops and uploads a product photo after creating the product', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Photo Product' } });
    fireEvent.change(screen.getByLabelText('Choose product photo'), { target: { files: [new File(['source'], 'source.png', { type: 'image/png' })] } });
    expect(screen.getByRole('dialog', { name: 'Crop product photo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await waitFor(() => expect(screen.getByAltText('Product preview')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Retail price'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    await waitFor(() => expect(apiRequest.mock.calls.some(([path, options]) => path === '/products/11/photo' && options?.body instanceof FormData)).toBe(true));
  });

  it('offers rear-camera capture and sends the captured photo through the crop flow', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    expect(screen.getByRole('dialog', { name: 'Take product photo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Capture photo' }));

    expect(screen.getByRole('dialog', { name: 'Crop product photo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo' }));
    await waitFor(() => expect(screen.getByAltText('Product preview')).toBeInTheDocument());
  });

  it('moves backward through the product wizard without losing entered values', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.click(screen.getByRole('button', { name: 'Add product' }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Remember me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Current stock quantity'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));

    expect(screen.getByLabelText('Product name')).toHaveValue('Remember me');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByLabelText('Current stock quantity')).toHaveValue(12);
  });

  it('opens stock history and submits a non-zero adjustment', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Drinking Water' }));
    expect(screen.getByRole('dialog', { name: 'Product actions' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stock' }));
    expect(screen.getByRole('heading', { name: 'Stock adjustment' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Drinking Water' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Adjustment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Movement history' })).toBeInTheDocument();
    const saveButton = screen.getByRole('button', { name: 'Save adjustment' });
    const adjustmentInput = screen.getByRole('spinbutton', { name: /Adjustment quantity/ });
    expect(saveButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Remove stock/ }));
    fireEvent.change(adjustmentInput, { target: { value: '5' } });
    expect(screen.getByText(/Final quantity cannot be below zero/)).toBeInTheDocument();
    expect(saveButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Add stock/ }));
    fireEvent.change(adjustmentInput, { target: { value: '2' } });
    expect(screen.getByText('Final quantity: 6 Piece')).toBeInTheDocument();
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/products/10/adjust-stock?quantity=2', { method: 'POST' }));
  });

  it('offers individual barcode printing from the product actions', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Drinking Water' }));

    expect(screen.getByRole('dialog', { name: 'Product actions' })).toHaveClass('mobile-sheet--action-menu');
    expect(document.querySelector('.mobile-action-menu')).toBeInTheDocument();
    const printButton = screen.getByRole('button', { name: 'Print barcode' });
    expect(printButton).toBeEnabled();
    expect(printButton).toHaveTextContent('Print a label for this product');
  });

  it('selects barcode products before bulk printing', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });

    fireEvent.click(screen.getByRole('button', { name: 'Select and print barcodes' }));

    expect(screen.getByRole('dialog', { name: 'Print barcodes' })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Select Drinking Water' })).toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([path]) => path.includes('has_barcode=true'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Print selected (0)' })).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Drinking Water' }));
    expect(screen.getByRole('button', { name: 'Print selected (1)' })).toBeEnabled();
  });

  it('loads an edit route directly without opening a modal', async () => {
    render(<ProductsScreen pathname="/products/10/edit" onNavigate={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Edit product' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/products/10', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('applies stock filters through the paginated products endpoint', async () => {
    render(<ProductsScreen session={session} onLoggedOut={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Drinking Water' });
    const filterToggle = screen.getByRole('button', { name: 'Filters' });
    for (const name of ['Import CSV', 'Select and print barcodes']) {
      const action = screen.getByRole('button', { name });
      expect(action.closest('header')).not.toBeNull();
      expect(action).toHaveTextContent('');
      expect(action.querySelector('svg')).not.toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Tools' })).not.toBeInTheDocument();
    expect(filterToggle).toHaveClass('product-toolbar-toggle');
    expect(filterToggle).toHaveAttribute('aria-expanded', 'false');


    fireEvent.click(filterToggle);
    expect(filterToggle).toHaveAttribute('aria-expanded', 'true');
    expect(filterToggle).toHaveClass('is-active');
    fireEvent.click(screen.getByRole('radio', { name: 'Low stock', exact: true }));
    expect(apiRequest.mock.calls.some(([path]) => path.includes('stock_status=low_stock'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Apply', exact: true }));

    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('stock_status=low_stock'))).toBe(true));
  });
});


it('applies name sorting only on Apply, retains it on return, and resets it', async () => {
  const view = render(<ProductsScreen session={session} pathname="/products" />);
  await screen.findByRole('heading', { name: 'Drinking Water' });
  const sortedRequests = () => apiRequest.mock.calls.filter(([path]) => path.includes('sort=name_desc'));
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  fireEvent.click(screen.getByRole('radio', { name: 'Name Z-A' }));
  expect(sortedRequests()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  expect(screen.getByRole('radio', { name: 'Name A-Z' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Name Z-A' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply', exact: true }));
  await waitFor(() => expect(sortedRequests().length).toBeGreaterThan(0));
  expect(sortedRequests().at(-1)[0]).toContain('offset=0');
  const reads = apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?')).length;
  view.rerender(<ProductsScreen session={session} pathname="/products/new" />);
  view.rerender(<ProductsScreen session={session} pathname="/products" />);
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  expect(screen.getByRole('radio', { name: 'Name Z-A' })).toBeChecked();
  expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?'))).toHaveLength(reads);
  fireEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
  await waitFor(() => expect(apiRequest.mock.calls.filter(([path]) => path.startsWith('/products?')).at(-1)[0]).toContain('sort=name_asc'));
});
