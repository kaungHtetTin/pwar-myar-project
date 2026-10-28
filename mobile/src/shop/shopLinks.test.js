import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it('links the APK to the existing customer app on its API server', async () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_SHOP_URL', ''); vi.stubEnv('VITE_API_URL', 'https://www.pwarmyar.com/public/api'); vi.resetModules();
  const { customerShopLink } = await import('./shopLinks');
  expect(customerShopLink('test-shop')).toBe('https://www.pwarmyar.com/public/shop/#/store/test-shop');
  expect(customerShopLink('test-shop', 5)).toBe('https://www.pwarmyar.com/public/shop/#/store/test-shop/products/5');
});
it('uses the running sibling customer app in development', async () => {
  vi.stubEnv('DEV', true); vi.stubEnv('VITE_SHOP_URL', ''); vi.resetModules();
  const { customerShopLink } = await import('./shopLinks');
  expect(customerShopLink('test-shop')).toBe('http://127.0.0.1:5177/#/store/test-shop');
});
it('builds encoded store and product links against the configured deployment', async () => {
  vi.stubEnv('VITE_SHOP_URL', 'https://customer.example/shop/'); vi.resetModules();
  const { customerShopLink } = await import('./shopLinks');
  expect(customerShopLink('test shop', 5)).toBe('https://customer.example/shop/#/store/test%20shop/products/5');
});
