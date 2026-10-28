import { afterEach, expect, it, vi } from 'vitest';
import { clearBackgroundCooldowns, coalesceBackgroundRequest, createPollPolicy, createSocketRecovery, guardBackgroundRequest, recordBackgroundFailure, retryAfterMilliseconds } from './backgroundPolicy';
import { debounceRefresh, rateLimitDetails, setBackgroundIdentity } from './backgroundPolicy';

afterEach(() => { clearBackgroundCooldowns(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('coalesces socket bursts and cancels deferred refresh on unmount', async () => {
  vi.useFakeTimers();
  const refresh = vi.fn(); const changed = debounceRefresh(refresh);
  for (let i = 0; i < 50; i++) changed();
  await vi.advanceTimersByTimeAsync(149); expect(refresh).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(refresh).toHaveBeenCalledOnce();
  changed(); changed.cancel(); await vi.advanceTimersByTimeAsync(1000);
  expect(refresh).toHaveBeenCalledOnce();
});

it('separates delivery cooldowns and forgets them when the account changes', () => {
  setBackgroundIdentity('business:1:9');
  recordBackgroundFailure('/ai-assistant/conversations/1/messages/client/delivery', 'GET', { status: 429, retryAfterMs: 45000 });
  expect(() => guardBackgroundRequest('/ai-assistant/conversations/2/messages/other/delivery')).toThrow();
  expect(() => guardBackgroundRequest('/ai-assistant/conversations/1/messages', 'POST')).not.toThrow();
  expect(() => guardBackgroundRequest('/activity-alerts')).not.toThrow();
  setBackgroundIdentity('business:2:9');
  expect(() => guardBackgroundRequest('/ai-assistant/conversations/1/messages/client/delivery')).not.toThrow();
  setBackgroundIdentity('');
});

it('distinguishes application throttles, weekly quotas and unmarked hosting responses', () => {
  const response = { status: 429, headers: { get: () => null } };
  expect(rateLimitDetails(response, { code: 'rate_limited', rate_limit_scope: 'action', request_id: 'trace' })).toEqual({ source: 'application', scope: 'action', requestId: 'trace' });
  expect(rateLimitDetails(response, { code: 'ai_weekly_quota' }).source).toBe('ai_weekly_quota');
  expect(rateLimitDetails(response).scope).toBe('unknown');
  expect(rateLimitDetails(response).source).toBe('upstream_or_application');
});

it('parses seconds and HTTP-date Retry-After values without retrying early', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');
  expect(retryAfterMilliseconds('45', now)).toBe(45000);
  expect(retryAfterMilliseconds('Fri, 23 Oct 2026 12:01:00 GMT', now)).toBe(60000);
  expect(retryAfterMilliseconds('invalid', now)).toBe(60000);
  expect(retryAfterMilliseconds(null, now)).toBe(60000);
});

it('uses a slow safety sync on healthy sockets and resumes fallback after disconnect', () => {
  vi.useFakeTimers();
  const policy = createPollPolicy();
  policy.success();
  vi.advanceTimersByTime(15000);
  expect(policy.due(true)).toBe(false);
  expect(policy.due(false)).toBe(true);
  vi.advanceTimersByTime(105000);
  expect(policy.due(true)).toBe(true);
});

it('backs off repeated failures, respects 429 cooldowns, and pauses hidden or offline tabs', () => {
  vi.useFakeTimers();
  const policy = createPollPolicy();
  policy.failure(new Error('offline'));
  expect(policy.ready()).toBe(false);
  vi.advanceTimersByTime(15000);
  expect(policy.ready()).toBe(true);
  policy.failure(new Error('still offline'));
  vi.advanceTimersByTime(15000);
  expect(policy.ready()).toBe(false);
  vi.advanceTimersByTime(15000);
  policy.failure({ status: 429, retryAfterMs: 45000 });
  vi.advanceTimersByTime(44999);
  expect(policy.ready()).toBe(false);
  vi.advanceTimersByTime(1);
  expect(policy.ready()).toBe(true);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  expect(policy.ready()).toBe(false);
  expect(policy.ready({ allowHidden: true })).toBe(true);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(policy.ready({ allowHidden: true })).toBe(false);
});

it('shares server-budget cooldowns across background endpoints while preserving user mutations', () => {
  vi.useFakeTimers();
  recordBackgroundFailure('/shop-admin/chat/notifications', 'GET', { status: 429, retryAfterMs: 45000 });
  expect(() => guardBackgroundRequest('/shop-admin/chat/thread/messages?after_id=1')).toThrow();
  expect(() => guardBackgroundRequest('/shop-admin/chat/auth', 'POST')).toThrow();
  expect(() => guardBackgroundRequest('/shop-admin/chat/thread/messages', 'POST')).not.toThrow();
  expect(() => guardBackgroundRequest('/sales', 'POST')).not.toThrow();
  expect(() => guardBackgroundRequest('/products')).not.toThrow();
  expect(() => guardBackgroundRequest('/activity-alerts')).not.toThrow();
  vi.advanceTimersByTime(45000);
  expect(() => guardBackgroundRequest('/shop-admin/chat/notifications')).not.toThrow();
  recordBackgroundFailure('/activity-alerts', 'GET', { status: 429, retryAfterMs: 30000 });
  expect(() => guardBackgroundRequest('/shop-admin/order-notifications/config')).toThrow();
  clearBackgroundCooldowns();
  expect(() => guardBackgroundRequest('/activity-alerts')).not.toThrow();
});

it('coalesces simultaneous reads but keeps writes, abort signals and auth contexts independent', async () => {
  let resolve;
  const perform = vi.fn(() => new Promise(done => { resolve = done; }));
  const first = coalesceBackgroundRequest('/activity-alerts', {}, perform);
  const second = coalesceBackgroundRequest('/activity-alerts', {}, perform);
  await Promise.resolve();
  expect(perform).toHaveBeenCalledOnce();
  resolve({ items: [] });
  expect(await first).toEqual(await second);
  const immediate = vi.fn(async () => ({}));
  await Promise.all([
    coalesceBackgroundRequest('/sales', { method: 'POST' }, immediate),
    coalesceBackgroundRequest('/sales', { method: 'POST' }, immediate),
    coalesceBackgroundRequest('/activity-alerts', { signal: new AbortController().signal }, immediate),
    coalesceBackgroundRequest('/activity-alerts', { customerAuth: true }, immediate),
    coalesceBackgroundRequest('/activity-alerts', { customerAuth: false }, immediate),
  ]);
  expect(immediate).toHaveBeenCalledTimes(5);
});

it('recovers rejected socket connections at most once per thirty seconds and cleans up', () => {
  vi.useFakeTimers();
  const socket = { connected: false, active: false, connect: vi.fn() };
  const recovery = createSocketRecovery(socket);
  recovery.retry(); recovery.retry();
  expect(socket.connect).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(30000);
  expect(socket.connect).toHaveBeenCalledTimes(2);
  socket.connected = true;
  vi.advanceTimersByTime(30000);
  expect(socket.connect).toHaveBeenCalledTimes(2);
  recovery.stop(); socket.connected = false;
  vi.advanceTimersByTime(60000);
  expect(socket.connect).toHaveBeenCalledTimes(2);
});
