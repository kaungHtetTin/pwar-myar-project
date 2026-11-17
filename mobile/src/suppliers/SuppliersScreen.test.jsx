import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { SuppliersScreen } from './SuppliersScreen';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));

const supplier = {
  id: 3,
  name: 'Green Wholesale',
  phone: '0912345678',
  contact_person: 'Mya Mya',
  address: 'Yangon',
  note: 'Deliver on Monday',
  purchase_count: 2,
  total_purchase: 45000,
  last_purchase: '2026-08-07 10:00:00',
  balance: 12000,
};

const purchase = { id: 12, created_at: '2026-08-07 10:00:00', total_cost: 25000, note: 'Weekly order' };
const supplierPayment = { id: 5, supplier_id: 3, supplier_name: supplier.name, direction: 'shop_to_supplier', payment_method: 'Cash', amount: 3000, note: 'Part payment', created_at: '2026-08-08 10:00:00' };

function supplierApi(path, options = {}) {
  if (path.startsWith('/suppliers?')) return Promise.resolve({ items: [supplier], total: 1 });
  if (path.startsWith('/suppliers/3?') && !options.method) {
    return Promise.resolve({
      supplier,
      summary: { credit_purchase_total: 15000, paid_total: 3000, refund_total: 0, balance: 12000 },
      purchases: [purchase],
      filtered_stats: { purchase_count: 1, total_purchase: 25000 },
      total: 1,
      limit: 20,
      offset: 0,
    });
  }
  if (path.startsWith('/supplier-payments?')) return Promise.resolve({ items: [supplierPayment], total: 1 });
  if (path === '/supplier-payments/5' && !options.method) return Promise.resolve(supplierPayment);
  if (path === '/suppliers/3/payments' && options.method === 'POST') return Promise.resolve({ ...supplierPayment, balance: 9000 });
  if (path === '/supplier-payments/5' && options.method === 'PUT') return Promise.resolve({ ...supplierPayment, ...JSON.parse(options.body) });
  if (path === '/supplier-payments/5' && options.method === 'DELETE') return Promise.resolve({ deleted: true });
  if (path === '/suppliers' && options.method === 'POST') return Promise.resolve(supplier);
  if (path === '/suppliers/3' && options.method === 'PUT') return Promise.resolve(supplier);
  if (path === '/suppliers/3' && options.method === 'DELETE') return Promise.resolve({ ok: true });
  return Promise.resolve({});
}

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation(supplierApi);
});

describe('mobile suppliers workspace', () => {
  it('renders the supplier directory as an endless card list', async () => {
    render(<SuppliersScreen />);

    expect(await screen.findByText('Green Wholesale')).toBeInTheDocument();
    expect(screen.getByText('Mya Mya · 0912345678')).toBeInTheDocument();
    expect(screen.queryByText('45,000 Ks')).not.toBeInTheDocument();
    expect(screen.getByText('1 suppliers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Green Wholesale' })).toBeInTheDocument();
    const supplierControls = screen.getByLabelText('Search suppliers').closest('.supplier-controls');
    expect(supplierControls).not.toContainElement(screen.getByRole('button', { name: 'Export CSV' }));
    expect(screen.getByRole('button', { name: 'Export CSV' }).closest('header')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Green Wholesale' })).not.toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/suppliers?') && path.includes('with_total=true') && path.includes('offset=0'))).toBe(true);
  });

  it('creates suppliers on a dedicated full page and validates the name', async () => {
    render(<SuppliersScreen />);
    await screen.findByText('Green Wholesale');
    fireEvent.click(screen.getByRole('button', { name: 'New supplier' }));

    expect(screen.getByRole('heading', { name: 'New supplier' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save supplier' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Supplier name is required.');

    fireEvent.change(screen.getByLabelText('Supplier name'), { target: { value: ' Green Wholesale ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save supplier' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/suppliers', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Green Wholesale'),
    })));
    expect(await screen.findByRole('heading', { name: 'Green Wholesale' })).toBeInTheDocument();
  });

  it('loads direct edit links without relying on list state', async () => {
    render(<SuppliersScreen pathname="/suppliers/3/edit" onNavigate={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Edit supplier' })).toBeInTheDocument();
    expect(screen.getByLabelText('Supplier name')).toHaveValue('Green Wholesale');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('/suppliers/3?limit=1&offset=0', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('shows supplier detail with filtered, paginated purchase history', async () => {
    const onNavigate = vi.fn();
    render(<SuppliersScreen pathname="/suppliers/3" onNavigate={onNavigate} />);

    expect(await screen.findByRole('heading', { name: 'Green Wholesale' })).toBeInTheDocument();
    expect(screen.getByText('Weekly order')).toBeInTheDocument();
    expect(screen.getAllByText('25,000 Ks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12,000 Ks').length).toBeGreaterThan(0);
    expect(apiRequest.mock.calls.some(([path]) => path.includes('/suppliers/3?') && path.includes('limit=20') && path.includes('offset=0'))).toBe(true);
    const profile = screen.getByLabelText('Supplier profile');
    const tabs = screen.getByRole('navigation', { name: 'Supplier detail sections' });
    expect(profile).toHaveTextContent('Mya Mya');
    expect(profile).toHaveTextContent('0912345678');
    expect(profile).toHaveTextContent('Yangon');
    expect(profile).toHaveTextContent('Deliver on Monday');
    expect(profile.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', {name:'Pay'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Supplier actions'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Delete supplier'}));
    expect(screen.getByRole('dialog')).toHaveTextContent('Existing purchase history will remain linked');
    fireEvent.click(screen.getByRole('button', {name:'Cancel'}));
    expect(apiRequest.mock.calls.some(([,options])=>options?.method==='DELETE')).toBe(false);
    expect(screen.getAllByRole('button', {name:'Export CSV'})).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name:'Export CSV'}));
    expect(screen.getByRole('dialog', {name:'Export supplier data'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Statement'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Export supplier purchases'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Export supplier payments'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name:'Cancel'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', {name:/Payment records/}));
    expect(await screen.findByText(/Part payment/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', {name:/Purchases/}));

    fireEvent.click(await screen.findByRole('button', { name: 'View purchase 12' }));
    expect(onNavigate).toHaveBeenCalledWith('/purchases/12', {});

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Search supplier purchase history'), { target: { value: 'weekly' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(apiRequest.mock.calls.some(([path]) => path.includes('purchase_q=weekly') && path.includes('date_from=2026-08-01') && path.includes('offset=0'))).toBe(true));
  });

  it('records a supplier payment on a dedicated full page', async () => {
    render(<SuppliersScreen pathname="/suppliers/3/payments/new" onNavigate={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'New payment' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '2000' } });
    expect(screen.getByRole('radio', {name:/Shop pays supplier/})).toBeChecked();
    fireEvent.click(screen.getByRole('radio', {name:/Supplier refunds shop/}));
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/suppliers/3/payments', expect.objectContaining({ method: 'POST', body: expect.stringContaining('2000') })));
    expect(JSON.parse(apiRequest.mock.calls.find(([path, options])=>path==='/suppliers/3/payments'&&options?.method==='POST')[1].body).direction).toBe('supplier_to_shop');
  });

  it('opens payment as the referenced full page and preserves the detail source',async()=>{
    const navigate=vi.fn();render(<SuppliersScreen pathname="/suppliers/3" onNavigate={navigate}/>);
    await screen.findByRole('heading',{name:'Green Wholesale'});
    fireEvent.click(screen.getByRole('button',{name:'Pay'}));
    expect(navigate).toHaveBeenCalledWith('/suppliers/3/payments/new',{});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms deletion and explains that purchase history is preserved', async () => {
    render(<SuppliersScreen />);
    await screen.findByText('Green Wholesale');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Green Wholesale' }));
    expect(screen.getByRole('dialog', { name: 'Supplier actions' })).toHaveClass('mobile-sheet--action-menu');
    expect(document.querySelector('.mobile-action-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Existing purchase history will remain linked');
    fireEvent.click(screen.getByRole('button', { name: 'Delete supplier' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/suppliers/3', { method: 'DELETE' }));
  });
});

it('stages account filters and Reset without changing applied requests until Apply',async()=>{
 render(<SuppliersScreen/>);await screen.findByText('Green Wholesale');
 fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
 const count=apiRequest.mock.calls.length;
 fireEvent.click(screen.getByRole('radio',{name:'Shop owes supplier'}));
 fireEvent.click(screen.getByRole('button',{name:'Reset',exact:true}));
 expect(apiRequest.mock.calls.length).toBe(count);
 fireEvent.click(screen.getByRole('radio',{name:'Supplier owes shop'}));
 fireEvent.change(screen.getByLabelText('Sort by'),{target:{value:'name_desc'}});
 fireEvent.click(screen.getByRole('button',{name:'Apply filters'}));
 await waitFor(()=>expect(apiRequest.mock.calls.some(([path])=>path.includes('account_status=credit')&&path.includes('sort=name_desc'))).toBe(true));
});
it('blocks duplicate saves and retains the failed payment draft',async()=>{
 let reject;apiRequest.mockImplementation((path,options)=>options?.method==='POST'?new Promise((_resolve,r)=>{reject=r;}):supplierApi(path,options));
 render(<SuppliersScreen pathname="/suppliers/3/payments/new" onNavigate={vi.fn()}/>);
 await screen.findByLabelText('Amount');fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'2000'}});
 const form=document.querySelector('form');fireEvent.submit(form);fireEvent.submit(form);
 expect(apiRequest.mock.calls.filter(c=>c[1]?.method==='POST')).toHaveLength(1);
 expect(screen.getByRole('button',{name:'Cancel'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Back to suppliers'})).toBeDisabled();
 reject(new Error('Save failed'));await screen.findByText('Save failed');
 expect(screen.getByLabelText('Amount')).toHaveValue(2000);
});
it('rejects an edit URL whose payment belongs to another supplier',async()=>{
 apiRequest.mockImplementation((path,options)=>path==='/supplier-payments/5'?Promise.resolve({...supplierPayment,supplier_id:99}):supplierApi(path,options));
 render(<SuppliersScreen pathname="/suppliers/3/payments/5/edit" onNavigate={vi.fn()}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('This payment belongs to another supplier.');
 expect(screen.queryByLabelText('Amount')).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Try again'})).toBeVisible();
});

it('saves edited payments once with the correct supplier and returns to detail',async()=>{
 const navigate=vi.fn();render(<SuppliersScreen pathname="/suppliers/3/payments/5/edit" onNavigate={navigate}/>);
 await screen.findByLabelText('Amount');fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'2500'}});
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await waitFor(()=>expect(apiRequest).toHaveBeenCalledWith('/supplier-payments/5',expect.objectContaining({method:'PUT',body:expect.stringContaining('2500')})));
 expect(navigate).toHaveBeenCalledWith('/suppliers/3',{replace:true});
});
it('shows deletion errors inside the confirmation and allows retry',async()=>{
 let fail=true;apiRequest.mockImplementation((path,options)=>{if(options?.method==='DELETE'&&fail){fail=false;return Promise.reject(new Error('Delete failed'));}return supplierApi(path,options);});
 const navigate=vi.fn();render(<SuppliersScreen pathname="/suppliers/3/payments/5/edit" onNavigate={navigate}/>);await screen.findByLabelText('Amount');
 fireEvent.click(screen.getByRole('button',{name:'Delete payment'}));fireEvent.click(screen.getByRole('button',{name:'Delete movement',exact:true}));
 expect(await screen.findByText('Delete failed')).toBeVisible();expect(screen.getByRole('dialog')).toHaveTextContent('Delete failed');
 fireEvent.click(screen.getByRole('button',{name:'Delete movement',exact:true}));
 await waitFor(()=>expect(navigate).toHaveBeenCalledWith('/suppliers/3',{replace:true}));
});
