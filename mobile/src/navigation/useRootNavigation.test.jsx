import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useRootNavigation } from './useRootNavigation';
import { historyIndex } from './historyNavigation';

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: vi.fn(() => 'web') } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async () => ({ remove: vi.fn() })), exitApp: vi.fn(), minimizeApp: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  Capacitor.getPlatform.mockReturnValue('web');
  window.history.replaceState({ preserved: 'metadata' }, '', '/sell');
});
function setup() {
  const onPathChange = vi.fn();
  return renderHook(() => useRootNavigation({ rootPath: '/sell', identity: 'owner:shop', pathname: window.location.pathname, onPathChange }));
}
const browserBack = async (path) => {
  act(() => window.history.back());
  await waitFor(() => expect(window.location.pathname).toBe(path));
  await waitFor(() => expect(window.history.state.mkposRootEntry).not.toBe('base'));
};

it('keeps repeated browser Back at Sell and preserves unrelated history metadata', async () => {
  window.history.pushState({}, '', '/products');
  window.history.pushState({ preserved: 'metadata' }, '', '/sell');
  setup();
  for (let i = 0; i < 3; i++) {
    const pop = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
    act(() => window.history.back()); await pop;
    expect(window.location.pathname).toBe('/sell');
    expect(historyIndex()).toBe(0);
    expect(window.history.state).toMatchObject({ preserved: 'metadata', mkposRootEntry: 'active' });
  }
});

it('unwinds page visits and makes explicitly selecting Sell a new boundary', async () => {
  const { result } = setup();
  act(() => result.current.navigate('/products'));
  act(() => result.current.navigate('/reports'));
  await browserBack('/products');
  await browserBack('/sell');
  act(() => window.history.forward());
  await waitFor(() => expect(window.location.pathname).toBe('/products'));
  await browserBack('/sell');
  act(() => result.current.navigate('/products'));
  act(() => result.current.navigate('/sell'));
  expect(historyIndex()).toBe(0);
  await browserBack('/sell');
});

it('seeds direct-link parents and keeps query/hash context', async () => {
  window.history.replaceState({}, '', '/settings/prices/Wholesale/edit?source=fixture#rule');
  setup();
  expect(window.location.search).toBe('?source=fixture');
  expect(window.location.hash).toBe('#rule');
  await browserBack('/settings/prices');
  await browserBack('/settings');
  await browserBack('/sell');
});

it('blocks a multi-entry Back jump into visits from before an explicit Sell return', async () => {
  const { result } = setup();
  act(() => result.current.navigate('/products'));
  act(() => result.current.navigate('/reports'));
  act(() => result.current.navigate('/sell'));
  const pop = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  act(() => window.history.go(-2)); await pop;
  expect(window.location.pathname).toBe('/sell');
  expect(historyIndex()).toBe(0);
});

it('preserves the rooted history across a reload/remount', async () => {
  const first = setup();
  act(() => first.result.current.navigate('/products'));
  const state = window.history.state, length = window.history.length;
  first.unmount();
  setup();
  expect(window.history.length).toBe(length);
  expect(window.history.state).toEqual(state);
  await browserBack('/sell');
});

it('closes an overlay before browser Back changes pages', async () => {
  const { result } = setup();
  act(() => result.current.navigate('/products'));
  const overlay = event => event.preventDefault();
  window.addEventListener('mkpos:hardware-back', overlay, { once: true });
  let pops = 0;
  const countPop = () => { pops++; };
  window.addEventListener('popstate', countPop);
  act(() => window.history.back());
  await waitFor(() => expect(pops).toBe(2));
  window.removeEventListener('popstate', countPop);
  await waitFor(() => expect(window.location.pathname).toBe('/products'));
  await browserBack('/sell');
});

it('exits Android only at Sell, after overlay dismissal', async () => {
  Capacitor.getPlatform.mockReturnValue('android');
  const { result } = setup();
  const hardwareBack = CapacitorApp.addListener.mock.calls.find(([name]) => name === 'backButton')[1];
  const overlay = event => event.preventDefault();
  window.addEventListener('mkpos:hardware-back', overlay, { once: true });
  act(() => hardwareBack());
  expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
  act(() => result.current.navigate('/products'));
  act(() => hardwareBack());
  await waitFor(() => expect(window.location.pathname).toBe('/sell'));
  expect(CapacitorApp.exitApp).not.toHaveBeenCalled();
  act(() => hardwareBack());
  expect(CapacitorApp.exitApp).toHaveBeenCalledOnce();
  expect(CapacitorApp.minimizeApp).not.toHaveBeenCalled();
});
