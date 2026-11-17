import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomerAccount, CustomerProvider } from '../CustomerAccount';
import { LocaleContext } from '../i18n';
import { request } from '../api';

vi.mock('../api', () => ({ customerToken: () => 'fixture', setCustomerToken: vi.fn(), post: vi.fn(), request: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it.each([true, false])('offers Telegram AI support in Me without changing the account route (signed in: %s)', async signedIn => {
  request.mockImplementation(async path => path === '/customer/me' ? { customer: signedIn ? { id: 1, name: 'Buyer', email: 'buyer@example.test' } : null } : { items: [], total: 0 });
  render(<CustomerProvider><CustomerAccount /></CustomerProvider>);
  const link = await screen.findByRole('link', { name: /AI customer service/ });
  expect(link).toHaveAttribute('href', 'https://t.me/KaungKaungKK_bot');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(link).toHaveTextContent('@KaungKaungKK_bot');
});

it('uses the Myanmar support label in Me', async () => {
  request.mockResolvedValue({ customer: null });
  render(<LocaleContext.Provider value="my"><CustomerProvider><CustomerAccount /></CustomerProvider></LocaleContext.Provider>);
  expect(await screen.findByRole('link', { name: /AI ဖောက်သည်ဝန်ဆောင်မှု/ })).toHaveAttribute('href', 'https://t.me/KaungKaungKK_bot');
});
