import { describe, expect, it } from 'vitest';
import { APP_ICON, BRAND_LOGO, publicAsset } from './assets';

describe('public assets', () => {
  it('uses the active Vite base instead of a server-root path', () => {
    expect(BRAND_LOGO).toBe(`${import.meta.env.BASE_URL}branding/pwarmyar-mark.png`);
    expect(APP_ICON).toBe(`${import.meta.env.BASE_URL}branding/pwarmyar-icon.png`);
    expect(publicAsset('/branding/example.png')).toBe(`${import.meta.env.BASE_URL}branding/example.png`);
  });
});
