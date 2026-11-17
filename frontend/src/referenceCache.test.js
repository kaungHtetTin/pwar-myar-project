import { expect, it, vi } from 'vitest';
import { createReferenceCache } from '../../shared/network/referenceCache.js';

it('reuses reference data across pages and coalesces concurrent first reads without sharing mutable values', async () => {
  const cache = createReferenceCache(); cache.identity('business:1:10');
  const fetch = vi.fn(async () => ({ categories: ['Pens'] }));
  const [a, b] = await Promise.all([cache.request('/categories', {}, fetch), cache.request('/categories', {}, fetch)]);
  a.categories.push('Wrong');
  expect(b.categories).toEqual(['Pens']);
  expect(await cache.request('/categories', {}, fetch)).toEqual({ categories: ['Pens'] });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('invalidates only changed reference resources and explicit refresh bypasses the cache', async () => {
  const cache = createReferenceCache(); cache.identity('business:1:10');
  const settings = vi.fn(async () => ({ currency: 'Ks' })), categories = vi.fn(async () => ['Pens']);
  await cache.request('/settings', {}, settings); await cache.request('/categories', {}, categories);
  cache.invalidate(['sales']);
  await cache.request('/settings', {}, settings);
  expect(settings).toHaveBeenCalledTimes(1);
  cache.invalidate(['settings']);
  await cache.request('/settings', {}, settings); await cache.request('/categories', {}, categories);
  expect(settings).toHaveBeenCalledTimes(2); expect(categories).toHaveBeenCalledTimes(1);
  await cache.request('/categories', { cache: 'reload' }, categories);
  expect(categories).toHaveBeenCalledTimes(2);
  cache.invalidate(['products']);
  await cache.request('/categories', {}, categories);
  expect(categories).toHaveBeenCalledTimes(2);
  cache.invalidate(['categories']);
  await cache.request('/categories', {}, categories);
  expect(categories).toHaveBeenCalledTimes(3);
});

it('clears identity data and ignores a late response from the old session', async () => {
  const cache = createReferenceCache(); cache.identity('business:1:10');
  let finish;
  const old = cache.request('/settings', {}, () => new Promise(resolve => { finish = resolve; }));
  const rejected = expect(old).rejects.toThrow('Session changed');
  await Promise.resolve();
  cache.identity('business:2:20'); finish({ shop: 'Old tenant' }); await rejected;
  const fetch = vi.fn(async () => ({ shop: 'New tenant' }));
  expect(await cache.request('/settings', {}, fetch)).toEqual({ shop: 'New tenant' });
});

it('cancellation of one page does not cancel another subscriber to the same read', async () => {
  const cache = createReferenceCache(); cache.identity('business:1:10');
  let finish; const controller = new AbortController();
  const fetch = vi.fn(() => new Promise(resolve => { finish = resolve; }));
  const a = cache.request('/settings', { signal: controller.signal }, fetch);
  const rejected = expect(a).rejects.toThrow('Request cancelled');
  const b = cache.request('/settings', {}, fetch);
  await Promise.resolve(); controller.abort(); finish({ currency: 'Ks' });
  await rejected; expect(await b).toEqual({ currency: 'Ks' }); expect(fetch).toHaveBeenCalledTimes(1);
});

it('never caches failures, sessions or mutations and invalidates metadata after a write', async () => {
  const cache = createReferenceCache(); cache.identity('business:1:10');
  const failed = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({ value: 2 });
  await expect(cache.request('/settings', {}, failed)).rejects.toThrow('Unavailable');
  expect(await cache.request('/settings', {}, failed)).toEqual({ value: 2 });
  cache.mutation('/settings', 'PUT');
  await cache.request('/settings', {}, failed); expect(failed).toHaveBeenCalledTimes(3);
  const session = vi.fn(async () => ({}));
  await cache.request('/auth/me', {}, session); await cache.request('/auth/me', {}, session);
  await cache.request('/settings', { method: 'PUT' }, session);
  await cache.request('/settings', { method: 'PUT' }, session);
  expect(session).toHaveBeenCalledTimes(4);
});

it('does not let a response started before a change overwrite the current settings', async () => {
  const cache = createReferenceCache(); cache.identity('business:1:10');
  let finish;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValue({ name: 'Updated shop' });
  const old = cache.request('/settings', {}, fetch);
  await Promise.resolve();
  cache.invalidate(['settings']);
  expect(await cache.request('/settings', {}, fetch)).toEqual({ name: 'Updated shop' });
  finish({ name: 'Old shop' });
  expect(await old).toEqual({ name: 'Updated shop' });
  expect(fetch).toHaveBeenCalledTimes(2);
});
