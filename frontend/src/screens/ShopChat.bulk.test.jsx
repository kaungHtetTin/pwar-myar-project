import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ShopChat } from './ShopChat';
vi.mock('../api', () => ({ request: vi.fn() }));
vi.mock('../shopChatRealtime', () => ({ connectShopChat: () => () => {} }));
afterEach(cleanup);
const uuid = '12345678-1234-1234-1234-123456789abc';
const thread = { uuid, customer_name: 'Min Min', unread: 0, sales_ai: { enabled: true, mode: 'human', name: 'Mia', version: 1, responding: false } };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation(async path => path.endsWith('/config') ? { enabled: true, sales_ai_enabled: true, realtime_enabled: false } : path.includes('/messages') ? { thread, items: [{ id: 1, sender: 'customer', body: 'Hello', created_at: '2026-10-26 01:00:00' }], has_more: false } : { items: [thread], has_more: false });
});
it('prevents duplicate bulk handover and preserves the selected draft on failure and success', async () => {
  const base = request.getMockImplementation(); let rejectRequest, attempts = 0;
  request.mockImplementation((path, options) => {
    if (path.endsWith('/handoff-all')) {
      attempts++;
      if (attempts === 1) return new Promise((_, reject) => { rejectRequest = reject; });
      return Promise.resolve({ updated_count: 3, thread: { ...thread, sales_ai: { ...thread.sales_ai, mode: 'ai', version: 2 } } });
    }
    return base(path, options);
  });
  render(<><div id="workspace-app-bar-actions" /><ShopChat canSend /></>);
  fireEvent.click(await screen.findByRole('button', { name: 'Min Min', exact: true }));
  await screen.findByText('Hello', { selector: 'p' });
  fireEvent.change(screen.getByLabelText('Message', { exact: true }), { target: { value: 'Keep my draft' } });
  const button = screen.getByRole('button', { name: 'Hand over all to AI' });
  fireEvent.click(button); fireEvent.click(button);
  expect(attempts).toBe(1);
  await act(async () => { rejectRequest(new Error('Handover interrupted')); });
  expect(await screen.findByRole('alert')).toHaveTextContent('Handover interrupted');
  expect(screen.getByLabelText('Message', { exact: true })).toHaveValue('Keep my draft');
  fireEvent.click(screen.getByRole('button', { name: 'Hand over all to AI' }));
  await screen.findByText('3 conversations handed over to AI.');
  await waitFor(() => expect(screen.getByRole('switch', { name: 'AI replies' })).toHaveAttribute('aria-checked', 'true'));
  expect(screen.getByLabelText('Message', { exact: true })).toHaveValue('Keep my draft');
  expect(attempts).toBe(2);
});
it('does not expose bulk handover to a read-only chat user', async () => {
  render(<><div id="workspace-app-bar-actions" /><ShopChat canSend={false} /></>);
  await screen.findByRole('button', { name: 'Min Min', exact: true });
  expect(screen.queryByRole('button', { name: 'Hand over all to AI' })).not.toBeInTheDocument();
});
