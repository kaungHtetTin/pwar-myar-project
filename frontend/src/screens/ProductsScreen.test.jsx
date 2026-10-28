import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationProvider } from '../components/confirmations';
import { NotificationProvider } from '../components/notifications';
import { emitDataChange } from '../dataEvents';
import { renderBarcodeSvg } from '../barcodePrinting';
import { ProductRowActions, ProductsScreen } from './ProductsScreen';
import { RetainedViews } from '../components/RetainedViews';

describe('ProductsScreen layout', () => {
  it('shows newly imported products and updated totals without reloading the page', async () => {
    let imported = false, productReads = 0;
    const product = { id: 8, name: 'Imported Rice', stock: 2, prices: [{ name: 'Retail', price: 200 }] };
    const preview = { id: 'import-1', filename: 'products.csv', status: 'preview', total_rows: 1, ready: 1, imported: 0, skipped: 0, invalid: 0, failed: 0 };
    globalThis.fetch = vi.fn(async input => {
      const url = String(input);
      let result = [];
      if (url.includes('/products?')) { productReads++; result = { items: imported ? [product] : [], total: imported ? 1 : 0 }; }
      else if (url.endsWith('/products/summary')) result = { total_products: imported ? 1 : 0, total_stock_units: imported ? 2 : 0, low_stock: 0, out_of_stock: 0 };
      else if (url.endsWith('/product-imports')) result = preview;
      else if (url.endsWith('/product-imports/import-1/process')) { imported = true; result = { ...preview, status: 'completed', ready: 0, imported: 1 }; }
      return { ok: true, json: async () => result };
    });
    render(<NotificationProvider><ConfirmationProvider><ProductsScreen /></ConfirmationProvider></NotificationProvider>);
    await screen.findByText('No products found');
    fireEvent.change(screen.getByLabelText('Product CSV file'), { target: { files: [new File(['Name,Cost,Stock,Retail\nImported Rice,100,2,200'], 'products.csv')] } });
    const dialog = await screen.findByRole('dialog', { name: 'Import products' });
    await within(dialog).findByText('Client validation passed.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import', exact: true }));
    await within(dialog).findByText('Import complete.');
    await screen.findByRole('button', { name: 'Actions for Imported Rice' });
    expect(screen.getByText('Total Products').nextSibling).toHaveTextContent('1');
    const readsAfterImport = productReads;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close', exact: true }));
    expect(screen.getByText('Imported Rice')).toBeInTheDocument();
    expect(productReads).toBe(readsAfterImport);
  });

  it('opens the file selector first, reviews the selected file once, and preserves the source on Close', async () => {
    let productReads = 0;
    globalThis.fetch = vi.fn(async input => {
      const url = String(input);
      let result = [];
      if (url.includes('/products?')) { productReads++; result = { items: [{ id: 7, name: 'Valley', stock: 10, prices: [] }], total: 1 }; }
      if (url.endsWith('/products/summary')) result = { total_products: 1, total_stock_units: 10, low_stock: 0, out_of_stock: 0 };
      return { ok: true, json: async () => result };
    });
    render(<NotificationProvider><ConfirmationProvider><ProductsScreen /></ConfirmationProvider></NotificationProvider>);
    await screen.findByText('Valley');
    const search = screen.getByLabelText('Search products or scan barcode');
    fireEvent.change(search, { target: { value: 'Valley' } });
    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('q=Valley'))).toBe(true));
    const before = productReads;
    const fileInput = screen.getByLabelText('Product CSV file');
    const picker = vi.spyOn(fileInput, 'click');
    const trigger = screen.getByRole('button', { name: 'Import', exact: true });
    fireEvent.click(trigger);
    expect(picker).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Import products' })).not.toBeInTheDocument();
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(screen.queryByRole('dialog', { name: 'Import products' })).not.toBeInTheDocument();
    fireEvent.change(fileInput, { target: { files: [new File(['Name,Cost\nRice,100'], 'products.csv')] } });
    const dialog = await screen.findByRole('dialog', { name: 'Import products' });
    await within(dialog).findByText('Client validation passed.');
    expect(within(dialog).queryByLabelText('Product CSV file')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Choose another file' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close', exact: true }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(search).toHaveValue('Valley');
    expect(productReads).toBe(before);
    expect(globalThis.fetch.mock.calls.some(([url]) => String(url).includes('/product-imports'))).toBe(false);
    picker.mockRestore();
  });

  it('selects main products across pages and preserves selection on cancel and deletion failure', async () => {
    const product = { id: 7, name: 'Valley', base_unit: 'Bottle', cost: 500, stock: 10, prices: [{ name: 'Retail', price: 600 }] };
    const second = { ...product, id: 8, name: 'Tea' };
    let writes = 0, reads = 0;
    globalThis.fetch = vi.fn(async input => {
      const url = String(input);
      let data = [];
      if (url.endsWith('/products/bulk-delete')) {
        writes++;
        return { ok: writes > 1, status: writes > 1 ? 200 : 409, json: async () => writes > 1 ? { ok: true, deleted_count: 2 } : { message: 'Resolve online orders for Tea first.' } };
      }
      if (url.includes('/products?')) { reads++; data = { items: writes > 1 ? [] : url.includes('offset=0') ? [product] : [second], total: writes > 1 ? 0 : 51 }; }
      else if (url.endsWith('/products/summary')) data = { total_products: 2, total_stock_units: 20, low_stock: 0, out_of_stock: 0 };
      else if (url.endsWith('/price-types')) data = { items: [{ name: 'Retail' }] };
      return { ok: true, json: async () => data };
    });
    const ui = active => <NotificationProvider><ConfirmationProvider><RetainedViews activeKey={active}>{active === 'products' ? <ProductsScreen /> : <p>Other section</p>}</RetainedViews></ConfirmationProvider></NotificationProvider>;
    const view = render(ui('products'));
    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Valley (7)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Tea');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all products on this page' }));
    const savedReads = reads;
    view.rerender(ui('other')); view.rerender(ui('products'));
    expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
    expect(reads).toBe(savedReads);
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete selected products' });
    expect(within(dialog).getByText('Valley')).toBeInTheDocument();
    expect(writes).toBe(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(reads).toBe(savedReads);
    expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 products' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Resolve online orders');
    expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2 products' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(writes).toBe(2);
    const calls = globalThis.fetch.mock.calls.filter(([url]) => String(url).endsWith('/products/bulk-delete'));
    expect(JSON.parse(calls[0][1].body)).toEqual({ ids: [7, 8] });
    expect(calls[1][1].body).toBe(calls[0][1].body);
    expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
  });

  it('clears partial main-table selection explicitly and when product filters change', async () => {
    const products = [{ id: 7, name: 'Valley', stock: 10, prices: [] }, { id: 8, name: 'Tea', stock: 1, prices: [] }];
    globalThis.fetch = vi.fn(async input => ({ ok: true, json: async () => String(input).includes('/products?') ? { items: products, total: 2 } : String(input).endsWith('/products/summary') ? { total_products: 2, total_stock_units: 11, low_stock: 0, out_of_stock: 0 } : [] }));
    render(<NotificationProvider><ConfirmationProvider><ProductsScreen /></ConfirmationProvider></NotificationProvider>);
    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Valley (7)' }));
    expect(screen.getByRole('checkbox', { name: 'Select all products on this page' }).indeterminate).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByRole('checkbox', { name: 'Select Valley (7)' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all products on this page' }));
    expect(screen.getByText('2 selected across pages')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all products on this page' }));
    expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Valley (7)' }));
    fireEvent.change(screen.getByLabelText('Search products or scan barcode'), { target: { value: 'Tea' } });
    expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Select Tea (8)' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Tea (8)' }));
    fireEvent.click(screen.getByRole('button', { name: /Low Stock/ }));
    expect(screen.queryByRole('button', { name: /Delete selected/ })).not.toBeInTheDocument();
  });

  it('renders a scannable Code 128 graphic for barcode printing', () => {
    const markup = renderBarcodeSvg('2008934580979');

    expect(markup).toContain('<svg');
    expect(markup).toContain('<rect');
    const bars = new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('g');
    expect(bars.getAttribute('fill') || bars.style.fill).toBe('#000000');
  });

  it('groups inventory row actions into one menu', () => {
    const onAdjust = vi.fn();
    const onHistory = vi.fn();
    const onPrint = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const product = { id: 7, name: 'Valley' };
    render(<ProductRowActions product={{ ...product, barcode: '2008934580979' }} onAdjust={onAdjust} onHistory={onHistory} onPrint={onPrint} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(5);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Movement history' }));
    expect(onHistory).toHaveBeenCalledWith(expect.objectContaining(product));

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print barcode' }));
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({ id: 7, barcode: '2008934580979' }));

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit product' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining(product));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('keeps loading inside the stable inventory grid', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    const { container } = render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    const panel = container.querySelector('.product-main-panel');
    const tableViewport = container.querySelector('.product-grid-wrap');
    expect(panel?.querySelector('.product-stat-row')).toBeInTheDocument();
    expect(panel?.querySelector('.product-table-card')).toBeInTheDocument();
    expect(tableViewport).toContainElement(screen.getByRole('status'));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('keeps filters closed by default and opens them in a right drawer', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    expect(screen.queryByRole('dialog', { name: 'Product filters' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByRole('dialog', { name: 'Product filters' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search products or scan barcode' })).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.queryByLabelText('Quick scan')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('dialog', { name: 'Product filters' })).not.toBeInTheDocument();

  });

  it('uses stock metric cards as shortcuts for the main table filter', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    const lowStockShortcut = screen.getByRole('button', { name: /Low Stock/ });
    fireEvent.click(lowStockShortcut);
    expect(lowStockShortcut).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('dialog', { name: 'Low Stock Products' })).not.toBeInTheDocument();

    fireEvent.click(lowStockShortcut);
    expect(lowStockShortcut).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByLabelText('Stock status')).toHaveValue('all');
  });

  it('labels the stock row with the selected base unit', () => {
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    const { container } = render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));

    const formGrid = container.querySelector('.product-form-grid');
    const secondaryColumn = formGrid?.querySelector('.product-form-secondary');
    expect(formGrid?.children).toHaveLength(2);
    expect(formGrid?.firstElementChild).toContainElement(screen.getByText('Basic Information'));
    expect([...secondaryColumn.querySelectorAll('h3')].map((heading) => heading.textContent)).toEqual(['Stock', 'Prices']);

    expect(screen.getByLabelText('Cost / Unit')).toBeInTheDocument();
    expect(screen.getByLabelText('Stock (Unit)')).toBeInTheDocument();
    expect(screen.getByLabelText('Low stock alert (Unit)')).toBeInTheDocument();
    expect(screen.queryByText('Stored in Unit')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Base / selling unit'), { target: { value: 'Bottle' } });

    expect(screen.getByLabelText('Cost / Bottle')).toBeInTheDocument();
    expect(screen.getByLabelText('Stock (Bottle)')).toBeInTheDocument();
    expect(screen.getByLabelText('Low stock alert (Bottle)')).toBeInTheDocument();
  });

  it('can generate an internal barcode while keeping the field optional', async () => {
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      const data = url.includes('/api/products/internal-barcode')
        ? { barcode: '2012345678906' }
        : url.includes('/api/products?')
          ? { items: [], total: 0 }
          : url.includes('/api/products/summary')
            ? { total_products: 0, total_stock_units: 0, low_stock: 0, out_of_stock: 0 }
            : url.includes('/api/price-types')
              ? { items: [{ name: 'Retail' }] }
              : [];
      return { ok: true, json: async () => data };
    });
    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Product' }));
    const barcode = screen.getByLabelText('Barcode (optional)');
    expect(barcode).not.toBeRequired();
    expect(barcode).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(barcode).toHaveValue('2012345678906'));
  });

  it('updates a product in place without reloading the product list', async () => {
    let productListRequests = 0;
    const product = {
      id: 7,
      name: 'Valley',
      sku: 'VAL-1',
      barcode: '',
      category: 'Drink',
      base_unit: 'Bottle',
      purchase_unit: null,
      purchase_conversion_factor: 1,
      cost: 500,
      stock: 10,
      low_stock_threshold: 2,
      price: 600,
      prices: [{ name: 'Retail', price: 600, is_manual: true }],
    };
    globalThis.fetch = vi.fn(async (input, options = {}) => {
      const url = String(input);
      let data = [];
      if (url.includes('/api/products?')) {
        productListRequests += 1;
        data = { items: [product], total: 1 };
      } else if (url.endsWith('/api/products/7') && options.method === 'PUT') {
        data = { ...product, name: JSON.parse(options.body).name };
      } else if (url.includes('/api/products/summary')) {
        data = { total_products: 1, total_stock_units: 10, low_stock: 0, out_of_stock: 0 };
      } else if (url.includes('/api/categories')) {
        data = ['Drink'];
      } else if (url.includes('/api/price-types')) {
        data = { items: [{ name: 'Retail' }] };
      }
      return { ok: true, json: async () => data };
    });
    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit product' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Valley Water' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Product' }));

    await screen.findByText('Valley Water');
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/products/7'),
      expect.objectContaining({ method: 'PUT' }),
    ));
    expect(productListRequests).toBe(1);
  });

  it('updates adjusted stock in place and closes the modal without reloading the list', async () => {
    let productListRequests = 0;
    const product = {
      id: 7,
      name: 'Valley',
      sku: 'VAL-1',
      barcode: '',
      category: 'Drink',
      base_unit: 'Bottle',
      stock: 10,
      low_stock_threshold: 2,
      prices: [{ name: 'Retail', price: 600 }],
    };
    globalThis.fetch = vi.fn(async (input, options = {}) => {
      const url = String(input);
      let data = [];
      if (url.includes('/api/products?')) {
        productListRequests += 1;
        data = { items: [product], total: 1 };
      } else if (url.includes('/api/products/7/adjust-stock') && options.method === 'POST') {
        data = { ...product, stock: 7 };
      } else if (url.includes('/api/products/summary')) {
        data = { total_products: 1, total_stock_units: 10, low_stock: 0, out_of_stock: 0 };
      } else if (url.includes('/api/categories')) {
        data = ['Drink'];
      } else if (url.includes('/api/price-types')) {
        data = { items: [{ name: 'Retail' }] };
      }
      return { ok: true, json: async () => data };
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Adjust stock' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: /Quantity \(Bottle\)/ }), { target: { value: '-3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Adjustment' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Adjust Stock/ })).not.toBeInTheDocument());
    expect(screen.getByText('7 Bottle')).toBeInTheDocument();
    expect(screen.getByText('Total Stock Units').nextSibling).toHaveTextContent('7');
    expect(productListRequests).toBe(1);
  });

  it('loads additional stock movements when the modal is scrolled near the bottom', async () => {
    const product = { id: 7, name: 'Valley', base_unit: 'Bottle', stock: 10, low_stock_threshold: 0, prices: [] };
    const movements = Array.from({ length: 51 }, (_, index) => ({
      id: index + 1,
      created_at: `movement-${index + 1}`,
      movement_type: 'sale',
      quantity_change: -1,
      reference_type: 'sale',
    }));
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      let data = [];
      if (url.includes('/api/products?')) data = { items: [product], total: 1 };
      else if (url.includes('/stock-movements')) {
        const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset') || 0);
        data = { items: movements.slice(offset, offset + 50), total: movements.length, limit: 50, offset };
      } else if (url.includes('/api/products/summary')) data = { total_products: 1, total_stock_units: 10, low_stock: 0, out_of_stock: 0 };
      else if (url.includes('/api/categories')) data = [];
      else if (url.includes('/api/price-types')) data = { items: [{ name: 'Retail' }] };
      return { ok: true, json: async () => data };
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );
    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Movement history' }));
    expect(await screen.findByText('50 of 51 movements')).toBeInTheDocument();

    const scroller = screen.getByText('50 of 51 movements').closest('.mkpos-modal-body');
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 450, writable: true },
    });
    fireEvent.scroll(scroller);

    expect(await screen.findByText('movement-51')).toBeInTheDocument();
    expect(screen.getByText('51 of 51 movements')).toBeInTheDocument();
    expect(screen.getByText('All history loaded')).toBeInTheDocument();
  });

  it('loads additional barcode products when the selector is scrolled near the bottom', async () => {
    const listedProduct = { id: 7, name: 'Valley', barcode: '1000000000001', stock: 10, low_stock_threshold: 0, prices: [] };
    const barcodeProducts = Array.from({ length: 51 }, (_, index) => ({
      id: index + 1,
      name: `Barcode Product ${index + 1}`,
      barcode: String(2000000000000 + index),
      prices: [],
    }));
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      let data = [];
      if (url.includes('has_barcode=true')) {
        const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset') || 0);
        data = { items: barcodeProducts.slice(offset, offset + 50), total: barcodeProducts.length, limit: 50, offset };
      } else if (url.includes('/api/products?')) data = { items: [listedProduct], total: 1 };
      else if (url.includes('/api/products/summary')) data = { total_products: 1, total_stock_units: 10, low_stock: 0, out_of_stock: 0 };
      else if (url.includes('/api/categories')) data = [];
      else if (url.includes('/api/price-types')) data = { items: [{ name: 'Retail' }] };
      return { ok: true, json: async () => data };
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );
    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('button', { name: 'Print Barcode List' }));
    expect(await screen.findByText('50 of 51 products')).toBeInTheDocument();

    const scroller = screen.getByText('50 of 51 products').closest('.table-wrap');
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 450, writable: true },
    });
    fireEvent.scroll(scroller);

    expect(await screen.findByText('Barcode Product 51')).toBeInTheDocument();
    expect(screen.getByText('51 of 51 products')).toBeInTheDocument();
    expect(screen.getByText('All products loaded')).toBeInTheDocument();
  });

  it('selects every matching barcode product instead of only the first loaded page', async () => {
    const listedProduct = { id: 7, name: 'Valley', barcode: '1000000000001', stock: 10, low_stock_threshold: 0, prices: [] };
    const barcodeProducts = Array.from({ length: 104 }, (_, index) => ({
      id: index + 1,
      name: `Barcode Product ${index + 1}`,
      barcode: String(2000000000000 + index),
      prices: [],
    }));
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      let data = [];
      if (url.includes('has_barcode=true')) {
        const parsed = new URL(url, 'http://localhost');
        const offset = Number(parsed.searchParams.get('offset') || 0);
        const limit = Number(parsed.searchParams.get('limit') || 50);
        data = { items: barcodeProducts.slice(offset, offset + limit), total: barcodeProducts.length, limit, offset };
      } else if (url.includes('/api/products?')) data = { items: [listedProduct], total: 1 };
      else if (url.includes('/api/products/summary')) data = { total_products: 1, total_stock_units: 10, low_stock: 0, out_of_stock: 0 };
      else if (url.includes('/api/categories')) data = [];
      else if (url.includes('/api/price-types')) data = { items: [{ name: 'Retail' }] };
      return { ok: true, json: async () => data };
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );
    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('button', { name: 'Print Barcode List' }));
    expect(await screen.findByText('50 of 104 products')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all matching products' }));

    expect(await screen.findByRole('button', { name: 'Print Selected (104)' })).toBeInTheDocument();
    expect(screen.getByText('104 of 104 products')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select all matching products' })).toBeChecked();
  });

  it('refreshes the selected product stock after another screen changes inventory', async () => {
    let productLoadCount = 0;
    globalThis.fetch = vi.fn(async (input) => {
      const url = String(input);
      let data = {};

      if (url.includes('/api/products?')) {
        productLoadCount += 1;
        data = {
          items: [{
            id: 7,
            name: 'Valley',
            sku: '',
            barcode: '',
            category: 'Drink',
            base_unit: 'Bottle',
            purchase_unit: 'Carton',
            purchase_conversion_factor: 6,
            cost: 500,
            stock: productLoadCount === 1 ? 10 : 8,
            low_stock_threshold: 0,
            prices: [{ name: 'Retail', price: 600 }],
          }],
          total: 1,
        };
      } else if (url.includes('/api/products/summary')) {
        data = { total_products: 1, total_stock_units: 8, low_stock: 0, out_of_stock: 0 };
      } else if (url.includes('/api/products/7/stock-movements')) {
        data = [];
      } else if (url.includes('/api/categories')) {
        data = ['Drink'];
      } else if (url.includes('/api/price-types')) {
        data = { items: [{ name: 'Retail' }] };
      }

      return { ok: true, json: async () => data };
    });

    render(
      <NotificationProvider>
        <ConfirmationProvider><ProductsScreen /></ConfirmationProvider>
      </NotificationProvider>,
    );

    await screen.findByText('Valley');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Adjust stock' }));
    expect(await screen.findByText('Current stock: 10 Bottle')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Adjust Stock/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Movement History/ })).not.toBeInTheDocument();

    const quantityInput = screen.getByRole('spinbutton', { name: /Quantity \(Bottle\)/ });
    expect(screen.getByText('Final quantity').nextSibling).toHaveTextContent('10 Bottle');
    fireEvent.change(quantityInput, { target: { value: '-3' } });
    expect(screen.getByText('Final quantity').nextSibling).toHaveTextContent('7 Bottle');
    fireEvent.change(quantityInput, { target: { value: '-11' } });
    expect(screen.getByText('Final quantity cannot be below zero.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Adjustment' })).toBeDisabled();
    fireEvent.change(quantityInput, { target: { value: '' } });

    act(() => emitDataChange(['products'], 'transactions'));

    await waitFor(() => {
      expect(screen.getByText('Current stock: 8 Bottle')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Close Adjust Stock/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Valley' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Movement history' }));
    expect(await screen.findByRole('dialog', { name: /Movement History/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /Adjust Stock/ })).not.toBeInTheDocument();
  });
});


it('applies and clears product name sorting through the server query', async () => {
  globalThis.fetch = vi.fn(async input => ({ ok: true, json: async () => String(input).includes('/products?') ? { items: [], total: 0 } : String(input).endsWith('/products/summary') ? {} : [] }));
  render(<NotificationProvider><ConfirmationProvider><ProductsScreen /></ConfirmationProvider></NotificationProvider>);
  await screen.findByText('No products found');
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'name_desc' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filter' }));
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('sort=name_desc') && String(url).includes('offset=0'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('name_desc');
  fireEvent.click(screen.getByRole('button', { name: 'Clear', exact: true }));
  await waitFor(() => expect(String(fetch.mock.calls.filter(([url]) => String(url).includes('/products?')).at(-1)[0])).toContain('sort=name_asc'));
});
