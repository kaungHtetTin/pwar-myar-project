import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BusinessActions } from './BusinessActions';

const item = { record_id: 1, name: 'Soap', before: { price: 100 }, after: { price: 105 } };
const action = { id: 'proposal', operation: 'update_product_prices', status: 'pending', currency: 'MMK', preview_hash: 'review-hash', expires_at: '2099-01-01T00:00:00Z', preview: { items: [item], total: 1, has_more: false } };
function mount(api, source = action) {
  const props = { api, conversation: 'chat', actions: { items: [source], has_more: false }, onChange: vi.fn(), onAppend: vi.fn(), onBusy: vi.fn(), onSaved: vi.fn() };
  render(<BusinessActions {...props}/>);
  return props;
}
async function open() { fireEvent.click(screen.getByRole('button', { name: 'Review Update product prices' })); await screen.findByRole('article', { name: 'Review business changes' }); }

it('shows before/after values and requires owner review, then submits the exact proposal once', async () => {
  let finish;
  const api = vi.fn().mockResolvedValueOnce(action).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const props = mount(api); await open();
  expect(screen.getByText('100')).toBeVisible(); expect(screen.getByText('105')).toBeVisible();
  const confirm = screen.getByRole('button', { name: 'Confirm changes' });
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(confirm); fireEvent.click(confirm);
  expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ preview_hash: 'review-hash', reviewed_count: 1 });
  await act(async () => finish({ ...action, status: 'completed', result: { updated_products: 1, modules: ['products'] } }));
  expect(screen.getByRole('status')).toHaveTextContent('Changes saved.');
  expect(props.onSaved).toHaveBeenCalledTimes(1);
});

it('cannot approve an incompletely loaded bulk preview', async () => {
  const partial = { ...action, preview: { items: [item], total: 2, has_more: true, next_offset: 1 } };
  const api = vi.fn().mockResolvedValueOnce(partial).mockResolvedValueOnce({ ...action, preview: { items: [{ ...item, record_id: 2, name: 'Tea' }], total: 2, has_more: false } });
  mount(api, partial); await open();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Load more changes (1 of 2)' }));
  await screen.findByText('Tea · #2');
  expect(screen.getByRole('checkbox')).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Confirm changes' })).toBeDisabled();
  expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
});

it('cancels a proposal without confirming and restores focus when closing the review', async () => {
  const api = vi.fn().mockResolvedValueOnce(action).mockResolvedValueOnce({ ...action, status: 'cancelled' });
  const props = mount(api); await open();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel proposal' }));
  await screen.findByText('Proposal cancelled. Ask the assistant for a new proposal if needed.');
  expect(api.mock.calls[1][0]).toMatch(/\/cancel$/);
  expect(props.onSaved).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Close review' }));
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Review Update product prices' })).toHaveFocus();
});

it('recovers a saved result after a confirmation timeout without executing again', async () => {
  const api = vi.fn().mockResolvedValueOnce(action).mockRejectedValueOnce(new Error('Connection timed out')).mockResolvedValueOnce({ ...action, status: 'completed', result: { updated_products: 1, modules: ['products'] } });
  const props = mount(api); await open();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Confirm changes' }));
  await screen.findByRole('alert');
  expect(screen.getByText('105')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Check action status' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Changes saved.'));
  expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(props.onSaved).toHaveBeenCalledTimes(1);
});

it('loads older proposals without opening or confirming them', async () => {
  const page = { items: [{ ...action, id: 'older' }], has_more: false };
  const api = vi.fn().mockResolvedValue(page);
  const props = { api, conversation: 'chat', actions: { items: [action], has_more: true, next_offset: 20 }, onChange: vi.fn(), onAppend: vi.fn(), onBusy: vi.fn(), onSaved: vi.fn() };
  render(<BusinessActions {...props}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Load older changes' }));
  await waitFor(() => expect(props.onAppend).toHaveBeenCalledWith(page));
  expect(api).toHaveBeenCalledWith('/ai-assistant/conversations/chat/actions?offset=20');
  expect(props.onSaved).not.toHaveBeenCalled();
});

it('invalidates approval after editing settings, revalidates and separately confirms the new preview', async () => {
  const settings = { ...action, operation: 'manage_app_settings', preview: { ...action.preview, items: [{ name: 'Update app settings', before: { shop_name: 'Wyne' }, after: { shop_name: 'wyne business' }, editable: true, fields: [{ key: 'shop_name', label: 'Shop Name', type: 'text', maxLength: 255 }] }] } };
  const revised = { ...settings, id: 'revised', preview_hash: 'new-hash', preview: { ...settings.preview, items: [{ ...settings.preview.items[0], after: { shop_name: 'Revised shop' } }] } };
  const api = vi.fn().mockResolvedValueOnce(settings).mockResolvedValueOnce(revised).mockResolvedValueOnce({ ...revised, status: 'completed', result: { modules: ['settings'] } });
  const props = mount(api, settings);
  fireEvent.click(screen.getByRole('button', { name: 'Review App settings' }));
  await screen.findByRole('textbox', { name: 'Shop Name' });
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Confirm changes' })).toBeEnabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Shop Name' }), { target: { value: 'Revised shop' } });
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Confirm changes' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh review' }));
  await waitFor(() => expect(props.onAppend).toHaveBeenCalled());
  expect(api.mock.calls[1][0]).toMatch(/\/revise$/);
  expect(props.onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm changes' }));
  await screen.findByText('Changes saved.');
  expect(api.mock.calls[2][0]).toMatch(/\/revised\/confirm$/);
  expect(JSON.parse(api.mock.calls[2][1].body)).toEqual({ preview_hash: 'new-hash', reviewed_count: 1 });
});

it('keeps edited settings after a validation failure and never enables confirmation', async () => {
  const settings = { ...action, operation: 'manage_app_settings', preview: { ...action.preview, items: [{ before: { receipt_footer: '' }, after: { receipt_footer: 'Thanks' }, editable: true, fields: [{ key: 'receipt_footer', label: 'Receipt Footer', type: 'textarea' }] }] } };
  const api = vi.fn().mockResolvedValueOnce(settings).mockRejectedValueOnce(new Error('Invalid setting value'));
  mount(api, settings);
  fireEvent.click(screen.getByRole('button', { name: 'Review App settings' }));
  const field = await screen.findByRole('textbox', { name: 'Receipt Footer' });
  fireEvent.change(field, { target: { value: 'Edited footer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh review' }));
  await screen.findByRole('alert');
  expect(field).toHaveValue('Edited footer');
  expect(screen.getByRole('button', { name: 'Confirm changes' })).toBeDisabled();
});


it('opens a reviewed invoice draft without claiming a purchase was posted', async () => {
  const proposal={...action,operation:'create_purchase_draft',status:'completed',result:{purchase_draft_id:'draft-id',posted:false}};
  const onOpenPurchaseDraft=vi.fn(),api=vi.fn().mockResolvedValue(proposal);
  render(<BusinessActions api={api} conversation="chat" actions={{items:[proposal]}} onChange={vi.fn()} onAppend={vi.fn()} onBusy={vi.fn()} onSaved={vi.fn()} onOpenPurchaseDraft={onOpenPurchaseDraft}/>);
  fireEvent.click(screen.getByRole('button',{name:'Review Invoice purchase draft'}));
  await screen.findByText('Purchase draft saved. Stock and payments are unchanged.');
  fireEvent.click(screen.getByRole('button',{name:'Open purchase draft'}));
  expect(onOpenPurchaseDraft).toHaveBeenCalledWith('draft-id');
  expect(api.mock.calls.filter(([,options])=>options?.method==='POST')).toHaveLength(0);
});

it('keeps the PIN outside retained chat state and requires funds and goods verification', async () => {
  const sensitive = { ...action, operation:'manage_sales', requires_pin:true, requires_payment_verification:true, requires_goods_verification:true, preview:{...action.preview, items:[{...item,after:{items:[{product:'Soap',unit:'Unit',quantity:1,unit_price:100,line_total:100}],total:100}}]} };
  const cache = {current:null};
  const api=vi.fn().mockResolvedValueOnce(sensitive).mockRejectedValueOnce(new Error('Wrong PIN'));
  render(<BusinessActions api={api} conversation="chat" actions={{items:[sensitive]}} onChange={vi.fn()} onAppend={vi.fn()} onBusy={vi.fn()} onSaved={vi.fn()} stateCache={cache}/>);
  fireEvent.click(screen.getByRole('button',{name:'Review Sales'}));
  await screen.findByRole('table',{name:'Proposed line items'});
  const consent=screen.getByRole('checkbox',{name:/I reviewed all/});
  expect(consent).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Admin PIN'),{target:{value:'4567'}});
  fireEvent.click(screen.getByRole('checkbox',{name:'Verified actual payment'}));
  expect(consent).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox',{name:'Confirmed goods returned'}));
  expect(consent).toBeEnabled();
  expect(JSON.stringify(cache.current)).not.toContain('4567');
  fireEvent.click(consent); fireEvent.click(screen.getByRole('button',{name:'Confirm changes'}));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Admin PIN')).toHaveValue('');
  expect(screen.getByRole('button',{name:'Confirm changes'})).toBeDisabled();
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({preview_hash:'review-hash',reviewed_count:1,admin_pin:'4567',verified_payment:true,verified_goods_return:true});
  expect(JSON.stringify(cache.current)).not.toContain('4567');
  fireEvent.click(screen.getByRole('button',{name:'Close review'}));
  expect(screen.queryByLabelText('Admin PIN')).not.toBeInTheDocument();
});

it('reviews Sales AI configuration before confirming and returns the saved settings to the host', async () => {
  const proposal = { ...action, operation: 'manage_sales_ai_settings', preview: { items: [{ name: 'Sales AI name', before: { name: 'Sales assistant' }, after: { name: 'Kaung Kaung' } }], total: 1, has_more: false } };
  const api = vi.fn().mockResolvedValueOnce(proposal).mockResolvedValueOnce({ ...proposal, status: 'completed', result: { saved: true, sales_ai: { settings: { name: 'Kaung Kaung', version: 2 } }, modules: ['shop'] } });
  const props = mount(api, proposal);
  fireEvent.click(screen.getByRole('button', { name: 'Review Sales AI configuration' }));
  await screen.findByText('Kaung Kaung');
  expect(screen.getByRole('button', { name: 'Confirm changes' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm changes' }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(expect.objectContaining({ sales_ai: { settings: { name: 'Kaung Kaung', version: 2 } } })));
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ preview_hash: 'review-hash', reviewed_count: 1 });
});

it('requires owner confirmation for Telegram bot changes and returns only the saved settings', async () => {
  const proposal = { ...action, operation: 'manage_sales_ai_telegram_settings', preview: { items: [{ name: 'Telegram group replies', before: { groups_enabled: false }, after: { groups_enabled: true } }], total: 1, has_more: false } };
  const result = { saved: true, sales_ai_telegram: { settings: { enabled: true, groups_enabled: true, version: 3 } }, modules: ['shop'] };
  const api = vi.fn().mockResolvedValueOnce(proposal).mockResolvedValueOnce({ ...proposal, status: 'completed', result });
  const props = mount(api, proposal);
  fireEvent.click(screen.getByRole('button', { name: 'Review Sales AI Telegram settings' }));
  await screen.findByText('Telegram group replies');
  expect(screen.getByRole('button', { name: 'Confirm changes' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm changes' }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(result));
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ preview_hash: 'review-hash', reviewed_count: 1 });
});
