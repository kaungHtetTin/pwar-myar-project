import { afterEach, expect, it, vi } from 'vitest';
import { createProductPhotoCache, observePhoto } from '../../shared/network/productPhotos.js';
import { createRefreshQueue } from '../../shared/network/refreshQueue.js';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

it('caps photo concurrency, shares identical reads and reuses bounded cached blobs', async () => {
  const cache = createProductPhotoCache({ concurrency: 2, minStartInterval: 0, maxEntries: 2 });
  const first = deferred(), second = deferred(), third = deferred();
  const load1 = vi.fn(() => first.promise), load2 = vi.fn(() => second.promise), load3 = vi.fn(() => third.promise);
  const a = cache.get('a', load1), duplicate = cache.get('a', load1), b = cache.get('b', load2), c = cache.get('c', load3);
  expect(a).toBe(duplicate);
  await Promise.resolve();
  expect(load1).toHaveBeenCalledTimes(1); expect(load2).toHaveBeenCalledTimes(1); expect(load3).not.toHaveBeenCalled();
  first.resolve(new Blob(['a'])); await a;
  await vi.waitFor(() => expect(load3).toHaveBeenCalledTimes(1));
  second.resolve(new Blob(['b'])); third.resolve(new Blob(['c'])); await Promise.all([b, c]);
  await cache.get('c', load3); expect(load3).toHaveBeenCalledTimes(1);
  const reload = vi.fn(() => new Blob(['again'])); await cache.get('a', reload); expect(reload).toHaveBeenCalledOnce();
});

it('rejects old-scope photos and queued reads when the session is cleared', async () => {
  const cache = createProductPhotoCache({ concurrency: 1 });
  const first = deferred(), old = cache.get('a', () => first.promise), queuedLoad = vi.fn();
  const queued = cache.get('b', queuedLoad);
  const oldCheck = expect(old).rejects.toMatchObject({ name: 'AbortError' });
  const queuedCheck = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
  await Promise.resolve(); cache.clear(); first.resolve(new Blob(['private']));
  await Promise.all([oldCheck, queuedCheck]); expect(queuedLoad).not.toHaveBeenCalled();
  const load = vi.fn(() => new Blob(['new session'])); await cache.get('a', load); expect(load).toHaveBeenCalledOnce();
});

it('does not retain failures and evicts blobs over the byte budget', async () => {
  const cache = createProductPhotoCache({ maxBytes: 2 });
  await expect(cache.get('a', () => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
  const load = vi.fn(() => new Blob(['large'])); await cache.get('a', load); await cache.get('a', load);
  expect(load).toHaveBeenCalledTimes(2);
});

it('paces fast downloads so a cold product grid does not open a burst of connections', async () => {
  vi.useFakeTimers();
  const cache = createProductPhotoCache(), load = vi.fn(() => new Blob(['photo']));
  const reads = ['a', 'b', 'c', 'd'].map(key => cache.get(key, load));
  await vi.advanceTimersByTimeAsync(0); expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(99); expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(201); await Promise.all(reads); expect(load).toHaveBeenCalledTimes(4);
  cache.clear();
});

it('waits for the viewport before loading a photo and disconnects when cancelled', () => {
  let callback;
  const disconnect = vi.fn(), observe = vi.fn();
  vi.stubGlobal('IntersectionObserver', class { constructor(fn) { callback = fn; } observe = observe; disconnect = disconnect; });
  const load = vi.fn(), image = document.createElement('img');
  const stop = observePhoto(image, false, load); expect(observe).toHaveBeenCalledWith(image); expect(load).not.toHaveBeenCalled();
  callback([{ isIntersecting: false }]); expect(load).not.toHaveBeenCalled();
  callback([{ isIntersecting: true }]); expect(load).toHaveBeenCalledOnce(); stop(); expect(disconnect).toHaveBeenCalled();
});

it('merges refresh bursts and waits for a running read before the follow-up', async () => {
  vi.useFakeTimers();
  const first = deferred(), refresh = vi.fn().mockReturnValueOnce(first.promise);
  const queue = createRefreshQueue(refresh);
  const a = queue.enqueue(['products']), b = queue.enqueue(['sales']);
  await vi.advanceTimersByTimeAsync(150); expect(refresh).toHaveBeenCalledExactlyOnceWith(['products', 'sales']);
  const c = queue.enqueue(['products']), d = queue.enqueue(['reports']);
  await vi.advanceTimersByTimeAsync(1000); expect(refresh).toHaveBeenCalledTimes(1);
  first.resolve(); await Promise.all([a, b]); await vi.advanceTimersByTimeAsync(150);
  await Promise.all([c, d]); expect(refresh).toHaveBeenLastCalledWith(['products', 'reports']); expect(refresh).toHaveBeenCalledTimes(2);
  queue.enqueue(['sales']); queue.stop(); await vi.advanceTimersByTimeAsync(150); expect(refresh).toHaveBeenCalledTimes(2);
});
