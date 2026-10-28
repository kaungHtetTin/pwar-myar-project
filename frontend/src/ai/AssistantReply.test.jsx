import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AssistantReply } from './AssistantReply';
import { LanguageProvider } from '../components/LanguageProvider';

it('renders reports as semantic headings, bold labels, tables and next-step lists', () => {
  render(<AssistantReply body={'## Business summary\n\n**Period:** 25 Oct 2026 · MMK\n\n| Metric | Amount |\n| --- | ---: |\n| Sales | 12,500 |\n| Estimated profit | 2,500 |\n\n### Next steps\n\n1. Review low stock.\n2. Check pending orders.'}/>);
  expect(screen.getByRole('heading', { name: 'Business summary' })).toBeVisible();
  expect(screen.getByText('Period:').tagName).toBe('STRONG');
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('columnheader')).toHaveLength(2);
  expect(within(table).getByRole('cell', { name: '12,500' })).toBeVisible();
  expect(screen.getByRole('region', { name: 'Report table' })).toHaveAttribute('tabindex', '0');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

it('supports Myanmar text, escaped pipes, checklists, quotes and code examples', () => {
  render(<AssistantReply body={'| Product | Note |\n| --- | --- |\n| ဆပ်ပြာ | Retail \\| Wholesale |\n\n- [x] Price checked\n- [ ] Review stock\n\n> Stock is a current snapshot.\n\nUse `base_unit`.\n\n```csv\nName,Retail\nSoap,100\n```'}/>);
  expect(screen.getByRole('cell', { name: 'ဆပ်ပြာ' })).toBeVisible();
  expect(screen.getByRole('cell', { name: 'Retail | Wholesale' })).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Completed item' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Incomplete item' })).toBeDisabled();
  expect(screen.getByText('base_unit').tagName).toBe('CODE');
  expect(screen.getByText('Stock is a current snapshot.').closest('blockquote')).not.toBeNull();
});

it('allows safe links without replacing the source chat and rejects dangerous or internal URLs', () => {
  render(<AssistantReply body={'[Help](https://example.test/help) [Danger](javascript:alert%281%29) [Data](data:text/html,bad) [Internal](/api/secret) [Protocol](//evil.test)'}/>);
  const link = screen.getByRole('link', { name: 'Help' });
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getAllByRole('link')).toHaveLength(1);
  expect(screen.getByText(/Danger/)).toBeVisible();
});

it('never enables HTML, scripts, remote images or embedded controls', () => {
  const { container } = render(<AssistantReply body={'<script>alert(1)</script>\n\n<img src="https://evil.test/track" onerror="alert(1)">\n\n![tracking](https://evil.test/image)\n\n<iframe src="https://evil.test"></iframe>\n\n<form><button>Run</button></form>\n\n**Safe content**'}/>);
  expect(container.querySelector('script, img, iframe, form, button')).toBeNull();
  expect(screen.getByText('Safe content').tagName).toBe('STRONG');
});

it('keeps ordinary replies readable without requiring Markdown formatting', () => {
  render(<AssistantReply body="Your current role cannot access Reports. Please contact your business owner."/>);
  expect(screen.getByText('Your current role cannot access Reports. Please contact your business owner.')).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('renders only allowed app screen links as navigation buttons and clicks once', () => {
  const navigate = vi.fn();
  render(<AssistantReply body={'[Open Products](#mkpos-screen=products) [Blocked](#mkpos-screen=settings) [Unsafe](#mkpos-screen=security) [Path](/api/settings)'} screens={['products', 'security']} onNavigate={navigate}/>);
  const button = screen.getByRole('button', { name: 'Open Products' });
  expect(button).toHaveAttribute('type', 'button');
  fireEvent.click(button);
  expect(navigate).toHaveBeenCalledExactlyOnceWith('products');
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('disables screen navigation while the assistant is busy and requires an app handler', () => {
  const navigate = vi.fn();
  const view = render(<AssistantReply body={'[Open Sell](#mkpos-screen=sell)'} screens={['sell']} onNavigate={navigate} disabled/>);
  fireEvent.click(screen.getByRole('button', { name: 'Open Sell' }));
  expect(navigate).not.toHaveBeenCalled();
  view.rerender(<AssistantReply body={'[Open Sell](#mkpos-screen=sell)'} screens={['sell']}/>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('links specific forms and settings sections, while blocking owner-only destinations for staff', () => {
  const navigate = vi.fn();
  render(<AssistantReply role="staff" screens={['customers', 'settings']} onNavigate={navigate} body={'[Add Customer](#mkpos-screen=customers_new) [Receipt](#mkpos-screen=settings_receipt) [Prices](#mkpos-screen=settings_prices)'}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
  expect(navigate).toHaveBeenCalledWith('customers_new');
  fireEvent.click(screen.getByRole('button', { name: 'Receipt' }));
  expect(navigate).toHaveBeenCalledWith('settings_receipt');
  expect(screen.queryByRole('button', { name: 'Prices' })).not.toBeInTheDocument();
});

it('shows a personal account button to staff while keeping security settings owner-only', () => {
  const navigate = vi.fn();
  render(<AssistantReply role="staff" screens={['settings']} onNavigate={navigate} body={'[Open Account Settings](#mkpos-screen=settings_account) [Open Security Settings](#mkpos-screen=settings_security)'}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Open Account Settings' }));
  expect(navigate).toHaveBeenCalledExactlyOnceWith('settings_account');
  expect(screen.queryByRole('button', { name: 'Open Security Settings' })).not.toBeInTheDocument();
});

it('localizes canonical screen controls and report accessibility while preserving original report evidence', async () => {
  localStorage.setItem('mkpos.language', 'my');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ language: 'my' }) })));
  const navigate = vi.fn();
  try {
    render(<LanguageProvider><AssistantReply role="owner" screens={['products']} onNavigate={navigate}
      body={'[Open Products](#mkpos-screen=products)\n\n| Name | Ref |\n| --- | --- |\n| Products | 001234 |\n\n- [x] Products'} /></LanguageProvider>);
    const button = await screen.findByRole('button');
    expect(button.textContent).toMatch(/\p{Script=Myanmar}/u);
    fireEvent.click(button);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('products');
    expect(screen.getByRole('region').getAttribute('aria-label')).toMatch(/\p{Script=Myanmar}/u);
    expect(screen.getByRole('checkbox').getAttribute('aria-label')).toMatch(/\p{Script=Myanmar}/u);
    expect(screen.getByRole('cell', { name: 'Products' })).toBeVisible();
    expect(screen.getByRole('cell', { name: '001234' })).toBeVisible();
  } finally { vi.unstubAllGlobals(); localStorage.clear(); }
});
