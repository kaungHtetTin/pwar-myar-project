import { expect, it, vi } from 'vitest';
import { applyNativeTheme } from './nativeTheme';
import { Capacitor, SystemBars } from '@capacitor/core';
vi.mock('@capacitor/core', () => ({ Capacitor: {isNativePlatform:vi.fn()}, SystemBars:{setStyle:vi.fn().mockResolvedValue(undefined)}, SystemBarsStyle:{Dark:'DARK',Light:'LIGHT'} }));
it('keeps native system-bar content aligned with the Office mode without affecting browsers', () => {
  Capacitor.isNativePlatform.mockReturnValue(false);
  applyNativeTheme('dark'); expect(SystemBars.setStyle).not.toHaveBeenCalled();
  Capacitor.isNativePlatform.mockReturnValue(true);
  applyNativeTheme('dark'); applyNativeTheme('dark'); applyNativeTheme('light');
  expect(SystemBars.setStyle.mock.calls).toEqual([[{style:'DARK'}],[{style:'LIGHT'}]]);
  applyNativeTheme('invalid'); expect(SystemBars.setStyle).toHaveBeenCalledTimes(2);
});
