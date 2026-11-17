import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync('public/service-worker.js', 'utf8');

function worker() {
  const handlers = {};
  let openCache;
  const put = vi.fn(async (_key, response) => response.text());
  const caches = { match: vi.fn(async () => undefined), open: vi.fn(() => new Promise(resolve => { openCache = () => resolve({ put }); })) };
  const fetch = vi.fn(async () => new Response('fresh content'));
  runInNewContext(source, {
    self: { registration: { scope: 'http://localhost:5176/' }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    URL, caches, fetch,
  });
  return { handlers, fetch, put, openCache: () => openCache() };
}

describe('PwarMyar service worker', () => {
  it.each(['navigate', 'asset'])('clones a %s response before the browser consumes it', async kind => {
    const runtime = worker();
    const pending = [];
    let responsePromise;
    runtime.handlers.fetch({
      request: { method: 'GET', url: 'http://localhost:5176/assets/app.js', mode: kind === 'navigate' ? 'navigate' : 'cors', destination: 'script' },
      respondWith: promise => { responsePromise = promise; },
      waitUntil: promise => pending.push(promise),
    });
    const response = await responsePromise;
    expect(await response.text()).toBe('fresh content');
    runtime.openCache();
    await Promise.all(pending);
    expect(runtime.put).toHaveBeenCalledOnce();
    expect(await runtime.put.mock.results[0].value).toBe('fresh content');
  });

  it.each(['/src/shop/OrderRoadmap.jsx', '/node_modules/.vite/deps/react.js', '/@vite/client'])('does not serve cached development files for %s', path => {
    const runtime = worker();
    const respondWith = vi.fn();
    runtime.handlers.fetch({ request: { method: 'GET', url: `http://localhost:5176${path}`, mode: 'cors', destination: 'script' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(runtime.fetch).not.toHaveBeenCalled();
  });
});
