import { afterEach, expect, it, vi } from 'vitest';
import { applyBranding, startBranding } from './platformBranding';
import { makeThemePalettes, themeContrast, themeRoles } from './themeRuntime';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('applies every role, dark native controls, and validated local fallback palettes', () => {
  const palettes = makeThemePalettes('#ffff00');
  applyBranding({ primary_color: '#ffff00', theme_mode: 'dark', theme_version: 100, palettes });
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  for (const role of themeRoles) expect(document.documentElement.style.getPropertyValue(`--theme-${role.replaceAll('_','-')}`)).toBe(palettes.dark[role]);
  expect(themeContrast(palettes.dark.on_primary, palettes.dark.primary)).toBeGreaterThanOrEqual(4.5);
  applyBranding({ primary_color: '#ffff00', theme_mode: 'light', theme_version: 99 });
  expect(document.documentElement.dataset.theme).toBe('dark');
  applyBranding({ primary_color: '#4f46e5', theme_mode: 'light', theme_version: 101, palettes: { light: { primary: 'red; background: url(evil)' } } });
  expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#4f46e5');
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('loads cached branding offline and reconciles branding without reloading application data', async () => {
  vi.useFakeTimers();
  const apiBase = '/fixture-theme-api';
  localStorage.setItem(`mkpos.platform-branding:${apiBase}`, JSON.stringify({ primary_color:'#4f46e5', theme_mode:'dark', theme_version:102, palettes:makeThemePalettes('#4f46e5') }));
  const fetch = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ ok:true, json:async()=>({ primary_color:'#ffff00', theme_mode:'light', theme_version:103, palettes:makeThemePalettes('#ffff00') }) });
  vi.stubGlobal('fetch', fetch);
  const stop = startBranding(apiBase);
  expect(document.documentElement.dataset.theme).toBe('dark');
  await vi.advanceTimersByTimeAsync(30150);
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/branding/realtime/config'))).toBe(true);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/branding'))).toHaveLength(2);
  expect(fetch.mock.calls.every(([url]) => url.includes('/branding'))).toBe(true);
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(JSON.parse(localStorage.getItem(`mkpos.platform-branding:${apiBase}`)).primary_color).toBe('#ffff00');
  stop();
});
