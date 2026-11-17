import { describe, expect, it } from 'vitest';
import { routeLocation, routePathFromLocation } from './routeBase';

describe('mobile deployment route base', () => {
  it('maps Laravel-hosted browser paths to internal application routes', () => {
    expect(routePathFromLocation('/public/mobile', '/public/mobile')).toBe('/');
    expect(routePathFromLocation('/public/mobile/products/7', '/public/mobile')).toBe('/products/7');
    expect(routeLocation('/products/7', '/public/mobile')).toBe('/public/mobile/products/7');
  });

  it('preserves root-hosted and Android routes', () => {
    expect(routePathFromLocation('/products/7', '')).toBe('/products/7');
    expect(routeLocation('/products/7', '')).toBe('/products/7');
  });
});
