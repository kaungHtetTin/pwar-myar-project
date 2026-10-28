import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ErrorReportContactPage } from './ErrorReportContact';
import { apiRequest } from '../api/client';
vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('../localization/LocaleContext', () => ({ useLocale: () => ({ language: 'en' }) }));

it('asks for contact before submitting and preserves values after validation failure', async () => {
  let complete;
  const api = apiRequest.mockReset().mockResolvedValueOnce({ id: 7, title: 'Checkout failed', description: 'Payment error' })
    .mockRejectedValueOnce(Object.assign(new Error('Check your contact'), { payload: { errors: { contact_value: ['Enter a valid phone number.'] } } }))
    .mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  render(<ErrorReportContactPage requestId={7} onBack={vi.fn()} />);
  expect(await screen.findByText('How should admins contact you?')).toBeInTheDocument();
  expect(api).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Submit report' })).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: 'Phone', exact: true }));
  const contact = screen.getByLabelText('Phone number');
  fireEvent.change(contact, { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  expect(await screen.findByText('Enter a valid phone number.')).toBeInTheDocument();
  expect(contact).toHaveValue('123'); expect(contact).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(contact, { target: { value: '+959123456789' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Error report contact' }));
  fireEvent.submit(screen.getByRole('form', { name: 'Error report contact' }));
  expect(api).toHaveBeenCalledTimes(3);
  expect(JSON.parse(api.mock.calls[2][1].body)).toEqual({ contact_choice: 'provided', contact_channel: 'phone', contact_value: '+959123456789' });
  await act(async () => complete({ id: 1, reference: 'ERR-000001' }));
  expect(screen.getByRole('status')).toHaveTextContent('ERR-000001');
});

it('requires explicit skip and never sends a previously entered contact when skipped', async () => {
  const api = apiRequest.mockReset().mockResolvedValueOnce({ id: 7, title: 'Checkout failed', description: 'Payment error' }).mockResolvedValue({ id: 2, reference: 'ERR-000002' });
  const done = vi.fn();
  render(<ErrorReportContactPage requestId={7} onBack={done} />);
  fireEvent.click(await screen.findByRole('radio', { name: 'Telegram' }));
  fireEvent.change(screen.getByLabelText('Telegram username, link or phone'), { target: { value: '@ownername' } });
  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
  expect(done).toHaveBeenCalledOnce(); expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('radio', { name: 'Submit without contact details' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit report' }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ contact_choice: 'skip', contact_channel: null, contact_value: null });
  expect(await screen.findByRole('status')).toHaveTextContent('ERR-000002');
});
