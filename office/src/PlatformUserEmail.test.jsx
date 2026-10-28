import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { PlatformUserEmail } from './PlatformUserEmail';
import { RetainedViews } from './RetainedViews';

vi.mock('./api', () => ({ api: vi.fn() }));
const customer = { id: 7, name: 'Shop Customer', email: 'buyer@example.test' };
beforeEach(() => { api.mockReset(); });
const fill = () => {
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: ' Account update ' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: ' Hello,\nAn account update. ' } });
};
it('shows the fixed recipient and sends once while blocking busy controls', async () => {
  const sent = vi.fn(), close = vi.fn(); let finish;
  api.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<PlatformUserEmail customer={customer} onSent={sent} onClose={close} />);
  expect(screen.getByRole('dialog', { name: 'Send email' })).toHaveTextContent(customer.email);
  fill(); const form = screen.getByLabelText('Subject').closest('form');
  fireEvent.submit(form); fireEvent.submit(form); expect(api).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close email composer' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' }); expect(close).not.toHaveBeenCalled();
  const [path, options] = api.mock.calls[0]; expect(path).toBe('/office/platform-users/7/email');
  expect(JSON.parse(options.body)).toMatchObject({ recipient_email: customer.email, subject: 'Account update', message: 'Hello,\nAn account update.' });
  expect(JSON.parse(options.body).idempotency_key).toMatch(/^[a-f0-9-]{36}$/i);
  await act(async () => finish({ message: 'Email sent.' })); expect(sent).toHaveBeenCalledWith('Email sent.');
});
it('retains a failed draft and retries the same message with the same request key', async () => {
  api.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({ message: 'Email sent.' });
  render(<PlatformUserEmail customer={customer} onSent={vi.fn()} onClose={vi.fn()} />); fill();
  fireEvent.click(screen.getByRole('button', { name: 'Send email' })); await screen.findByText('Connection interrupted');
  expect(screen.getByLabelText('Subject')).toHaveValue(' Account update ');
  fireEvent.click(screen.getByRole('button', { name: 'Send email' })); await act(async () => {});
  expect(api.mock.calls[0][1].body).toBe(api.mock.calls[1][1].body);
});
it('blocks automatic resending when SMTP delivery is uncertain', async () => {
  api.mockRejectedValue(Object.assign(new Error('Delivery could not be confirmed.'), { payload: { code: 'email_delivery_unconfirmed' } }));
  render(<PlatformUserEmail customer={customer} onSent={vi.fn()} onClose={vi.fn()} />); fill();
  fireEvent.click(screen.getByRole('button', { name: 'Send email' })); await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Send email' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
});
it('cancels without sending and retains an unsent draft across Office sections', () => {
  const close = vi.fn();
  function Harness() {
    const [tab, setTab] = useState('email');
    return <><button onClick={() => setTab('other')}>Other section</button><button onClick={() => setTab('email')}>Email section</button><RetainedViews activeKey={tab}>{tab === 'email' ? <PlatformUserEmail customer={customer} onSent={vi.fn()} onClose={close} /> : <p>Other page</p>}</RetainedViews></>;
  }
  render(<Harness />); fill(); fireEvent.click(screen.getByRole('button', { name: 'Other section' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button', { name: 'Email section' }));
  expect(screen.getByLabelText('Subject')).toHaveValue(' Account update ');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(close).toHaveBeenCalledOnce(); expect(api).not.toHaveBeenCalled();
});
