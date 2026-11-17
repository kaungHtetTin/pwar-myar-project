import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

let lastMode;
export function applyNativeTheme(mode) {
  if (!['light', 'dark'].includes(mode) || !Capacitor.isNativePlatform() || mode === lastMode) return;
  lastMode = mode;
  void SystemBars.setStyle({ style: mode === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => { lastMode = undefined; });
}
