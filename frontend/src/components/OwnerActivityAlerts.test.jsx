import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OwnerActivityAlerts } from './OwnerActivityAlerts';
import { monitorActivity } from '../activityRealtime';
import { LanguageProvider } from './LanguageProvider';
vi.mock('../activityRealtime', () => ({ monitorActivity: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('localizes portal top-up notices and actions while preserving identifiers and raw review notes', async () => {
  let receive;
  monitorActivity.mockImplementation((_api, _scope, callback) => { receive = callback; return vi.fn(); });
  localStorage.setItem('mkpos.language', 'my');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ language: 'my' }) })));
  const open = vi.fn();
  try {
    render(<LanguageProvider><OwnerActivityAlerts apiRequest={vi.fn()} scope="owner:1" onOpen={open} /></LanguageProvider>);
    act(() => receive([{ id: 19, event: 'sales_ai.topup.approved', title: 'Sales AI top-up approved', message: '1,234 MMK added to your Sales AI balance.', target: 'sales-ai-topup', entity_id: 47 }]));
    expect(screen.getByRole('status').textContent).toMatch(/\p{Script=Myanmar}/u);
    expect(screen.getByRole('status')).toHaveTextContent('1,234 MMK');
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ entity_id: 47 }));
    act(() => receive([{ id: 20, event: 'sales_ai.topup.rejected', title: 'Sales AI top-up rejected', message: 'Products', target: 'sales-ai-topup', entity_id: 48 }]));
    expect(screen.getByText('Products')).toBeVisible();
  } finally { vi.unstubAllGlobals(); localStorage.clear(); }
});
it('updates access, queues approvals, opens billing once and dismisses without navigation', () => {
 let receive;const stop=vi.fn();monitorActivity.mockImplementation((api,scope,callback)=>{receive=callback;return stop;});
 const open=vi.fn(), entitlement=vi.fn();window.addEventListener('mkpos:subscription-entitlement',entitlement);
 const view=render(<><input aria-label="Product search" /><OwnerActivityAlerts apiRequest={vi.fn()} scope="owner:1" onOpen={open} /></>);
 const input=screen.getByRole('textbox');input.focus();
 act(()=>receive([{id:1,title:'Payment proof submitted',message:'Order one',target:'order',order_id:42},{id:2,title:'Subscription request rejected',message:'Transfer not received',target:'billing'}],{is_valid:true}));
 expect(input).toHaveFocus();expect(entitlement.mock.calls[0][0].detail).toEqual({is_valid:true});
 expect(screen.getByRole('status')).toHaveTextContent('Payment proof submitted');
 fireEvent.click(screen.getByRole('button',{name:'View order'}));expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({target:'order',order_id:42}));
 expect(screen.getByRole('status')).toHaveTextContent('Subscription request rejected');
 fireEvent.click(screen.getByRole('button',{name:'Dismiss activity notification'}));expect(open).toHaveBeenCalledOnce();expect(screen.queryByRole('status')).not.toBeInTheDocument();
 view.unmount();expect(stop).toHaveBeenCalledOnce();window.removeEventListener('mkpos:subscription-entitlement',entitlement);
});

it('announces top-up decisions, reconciles the wallet and opens the exact top-up once', () => {
  let receive; monitorActivity.mockImplementation((_api, _scope, callback) => { receive = callback; return vi.fn(); });
  const open = vi.fn(), updated = vi.fn(); window.addEventListener('mkpos:sales-ai-updated', updated);
  render(<OwnerActivityAlerts apiRequest={vi.fn()} scope="owner:1" onOpen={open} />);
  const notice = { id: 12, event: 'sales_ai.topup.approved', title: 'Sales AI top-up approved', message: '1,000 MMK added.', target: 'sales-ai-topup', entity_id: 47 };
  const salesAi = { wallet: { available: '1500' }, requests: [{ id: 47, status: 'approved', version: 2 }], wallet_changed: true };
  act(() => receive([notice], undefined, salesAi));
  expect(updated.mock.calls[0][0].detail).toEqual(salesAi);
  expect(screen.getByRole('status')).toHaveTextContent('Sales AI top-up approved');
  fireEvent.click(screen.getByRole('button', { name: 'View top-up' }));
  expect(open).toHaveBeenCalledExactlyOnceWith(notice);
  act(() => receive([{ ...notice, id: 13, title: 'Sales AI top-up rejected', message: 'Transfer not received.' }]));
  expect(screen.getByRole('status')).toHaveTextContent('Transfer not received.');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss activity notification' }));
  expect(open).toHaveBeenCalledOnce();
  window.removeEventListener('mkpos:sales-ai-updated', updated);
});
