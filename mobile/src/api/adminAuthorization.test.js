import { afterEach, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { registerAdminAuthorization } from '../../../shared/network/adminAuthorization';

afterEach(() => { vi.unstubAllGlobals(); document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/'; });
it('retries a PIN challenge with the original file and authorization fields, without changing its FormData', async () => {
  document.cookie = 'XSRF-TOKEN=test-csrf; path=/';
  const prompt = vi.fn().mockResolvedValue({ authorization_pin: '2468' });
  const unregister = registerAdminAuthorization(prompt);
  const form = new FormData(); form.append('backup', new File(['backup'], 'backup.json')); form.append('confirmation', 'RESTORE');
  const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ code: 'admin_pin_required', message: 'Admin PIN required' }) }).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetchMock);
  try {
    await expect(apiRequest('/data/restore-file', { method: 'POST', body: form })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sent = fetchMock.mock.calls[1][1];
    expect(sent.body.get('authorization_pin')).toBe('2468');
    expect(sent.body.get('backup').name).toBe('backup.json');
    expect(sent.body.get('confirmation')).toBe('RESTORE');
    expect(form.has('authorization_pin')).toBe(false);
    expect(sent.headers['Content-Type']).toBeUndefined();
  } finally { unregister(); }
});
