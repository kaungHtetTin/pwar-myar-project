import { afterEach, expect, it, vi } from 'vitest';
import { request } from './api';
import { runManualRefresh } from './manualRefresh';

afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'; });
it('waits for refreshed reads without holding the button for an unrelated mutation', async () => {
  document.cookie = 'XSRF-TOKEN=fixture; path=/';
  let finishRead, finishWrite, write;
  vi.stubGlobal('fetch', vi.fn((url, options) => new Promise(resolve => {
    const finish = () => resolve({ ok: true, json: async () => ({ items: [] }) });
    if (options.method === 'POST') finishWrite = finish;
    else finishRead = finish;
  })));
  const operation = runManualRefresh(() => {
    write = request('/sales', { method: 'POST', body: '{}' });
    return request('/products');
  });
  await vi.waitFor(() => expect(finishRead).toBeTypeOf('function'));
  finishRead();
  await operation;
  expect(finishWrite).toBeTypeOf('function');
  finishWrite(); await write;
});
