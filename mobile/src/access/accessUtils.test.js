import { describe, expect, it } from 'vitest';
import { accessListPath, accessPageFromPath } from './accessUtils';
describe('mobile access helpers', () => {
  it('maps full-page forms and paginated lists', () => {
    expect(accessPageFromPath('/access/staff/8/password')).toEqual({ kind: 'password', id: 8 });
    expect(accessPageFromPath('/access/roles/new')).toEqual({ kind: 'role-form', id: null });
    expect(accessListPath('staff', 20, 40)).toBe('/staff?with_total=true&limit=20&offset=40');
  });
});
