import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AccountDeletionRequest } from './AccountDeletion';
import { accountDeletionUrl } from './accountDeletionUrl';

afterEach(() => vi.unstubAllGlobals());
const contacts = { email: '', telegram_url: 'https://t.me/moekaungdev', phone_numbers: ['09682537158'], viber_numbers: ['09682537158'] };

it('offers existing support channels and copies an explicit deletion request without submitting it', async () => {
  const writeText = vi.fn().mockResolvedValue();
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<AccountDeletionRequest contacts={contacts} accountEmail="owner@example.test" />);
  fireEvent.change(screen.getByLabelText('Business name (optional)'), { target: { value: 'Test Shop' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy deletion request' }));
  await screen.findByText('Request copied. Send it to PwarMyar support to submit your request.');
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Account email: owner@example.test\nBusiness: Test Shop'));
  expect(screen.getByRole('link', { name: 'Telegram support' })).toHaveAttribute('href', contacts.telegram_url);
  expect(screen.getByRole('link', { name: /Call support/ })).toHaveAttribute('href', 'tel:09682537158');
  expect(screen.getByRole('link', { name: 'Viber support' })).toHaveAttribute('href', 'viber://chat?number=%2B959682537158');
});

it('never treats unsafe contact URLs as support links', () => {
  render(<AccountDeletionRequest contacts={{ ...contacts, telegram_url: 'javascript:alert(1)' }} />);
  expect(screen.queryByRole('link', { name: 'Telegram support' })).not.toBeInTheDocument();
  expect(accountDeletionUrl()).toContain('/account-deletion');
});
