import { expect, it } from 'vitest';
import { appBarRoute } from './appBarRoute';
import { moduleFromPath, MOBILE_MODULES } from './modules';

it('recognizes the product sales deep link as a Reports child with a parent Back destination', () => {
  expect(appBarRoute('/reports/product-sales')).toEqual({ title: 'Product sales', backPath: '/reports' });
  expect(moduleFromPath('/reports/product-sales', MOBILE_MODULES)?.id).toBe('reports');
});
