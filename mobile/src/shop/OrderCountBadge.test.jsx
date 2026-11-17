import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { AppShell } from '../navigation/AppShell';
import { LocaleProvider } from '../localization/LocaleProvider';
import { ShopScreen } from './ShopScreen';
import { apiRequest } from '../api/client';
import { DATA_CHANGED_EVENT } from '../navigation/dataChanges';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('./ShopLocation', () => ({ ShopLocation: () => null, ShopLocationGate: ({ children }) => children }));

it('shares the action count across navigation and Orders, clears after work and hides offline', async () => {
  let count = 123;
  apiRequest.mockImplementation(async path => path.startsWith('/shop-admin/order-notifications') ? { cursor: 8, items: [], action_required_count: count, realtime_enabled: false } : { enabled: false });
  const navigate = vi.fn();
  const session = { user: { id: 1, role: 'owner' }, business: { id: 2, name: 'Test Shop' } };
  const shop = { id: 'shop', label: 'My Shop', path: '/shop' };
  const view = offline => <LocaleProvider><AppShell session={session} modules={[shop]} activeModule={shop} pathname="/shop" offlineMode={offline} onNavigatePath={navigate}><ShopScreen session={session} pathname="/shop" onNavigate={navigate} /></AppShell></LocaleProvider>;
  const rendered = render(view(false));
  await waitFor(() => expect(document.querySelectorAll('.order-attention-badge')).toHaveLength(2));
  expect(document.querySelector('.bottom-nav-order-badge')).toHaveTextContent('99+');
  const row = screen.getByRole('button', { name: /^Orders/ });
  expect(row).toHaveTextContent('123 orders need attention');
  fireEvent.click(row);
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/shop/orders');
  const nav = screen.getByRole('navigation', { name: 'Workspace modules' });
  expect(within(nav).getByRole('button', { name: /My Shop/ })).toHaveTextContent('123 orders need attention');
  count = 0;
  fireEvent(window, new CustomEvent(DATA_CHANGED_EVENT, { detail: { modules: ['shop'] } }));
  await waitFor(() => expect(document.querySelectorAll('.order-attention-badge')).toHaveLength(0));
  expect(screen.getByRole('button', { name: /^Orders/ })).toBe(row);
  count = 3;
  fireEvent(window, new CustomEvent(DATA_CHANGED_EVENT, { detail: { modules: ['shop'] } }));
  await waitFor(() => expect(document.querySelectorAll('.order-attention-badge')).toHaveLength(2));
  rendered.rerender(view(true));
  expect(document.querySelectorAll('.order-attention-badge')).toHaveLength(0);
});
