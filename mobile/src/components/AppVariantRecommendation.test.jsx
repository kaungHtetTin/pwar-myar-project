import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppVariantRecommendation } from './AppVariantRecommendation';
import { webAppUrl } from './appVariantUrl';

let width, listeners;
beforeEach(() => {
  sessionStorage.clear(); width = 1440; listeners = new Set();
  vi.stubEnv('DEV', false);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return width >= 1200; }, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) })));
  window.history.replaceState({}, '', '/login');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); delete window.Capacitor; vi.restoreAllMocks(); });

it.each([1200, 1440, 1920])('recommends the web app at %ipx and switches only on request', widthValue => {
  width = widthValue; const onSwitch = vi.fn(); render(<AppVariantRecommendation onSwitch={onSwitch} />);
  expect(screen.getByRole('dialog', { name: 'Use PwarMyar for large screens?' })).toBeVisible(); expect(onSwitch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open web app' })); expect(onSwitch).toHaveBeenCalledExactlyOnceWith('https://pos.pwarmyar.com/login');
});
it.each([393, 767, 768, 1024, 1199])('does not recommend switching at %ipx', widthValue => {
  width = widthValue; render(<AppVariantRecommendation />); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('dismisses for the tab session without navigating or changing the route', () => {
  const onSwitch = vi.fn(); const view = render(<AppVariantRecommendation onSwitch={onSwitch} />);
  fireEvent.click(screen.getByRole('button', { name: 'Stay here' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(onSwitch).not.toHaveBeenCalled(); expect(window.location.pathname).toBe('/login');
  view.unmount(); render(<AppVariantRecommendation />); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('responds to resizing and Escape dismisses the recommendation', () => {
  width = 900; render(<AppVariantRecommendation />);
  act(() => { width = 1440; listeners.forEach(fn => fn()); }); expect(screen.getByRole('dialog')).toBeVisible();
  act(() => { width = 900; listeners.forEach(fn => fn()); }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  act(() => { width = 1440; listeners.forEach(fn => fn()); });
  fireEvent.keyDown(window, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('does not recommend switching inside the Android app', () => {
  window.Capacitor = { isNativePlatform: () => true }; render(<AppVariantRecommendation />); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('traps keyboard focus and restores the previous focus when dismissed', () => {
  const input = document.createElement('input'); document.body.append(input); input.focus();
  render(<AppVariantRecommendation />);
  const close = within(screen.getByRole('dialog')).getByRole('button', { name: 'Close Use PwarMyar for large screens?' });
  const switchButton = screen.getByRole('button', { name: 'Open web app' });
  expect(close).toHaveFocus(); switchButton.focus(); fireEvent.keyDown(switchButton, { key: 'Tab' }); expect(close).toHaveFocus();
  fireEvent.click(close); expect(input).toHaveFocus(); input.remove();
});
it('preserves auth destinations but does not transfer private detail paths', () => {
  window.history.replaceState({}, '', '/signup'); expect(webAppUrl()).toBe('https://pos.pwarmyar.com/signup');
  window.history.replaceState({}, '', '/sales/90/edit?secret=value'); expect(webAppUrl()).toBe('https://pos.pwarmyar.com/');
});
