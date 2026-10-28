import { afterEach, expect, it, vi } from 'vitest';
import { startBranding } from './platformBranding';
import { makeThemePalettes } from './themeRuntime';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete window.mkposDesktop; });
it('loads branding through the configured desktop API transport and updates native chrome', async () => {
  vi.useFakeTimers();
  const palette=makeThemePalettes('#4f46e5');
  window.mkposDesktop={apiRequest:vi.fn().mockResolvedValue({ok:true,body:JSON.stringify({primary_color:'#4f46e5',theme_mode:'dark',theme_version:1,palettes:palette})}),applyTheme:vi.fn().mockResolvedValue(true)};
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const stop=startBranding('/fixture-branding-api');
  await vi.advanceTimersByTimeAsync(0);
  expect(window.mkposDesktop.apiRequest).toHaveBeenCalledWith(expect.objectContaining({path:'/branding',method:'GET'}));
  expect(fetch).not.toHaveBeenCalled();
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(window.mkposDesktop.applyTheme).toHaveBeenLastCalledWith({mode:'dark',background:palette.dark.background});
  stop();
});
