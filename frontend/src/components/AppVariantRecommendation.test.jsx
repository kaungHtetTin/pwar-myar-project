import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppVariantRecommendation } from './AppVariantRecommendation';
import { mobileAppUrl } from './appVariantUrl';

let width, listeners;
beforeEach(() => {
  sessionStorage.clear();
  width = 393; listeners = new Set();
  vi.stubEnv('DEV', false);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return width <= 767; }, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) })));
  window.history.replaceState({}, '', '/login');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); delete window.mkposDesktop; vi.restoreAllMocks(); });

it.each([320, 393, 767])('recommends Mobile at %ipx and switches only on request', widthValue => {
  width = widthValue;
  const onSwitch = vi.fn(); render(<AppVariantRecommendation onSwitch={onSwitch} />);
  expect(screen.getByRole('dialog', { name: 'Use PwarMyar Mobile?' })).toBeVisible();
  expect(onSwitch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open mobile app' }));
  expect(onSwitch).toHaveBeenCalledExactlyOnceWith('https://mobilepos.pwarmyar.com/login');
});
it.each([768, 1024, 1199, 1200, 1440])('does not recommend switching at %ipx', widthValue => {
  width = widthValue; render(<AppVariantRecommendation />); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('dismisses for the tab session without navigating or losing the current route', () => {
  const onSwitch = vi.fn(); const view = render(<AppVariantRecommendation onSwitch={onSwitch} />);
  fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(onSwitch).not.toHaveBeenCalled(); expect(window.location.pathname).toBe('/login');
  view.unmount(); render(<AppVariantRecommendation />); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('responds to resizing and allows Escape to dismiss', () => {
  width = 900; render(<AppVariantRecommendation />);
  act(() => { width = 500; listeners.forEach(fn => fn()); }); expect(screen.getByRole('dialog')).toBeVisible();
  act(() => { width = 900; listeners.forEach(fn => fn()); }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  act(() => { width = 500; listeners.forEach(fn => fn()); });
  fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('never recommends switching from native Windows', () => {
  window.mkposDesktop = {}; render(<AppVariantRecommendation />); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps auth destinations but does not forward business queries', () => {
  window.history.replaceState({}, '', '/signup'); expect(mobileAppUrl()).toBe('https://mobilepos.pwarmyar.com/signup');
  window.history.replaceState({}, '', '/?shopOrder=99'); expect(mobileAppUrl()).toBe('https://mobilepos.pwarmyar.com/');
});
