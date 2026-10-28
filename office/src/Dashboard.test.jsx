import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { Dashboard } from './main';

vi.mock('./api', () => ({ api: vi.fn(), apiBlob: vi.fn(), apiUpload: vi.fn(), officeApiBase: '/api' }));

beforeEach(() => {
  window.history.replaceState({}, '', window.location.pathname + window.location.search);
  window.sessionStorage.clear();
  api.mockReset();
  api.mockImplementation((path) => {
    if (path === '/office/plans' || path === '/office/payment-methods' || path === '/office/subscription-requests') return Promise.resolve({ items: [] });
    if (path === '/office/businesses?per_page=6&sort=newest') return Promise.resolve({ items: [], summary: { total: 0, access_counts: {} } });
    if (path.startsWith('/office/businesses?')) return Promise.resolve({ items: [], total: 0, page: 1, last_page: 1, per_page: 25, summary: { total: 0 } });
    if (path === '/office/financial-report') return Promise.resolve(null);
    if (path.startsWith('/office/tutorials?') || path.startsWith('/office/platform-users?')) return Promise.resolve({ items: [], total: 0, page: 1, last_page: 1, per_page: 25 });
    return Promise.resolve({});
  });
});

it('filters Office requests by local day and retains dates across navigation', async () => {
  const current = api.getMockImplementation();
  const request = { id: 501, business_name: 'Midnight shop', business_id: 11, plan_name: 'Monthly', currency: 'Ks', price: 1000, duration_days: 30, status: 'pending', created_at: '2026-10-19T17:45:00Z' };
  api.mockImplementation(path => {
    if (path === '/office/subscription-requests') return Promise.resolve({ items: [request, { ...request, id: 502, business_name: 'Previous day shop', created_at: '2026-10-19T17:29:59Z' }] });
    if (path.startsWith('/office/subscription-payments?')) return Promise.resolve({ items: [], total: 0, page: 1, last_page: 1, per_page: 25, currencies: ['Ks'] });
    return current(path);
  });
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.test' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' });
  fireEvent.click(screen.getByRole('button', { name: /^Payment(?:\d|$)/ }));
  await waitFor(() => expect(within(screen.getByRole('table')).getByText('Previous day shop')).toBeInTheDocument());
  expect(screen.queryByRole('region', { name: 'Assistant approvals' })).not.toBeInTheDocument();
  expect(api.mock.calls.some(([path]) => path.startsWith('/office/assistant-approvals'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-20' } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-10-20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.queryByRole('dialog', { name: 'Payment filters' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('table')).getByText('Midnight shop')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).queryByText('Previous day shop')).not.toBeInTheDocument();
  const loads = () => api.mock.calls.filter(([path]) => path === '/office/subscription-requests').length;
  const before = loads();
  fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
  window.history.back();
  await screen.findByRole('heading', { name: 'Payment' });
  expect(loads()).toBe(before);
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  expect(screen.getByLabelText('From date')).toHaveValue('2026-10-20');
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-10-18' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  expect(screen.getByLabelText('From date')).toHaveValue('2026-10-20');
  fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'history' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringMatching(/subscription-payments\?.*from=2026-10-20&to=2026-10-20/)));
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset to needs approval' }));
  expect(within(screen.getByRole('table')).getByText('Previous day shop')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  expect(screen.getByLabelText('From date')).toHaveValue('');
  expect(screen.getByLabelText('To date')).toHaveValue('');
});

it('emails the owner from business details and returns to the retained businesses list', async () => {
  const original = api.getMockImplementation();
  const business = { id: 11, name: 'Owner Email Shop', owner_id: 21, owner_name: 'Demo Owner', owner_email: 'owner@example.test', owner_is_active: true, status: 'active', currency: 'Ks', timezone: 'Asia/Yangon', subscription: null };
  api.mockImplementation((path, options) => {
    if (path === '/office/businesses/11/email') return Promise.resolve({ message: 'Email sent to owner@example.test.' });
    if (path === '/office/businesses/11') return Promise.resolve({ business, billing: { subscription: null, is_valid: false }, billing_history: [], business_summary: {} });
    if (path.startsWith('/office/businesses?')) return Promise.resolve({ items: [business], total: 1, page: 1, per_page: 25, last_page: 1, summary: { total: 1, access_counts: {} } });
    return original(path, options);
  });
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.test' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' }); fireEvent.click(screen.getByRole('button', { name: 'Businesses' }));
  await screen.findByRole('button', { name: 'Actions for Owner Email Shop' });
  const table = screen.getByRole('table');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Owner Email Shop' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'View business' }));
  await screen.findByRole('button', { name: 'Email owner' });
  const detailCalls = () => api.mock.calls.filter(([path]) => path === '/office/businesses/11').length;
  const count = detailCalls();
  fireEvent.click(screen.getByRole('button', { name: 'Email owner' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Owner Email Shop');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(detailCalls()).toBe(count);
  fireEvent.click(screen.getByRole('button', { name: 'Email owner' }));
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Business update' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello business owner.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send email' }));
  await screen.findByText('Email sent to owner@example.test.'); expect(detailCalls()).toBe(count);
  window.history.back(); await screen.findByRole('button', { name: 'Actions for Owner Email Shop' });
  expect(screen.getByRole('table')).toBe(table);
});

it('opens AI assistant in Settings and retains its draft across tabs and browser Back', async () => {
  const original = api.getMockImplementation();
  const assistant = { settings: { enabled: false, configured: true, model: 'deepseek-flash', weekly_limit: 50, max_tokens: 1600 }, usage: { today_requests: 0, today_failures: 0, input_tokens: 0, output_tokens: 0 }, recent_runs: [] };
  const session = { admin: { id: 12, name: 'Office', email: 'office@example.test', role: 'super_admin' } };
  api.mockImplementation((path, options) => {
    if (path === '/office/ai-assistant') return Promise.resolve(options?.method === 'PUT' ? { ...assistant, settings: { ...assistant.settings, ...JSON.parse(options.body) } } : assistant);
    if (path === '/office/auth/me') return Promise.resolve(session);
    return original(path, options);
  });
  render(<Dashboard session={session} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' });
  expect(screen.queryByRole('button', { name: /AI assistant/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  const sections = screen.getByRole('navigation', { name: 'Settings sections' });
  fireEvent.click(within(sections).getByRole('button', { name: /AI assistant/ }));
  const model = await screen.findByLabelText('DeepSeek model');
  fireEvent.change(model, { target: { value: 'deepseek-v4-pro' } });
  fireEvent.click(within(sections).getByRole('button', { name: /Account/ }));
  fireEvent.click(within(sections).getByRole('button', { name: /AI assistant/ }));
  expect(screen.getByLabelText('DeepSeek model')).toBe(model);
  expect(model).toHaveValue('deepseek-v4-pro');
  fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
  window.history.back();
  await screen.findByRole('heading', { name: 'Settings' });
  expect(screen.getByLabelText('DeepSeek model')).toBe(model);
  expect(api.mock.calls.filter(([path]) => path === '/office/ai-assistant')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Save assistant settings' }));
  await screen.findByText('AI assistant settings saved.');
  expect(api).toHaveBeenCalledWith('/office/ai-assistant', { method: 'PUT', body: JSON.stringify({ enabled: false, model: 'deepseek-v4-pro', weekly_limit: 50, max_tokens: 1600 }) });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh current page' }));
  await waitFor(() => expect(api.mock.calls.filter(([path, options]) => path === '/office/ai-assistant' && !options)).toHaveLength(2));
});

it('hides the AI assistant settings tab from regular administrators', async () => {
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.test', role: 'admin' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' });
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.queryByRole('button', { name: /AI assistant/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Usage Report' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Balance book', exact: true })).not.toBeInTheDocument();
  expect(api.mock.calls.some(([path]) => path === '/office/ai-assistant')).toBe(false);
  expect(screen.queryByRole('button', { name: /Telegram customer service/ })).not.toBeInTheDocument();
  expect(api.mock.calls.some(([path]) => path === '/office/telegram-support')).toBe(false);
  expect(screen.queryByRole('button', { name: 'Server health', exact: true })).not.toBeInTheDocument();
});

it('keeps health in System instead of Overview and retains its search and rows on browser Back', async () => {
  const original = api.getMockImplementation();
  api.mockImplementation((path, options) => path === '/office/health/system' ? Promise.resolve({ status: 'healthy', checked_at: '2026-10-26T08:00:00Z', checks: [{ id: 'database', group: 'Data & storage', label: 'Database', status: 'healthy', scope: 'live', message: 'Fixture database probe passed.' }] }) : original(path, options));
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', role: 'super_admin' } }} onLogout={vi.fn()} onSessionChange={vi.fn()}/>);
  await screen.findByRole('heading', { name: 'Overview', exact: true });
  expect(api.mock.calls.some(([path]) => path === '/office/health/system')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Server health', exact: true }));
  await screen.findByText('Fixture database probe passed.');
  expect(window.location.hash).toBe('#/system/server-health');
  const rows = screen.getByRole('list', { name: 'Data & storage' });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search server health' }), { target: { value: 'database' } });
  fireEvent.click(screen.getByRole('button', { name: 'Overview', exact: true }));
  window.history.back();
  await screen.findByRole('heading', { name: 'Server health', exact: true });
  expect(screen.getByRole('list', { name: 'Data & storage' })).toBe(rows);
  expect(screen.getByRole('searchbox', { name: 'Search server health' })).toHaveValue('database');
  expect(api.mock.calls.filter(([path]) => path === '/office/health/system')).toHaveLength(1);
});

it('opens Telegram settings by URL and retains its private draft across tabs and browser Back', async () => {
  window.history.replaceState({}, '', '/office/#/settings/telegram-support');
  const original = api.getMockImplementation();
  api.mockImplementation((path, options) => path === '/office/telegram-support' ? Promise.resolve({ settings: { enabled: false, token_configured: false, storage_ready: true, version: 0, webhook_url: '', daily_limit: 200, per_chat_daily_limit: 20 } }) : original(path, options));
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', role: 'super_admin' } }} onLogout={vi.fn()} onSessionChange={vi.fn()}/>);
  const token = await screen.findByLabelText(/^Bot token/);
  fireEvent.change(token, { target: { value: '123456:fixture_token_12345678901234567890' } });
  const sections = screen.getByRole('navigation', { name: 'Settings sections' });
  fireEvent.click(within(sections).getByRole('button', { name: /Account/ }));
  fireEvent.click(within(sections).getByRole('button', { name: /Telegram customer service/ }));
  expect(screen.getByLabelText(/^Bot token/)).toBe(token);
  fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
  window.history.back();
  await screen.findByRole('heading', { name: 'Settings', exact: true });
  expect(screen.getByLabelText(/^Bot token/)).toHaveValue('123456:fixture_token_12345678901234567890');
  expect(api.mock.calls.filter(([path]) => path === '/office/telegram-support')).toHaveLength(1);
  expect(Object.values(window.sessionStorage).join('')).not.toContain('fixture_token');
});

it('reopens the selected Settings subtab after a browser refresh and keeps Back/Forward working', async () => {
  const original = api.getMockImplementation();
  const session = { admin: { id: 12, name: 'Office', email: 'office@example.test', role: 'super_admin' } };
  api.mockImplementation((path, options) => path === '/office/ai-assistant' ? Promise.resolve({ settings: { enabled: false, configured: true, model: 'deepseek-flash', weekly_limit: 50, max_tokens: 1600 }, usage: { today_requests: 0, today_failures: 0, input_tokens: 0, output_tokens: 0 }, recent_runs: [] }) : original(path, options));
  const props = { session, onLogout: vi.fn(), onSessionChange: vi.fn() };
  const first = render(<Dashboard {...props} />);
  await screen.findByRole('heading', { name: 'Overview' });
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: /AI assistant/ }));
  await screen.findByLabelText('DeepSeek model');
  expect(window.location.hash).toBe('#/settings/ai-assistant');
  first.unmount();
  render(<Dashboard {...props} />);
  await screen.findByLabelText('DeepSeek model');
  expect(screen.getByRole('heading', { name: 'Settings', exact: true })).toBeInTheDocument();
  window.history.back();
  await screen.findByLabelText('Display name');
  expect(window.location.hash).toBe('#/settings/account');
  window.history.forward();
  await waitFor(() => expect(window.location.hash).toBe('#/settings/ai-assistant'));
  expect(screen.getByLabelText('DeepSeek model')).toBeVisible();
});

it('restores the balance book on refresh and clears navigation on logout', async () => {
  const original = api.getMockImplementation();
  api.mockImplementation((path, options) => path.startsWith('/office/ai-balance-book?') ? Promise.resolve({ balance: '0', total_top_ups: '0', total_usage: '0', can_use_ai: false, items: [], total: 0, page: 1, last_page: 1, per_page: 25 }) : original(path, options));
  const onLogout = vi.fn();
  const props = { session: { admin: { id: 12, name: 'Office', role: 'super_admin' } }, onLogout, onSessionChange: vi.fn() };
  const first = render(<Dashboard {...props} />);
  await screen.findByRole('heading', { name: 'Overview' });
  fireEvent.click(screen.getByRole('button', { name: 'Balance book', exact: true }));
  await screen.findByRole('table', { name: 'AI balance entries' });
  expect(window.location.hash).toBe('#/ai/balance-book');
  first.unmount();
  render(<Dashboard {...props} />);
  await screen.findByRole('table', { name: 'AI balance entries' });
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(onLogout).toHaveBeenCalledOnce());
  expect(window.location.hash).toBe('');
  expect(Object.keys(window.sessionStorage).filter(key => key.startsWith('mkpos.office.navigation:'))).toHaveLength(0);
});

it('opens a direct business-detail route with a safe Back fallback', async () => {
  window.history.replaceState({}, '', `${window.location.pathname}#/businesses/11`);
  const original = api.getMockImplementation();
  api.mockImplementation((path, options) => path === '/office/businesses/11' ? Promise.reject(new Error('Unavailable fixture')) : original(path, options));
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', role: 'admin' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Business details' });
  fireEvent.click(screen.getByRole('button', { name: 'Back to Businesses', exact: true }));
  await screen.findByRole('heading', { name: 'Businesses', exact: true });
  expect(window.location.hash).toBe('#/businesses');
});

it('retains the usage metric and balance book across Back and Forward', async () => {
  const original = api.getMockImplementation();
  api.mockImplementation((path, options) => {
    if (path === '/office/ai-assistant') return Promise.resolve({ usage_charts: { series: { hourly: [], daily: [], monthly: [], yearly: [] } }, usage: { today_requests: 7, today_failures: 1, input_tokens: 2500, output_tokens: 600 } });
    if (path.startsWith('/office/ai-balance-book?')) return Promise.resolve({ balance: '0.000000000', total_top_ups: '0.000000000', total_usage: '0.000000000', can_use_ai: false, items: [], total: 0, page: 1, last_page: 1, per_page: 25 });
    return original(path, options);
  });
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', role: 'super_admin' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' });
  fireEvent.click(screen.getByRole('button', { name: 'Usage Report' }));
  const usage = await screen.findByRole('region', { name: 'AI usage' });
  fireEvent.change(screen.getByLabelText('Chart metric'), { target: { value: 'total_tokens' } });
  fireEvent.click(screen.getByRole('button', { name: 'Balance book', exact: true }));
  const table = await screen.findByRole('table', { name: 'AI balance entries' });
  const calls = api.mock.calls.length;
  window.history.back();
  await screen.findByRole('heading', { name: 'Usage Report' });
  expect(screen.getByRole('region', { name: 'AI usage' })).toBe(usage);
  expect(screen.getByLabelText('Chart metric')).toHaveValue('total_tokens');
  expect(api.mock.calls).toHaveLength(calls);
  window.history.forward();
  await screen.findByRole('heading', { name: 'AI balance book' });
  expect(screen.getByRole('table', { name: 'AI balance entries' })).toBe(table);
  expect(api.mock.calls).toHaveLength(calls);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh current page' }));
  await waitFor(() => expect(api.mock.calls.length).toBeGreaterThan(calls));
});

describe('Office app bar', () => {
  it('places page controls in the app bar and retains search and applied drawer filters across forms and sections', async () => {
    render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.com' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Overview' });
    fireEvent.click(screen.getByRole('button', { name: 'Platform users' }));
    await screen.findByText('No customers match these filters.');
    const appbar = document.querySelector('.office-topbar');
    expect(within(appbar).getByLabelText('Search platform users')).toBeInTheDocument();
    expect(within(appbar).getByRole('button', { name: 'New customer' })).toBeInTheDocument();
    expect(document.querySelector('.office-content .office-appbar-search')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search platform users'), { target: { value: 'Buyer' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Buyer')));
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByLabelText('Status')).toHaveValue('all');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Buyer&status=inactive')));
    const beforeForm = api.mock.calls.filter(([path]) => path.startsWith('/office/platform-users?')).length;
    fireEvent.click(screen.getByRole('button', { name: 'New customer' }));
    expect(within(appbar).queryByRole('search')).not.toBeInTheDocument();
    expect(within(appbar).queryByRole('button', { name: /Filters/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByLabelText('Search platform users');
    expect(screen.getByLabelText('Search platform users')).toHaveValue('Buyer');
    expect(api.mock.calls.filter(([path]) => path.startsWith('/office/platform-users?'))).toHaveLength(beforeForm);
    fireEvent.click(screen.getByRole('button', { name: 'Tutorials' }));
    await screen.findByLabelText('Search tutorials');
    expect(screen.queryByLabelText('Search platform users')).not.toBeInTheDocument();
    expect(within(appbar).getByRole('button', { name: 'Add tutorial' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'published' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('status=published')));
    fireEvent.click(screen.getByRole('button', { name: 'Platform users' }));
    expect(screen.queryByLabelText('Search tutorials')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Search platform users')).toHaveValue('Buyer');
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    expect(screen.getByLabelText('Status')).toHaveValue('inactive');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Buyer&status=all')));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search platform users' }));
    expect(screen.getByLabelText('Search platform users')).toHaveValue('');
  });

  it('opens platform customers, retains their list across sidebar navigation and refreshes explicitly', async () => {
    const existingApi = api.getMockImplementation();
    api.mockImplementation(path => path.startsWith('/office/platform-users?')
      ? Promise.resolve({ items: [], total: 0, page: 1, last_page: 1 }) : existingApi(path));
    render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.com' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Overview' });
    fireEvent.click(screen.getByRole('button', { name: 'Platform users' }));
    await screen.findByText('No customers match these filters.');
    fireEvent.change(screen.getByLabelText('Search platform users'), { target: { value: 'Customer' } });
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Customer')));
    const count = () => api.mock.calls.filter(([path]) => path.startsWith('/office/platform-users?')).length;
    const before = count();
    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Platform users' }));
    expect(screen.getByLabelText('Search platform users')).toHaveValue('Customer');
    expect(count()).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current page' }));
    await waitFor(() => expect(count()).toBe(before + 1));
  });

  it('hides back on drawer pages and refreshes the current page', async () => {
    render(<Dashboard session={{ admin: { name: 'Office', email: 'office@example.com' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Overview' });
    expect(screen.queryByRole('button', { name: /Back to|No previous page/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Businesses' }));
    await screen.findByRole('heading', { name: 'Businesses' });
    expect(screen.queryByRole('button', { name: /Back to/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog', { name: 'Business filters' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Payment' }));
    await screen.findByRole('heading', { name: 'Payment' });
    expect(screen.queryByRole('button', { name: /Back to/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('dialog', { name: 'Payment filters' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    fireEvent.click(screen.getByRole('button', { name: 'Businesses' }));
    await screen.findByRole('heading', { name: 'Businesses' });

    const calls = api.mock.calls.filter(([path]) => path === '/office/plans').length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh current page' }));
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path === '/office/plans')).toHaveLength(calls + 1));
  });
});


it('opens the financial book from Office navigation and retains its search on browser Back', async () => {
  const current = api.getMockImplementation();
  api.mockImplementation(path => path.startsWith('/office/financial-book?') ? Promise.resolve({
    items: [], total: 0, page: 1, last_page: 1, per_page: 25, currency: 'Ks', currencies: ['Ks'], settings_version: 1,
    summary: { income: '0', expenses: '0', profit: '0', cash: '0', allocated: '0', unallocated: '0' },
    founders: [{ id: 1, name: 'Kaung Htet Tin', share_bps: 5000 }, { id: 2, name: 'Min Htet Kyaw', share_bps: 5000 }],
  }) : current(path));
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.com' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' });
  fireEvent.click(screen.getByRole('button', { name: 'Financial book' }));
  await screen.findByText('No entries match these filters.');
  const appbar = document.querySelector('.office-topbar');
  expect(within(appbar).getByLabelText('Search financial book')).toBeInTheDocument();
  expect(within(appbar).getByRole('button', { name: 'New entry' })).toBeInTheDocument();
  expect(within(appbar).getByRole('button', { name: 'Transfer' })).toBeInTheDocument();
  expect(within(appbar).getByRole('button', { name: 'Founder settings' })).toBeInTheDocument();
  expect(within(appbar).getByRole('button', { name: 'Allocate profit' })).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Founder profit' })).queryByRole('button')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search financial book'), { target: { value: 'Hosting' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Hosting')));
  const count = () => api.mock.calls.filter(([path]) => path.startsWith('/office/financial-book?')).length;
  const table = screen.getByRole('table', { name: 'Financial book entries' });
  fireEvent.click(within(appbar).getByRole('button', { name: 'Founder settings' }));
  await screen.findByRole('heading', { name: 'Founder settings' });
  await screen.findByRole('table', { name: 'Founder profit shares' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(within(appbar).queryByRole('search')).not.toBeInTheDocument();
  const before = count();
  fireEvent.click(screen.getByRole('button', { name: 'Back to Financial book' }));
  await screen.findByLabelText('Search financial book');
  expect(screen.getByRole('table', { name: 'Financial book entries' })).toBe(table);
  expect(count()).toBe(before);
  window.history.forward();
  await screen.findByRole('heading', { name: 'Founder settings' });
  await screen.findByRole('table', { name: 'Founder profit shares' });
  expect(count()).toBe(before);
  fireEvent.click(screen.getByRole('button', { name: 'Back to Financial book' }));
  await screen.findByLabelText('Search financial book');
  expect(count()).toBe(before);
  fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
  window.history.back();
  await screen.findByLabelText('Search financial book');
  expect(screen.getByLabelText('Search financial book')).toHaveValue('Hosting'); expect(count()).toBe(before);
});


it('places product review controls in the Office app bar and preserves search on browser Back', async () => {
  const current = api.getMockImplementation();
  api.mockImplementation(path => path.startsWith('/office/product-reviews?') ? Promise.resolve({ items: [], total: 0, page: 1, last_page: 1, per_page: 25 }) : current(path));
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.com' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' }); fireEvent.click(screen.getByRole('button', { name: 'Product reviews' }));
  await screen.findByText('No product reviews match these filters.');
  const appbar = document.querySelector('.office-topbar');
  expect(within(appbar).getByLabelText('Search product reviews')).toBeInTheDocument(); expect(within(appbar).getByRole('button', { name: 'New review' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search product reviews'), { target: { value: 'Buyer' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Buyer')));
  const count = () => api.mock.calls.filter(([path]) => path.startsWith('/office/product-reviews?')).length;
  const before = count(); fireEvent.click(screen.getByRole('button', { name: 'Overview' })); window.history.back();
  await screen.findByLabelText('Search product reviews'); expect(screen.getByLabelText('Search product reviews')).toHaveValue('Buyer'); expect(count()).toBe(before);
});

it('places shop review controls in the Office app bar and preserves search on browser Back', async () => {
  const current = api.getMockImplementation();
  api.mockImplementation(path => path.startsWith('/office/shop-reviews?') ? Promise.resolve({ items: [], total: 0, page: 1, last_page: 1, per_page: 25 }) : current(path));
  render(<Dashboard session={{ admin: { id: 12, name: 'Office', email: 'office@example.com' } }} onLogout={vi.fn()} onSessionChange={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Overview' }); fireEvent.click(screen.getByRole('button', { name: 'Shop reviews' }));
  await screen.findByText('No shop reviews match these filters.');
  const appbar = document.querySelector('.office-topbar');
  expect(within(appbar).getByLabelText('Search shop reviews')).toBeInTheDocument(); expect(within(appbar).getByRole('button', { name: 'New review' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search shop reviews'), { target: { value: 'Buyer' } }); fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.stringContaining('q=Buyer')));
  const count = () => api.mock.calls.filter(([path]) => path.startsWith('/office/shop-reviews?')).length;
  const before = count();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh current page' }));
  await waitFor(() => expect(count()).toBe(before + 1));
  fireEvent.click(screen.getByRole('button', { name: 'Overview' })); window.history.back();
  await screen.findByLabelText('Search shop reviews'); expect(screen.getByLabelText('Search shop reviews')).toHaveValue('Buyer'); expect(count()).toBe(before + 1);
});
