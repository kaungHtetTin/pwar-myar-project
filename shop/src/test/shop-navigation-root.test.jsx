import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { go, goBack, useShopRoute } from '../shopNavigation';

afterEach(cleanup);
const start = (route = '/marketplace', root = '/marketplace') => {
  history.replaceState({ retainedMetadata: 'preserved' }, '', `#${route}`);
  return renderHook(() => useShopRoute(root));
};
async function traverse(action, route) {
  const popped = new Promise(resolve => window.addEventListener('popstate', resolve, { once: true }));
  await act(async () => { action(); await popped; });
  await waitFor(() => expect(location.hash).toBe(`#${route}`));
}

it('makes Home the root and retains unrelated history metadata', async () => {
  const { result } = start();
  const key = result.current.key;
  for (let count = 0; count < 3; count++) {
    await traverse(() => history.back(), '/marketplace');
    expect(history.state.mkposShopNavigation).toMatchObject({ index: 0, kind: 'active' });
    expect(history.state.retainedMetadata).toBe('preserved');
    expect(result.current.key).toBe(key);
  }
});

it('unwinds nested visits with Back and Forward using the same page keys', async () => {
  const { result } = start();
  act(() => go('/store/demo')); const shopKey = result.current.key;
  act(() => go('/store/demo/products/1')); const productKey = result.current.key;
  await traverse(() => goBack('/marketplace'), '/store/demo');
  expect(result.current.key).toBe(shopKey);
  await traverse(() => history.forward(), '/store/demo/products/1');
  expect(result.current.key).toBe(productKey);
  await traverse(() => history.back(), '/store/demo');
  await traverse(() => history.back(), '/marketplace');
});

it('resets the stack when Home is selected and does not revisit old screens', async () => {
  start();
  act(() => go('/cart'));
  act(() => go('/account/login'));
  act(() => go('/marketplace'));
  expect(history.state.mkposShopNavigation.index).toBe(0);
  await traverse(() => history.back(), '/marketplace');
  act(() => go('/chats'));
  await traverse(() => goBack('/cart'), '/marketplace');
  await traverse(() => history.back(), '/marketplace');
});

it('puts direct links above Home and preserves the stack after reload', async () => {
  const initial = start('/store/demo/products/1');
  expect(initial.result.current.route).toBe('/store/demo/products/1');
  const key = initial.result.current.key;
  initial.unmount();
  const restored = renderHook(() => useShopRoute('/marketplace'));
  expect(restored.result.current.key).toBe(key);
  await traverse(() => goBack('/store/demo'), '/marketplace');
});

it('accepts native hash navigation and resets the stack for a native Home link', async () => {
  const { result } = start();
  act(() => { location.hash = '/account/login'; });
  await waitFor(() => expect(result.current.route).toBe('/account/login'));
  expect(history.state.mkposShopNavigation.index).toBe(1);
  act(() => { location.hash = '/marketplace'; });
  await waitFor(() => expect(result.current.route).toBe('/marketplace'));
  expect(history.state.mkposShopNavigation.index).toBe(0);
  await traverse(() => history.back(), '/marketplace');
});

it('uses the configured storefront Home and consumes WebView Back at the root', async () => {
  const { result } = start('/cart', '/store/default');
  const event = new Event('backbutton', { cancelable: true });
  await traverse(() => document.dispatchEvent(event), '/store/default');
  expect(event.defaultPrevented).toBe(true);
  const rootBack = new Event('backbutton', { cancelable: true });
  act(() => document.dispatchEvent(rootBack));
  expect(result.current.route).toBe('/store/default');
  expect(rootBack.defaultPrevented).toBe(true);
});
