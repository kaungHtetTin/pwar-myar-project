import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useModuleNavigation } from './useModuleNavigation';

function Navigation({ initial = 'shop' }) {
  const [active, setActive] = useState(initial);
  const visit = useModuleNavigation({ identity: 'user:business', active, ready: true, enabled: ['shop', 'sell'], onRestore: setActive });
  return <><button onClick={() => { visit('shop', null, { reset: true }); setActive('shop'); }}>My Shop</button><button onClick={() => { visit('sell'); setActive('sell'); }}>Sell</button><span>{active}</span></>;
}

afterEach(() => { vi.restoreAllMocks(); history.replaceState(null, '', '/'); });

it('makes an alerted AI top-up refreshable and removes its URL when leaving the shop', () => {
  function TopupNavigation() {
    const [active, setActive] = useState('sell');
    const visit = useModuleNavigation({ identity: 'user:business', active, ready: true, enabled: ['shop', 'sell'], onRestore: setActive });
    return <><button onClick={() => { visit('shop', { scope: 'shop', view: { tab: 'sales-ai-topups', id: null, customerKey: null, topupId: 47 } }); setActive('shop'); }}>Open top-up</button><button onClick={() => { visit('sell'); setActive('sell'); }}>Sell</button></>;
  }
  render(<TopupNavigation />);
  fireEvent.click(screen.getByRole('button', { name: 'Open top-up' }));
  expect(new URLSearchParams(location.search).get('shopTopup')).toBe('47');
  expect(new URLSearchParams(location.search).get('shopTab')).toBe('sales-ai-topups');
  fireEvent.click(screen.getByRole('button', { name: 'Sell' }));
  expect(new URLSearchParams(location.search).has('shopTopup')).toBe(false);
});

it('gives the assistant a refreshable URL and removes it when returning to another module', () => {
 function AssistantNavigation() {
  const [active, setActive] = useState('products');
  const visit = useModuleNavigation({ identity: 'user:business', active, ready: true, enabled: ['products', 'assistant'], onRestore: setActive });
  return <>{['products', 'assistant'].map(id => <button key={id} onClick={() => { visit(id); setActive(id); }}>{id}</button>)}</>;
 }
 history.replaceState({ retained: 'source' }, '', '/?keep=value');
 render(<AssistantNavigation />);
 fireEvent.click(screen.getByRole('button', { name: 'assistant' }));
 expect(new URLSearchParams(location.search).get('page')).toBe('assistant');
 expect(history.state.mkposDesktopNavigation.sourceModule).toBe('products');
 fireEvent.click(screen.getByRole('button', { name: 'products' }));
 expect(new URLSearchParams(location.search).has('page')).toBe(false);
 expect(new URLSearchParams(location.search).get('keep')).toBe('value');
 expect(history.state.retained).toBe('source');
});

it('opens an alerted order with a deep-link URL while preserving the source history entry', () => {
  history.replaceState({ retained: 'source' }, '', '/?keep=value');
  function OrderNavigation() {
    const visit = useModuleNavigation({ identity: 'user:business', active: 'sell', ready: true, enabled: ['shop', 'sell'], onRestore: vi.fn() });
    return <button onClick={() => visit('shop', { scope: 'shop', view: { tab: 'orders', id: 12, customerKey: null } })}>Open alerted order</button>;
  }
  render(<OrderNavigation />);
  const capture = vi.fn(); window.addEventListener('mkpos:capture-page-source', capture);
  fireEvent.click(screen.getByRole('button', { name: 'Open alerted order' }));
  expect(new URLSearchParams(location.search).get('shopOrder')).toBe('12');
  expect(new URLSearchParams(location.search).get('keep')).toBe('value');
  expect(history.state.mkposPageNavigation.view.id).toBe(12);
  expect(history.state.mkposDesktopNavigation.sourceModule).toBe('sell');
  expect(history.state.retained).toBe('source');
  expect(capture).toHaveBeenCalledOnce();
  window.removeEventListener('mkpos:capture-page-source', capture);
});

it('replaces a customer detail with a fresh shop entry without saving a source or pushing history', () => {
  history.replaceState({ mkposDesktopNavigation: { identity: 'user:business', module: 'shop', index: 4, sourceModule: 'sell' }, mkposPageNavigation: { scope: 'shop', key: 'customer', view: { tab: 'customers', customerKey: 'account:1', id: null } } }, '', '/?shopTab=customers&shopCustomer=account%3A1');
  render(<Navigation />);
  const push = vi.spyOn(history, 'pushState');
  const capture = vi.fn(); window.addEventListener('mkpos:capture-page-source', capture);
  fireEvent.click(screen.getByRole('button', { name: 'My Shop' }));
  expect(location.search).toBe('');
  expect(history.state.mkposPageNavigation).toBeUndefined();
  expect(history.state.mkposDesktopNavigation).toEqual({ identity: 'user:business', module: 'shop', index: 0 });
  expect(push).not.toHaveBeenCalled();
  expect(capture).not.toHaveBeenCalled();
  window.removeEventListener('mkpos:capture-page-source', capture);
});

it('discards the saved shop destination when entering from another main module', () => {
  history.replaceState({ mkposPageNavigation: { scope: 'shop', key: 'order', view: { tab: 'orders', id: 12, customerKey: null } } }, '', '/?shopTab=orders&shopOrder=12&keep=value');
  render(<Navigation />);
  fireEvent.click(screen.getByRole('button', { name: 'Sell' }));
  const push = vi.spyOn(history, 'pushState');
  fireEvent.click(screen.getByRole('button', { name: 'My Shop' }));
  expect(location.search).toBe('?keep=value');
  expect(history.state.mkposPageNavigation).toBeUndefined();
  expect(push).not.toHaveBeenCalled();
});

it('keeps an assistant source entry when opening a screen from the chat dialog', () => {
  history.replaceState({ retained: 'source' }, '', '/?keep=value');
  function AssistantLink() {
    const visit = useModuleNavigation({ identity: 'user:business', active: 'products', ready: true, enabled: ['products', 'settings', 'assistant'], onRestore: vi.fn() });
    return <button onClick={() => visit('settings', null, { source: 'assistant' })}>Open Settings</button>;
  }
  render(<AssistantLink/>);
  const push = vi.spyOn(history, 'pushState');
  fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
  expect(push).toHaveBeenCalledTimes(2);
  expect(push.mock.calls[0][0].mkposDesktopNavigation).toMatchObject({ module: 'assistant', sourceModule: 'products' });
  expect(new URL(push.mock.calls[0][2]).searchParams.get('page')).toBe('assistant');
  expect(history.state.mkposDesktopNavigation).toMatchObject({ module: 'settings', sourceModule: 'assistant' });
  expect(history.state.retained).toBe('source');
  expect(new URLSearchParams(location.search).get('keep')).toBe('value');
  expect(new URLSearchParams(location.search).has('page')).toBe(false);
});

it('preserves the chat source even when its button opens the currently visible module', () => {
  function SameModuleLink() {
    const visit = useModuleNavigation({ identity: 'user:business', active: 'products', ready: true, enabled: ['products', 'assistant'], onRestore: vi.fn() });
    return <button onClick={() => visit('products', null, { source: 'assistant' })}>Open Products</button>;
  }
  render(<SameModuleLink/>);
  const push = vi.spyOn(history, 'pushState');
  fireEvent.click(screen.getByRole('button', { name: 'Open Products' }));
  expect(push).toHaveBeenCalledTimes(2);
  expect(history.state.mkposDesktopNavigation).toMatchObject({ module: 'products', sourceModule: 'assistant' });
});
