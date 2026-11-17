import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSubscriptionRefresh } from './subscriptionRefresh';

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

describe('subscription lifecycle refresh', () => {
  it('refreshes on connectivity recovery and visible app resume', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const cleanup = registerSubscriptionRefresh(refresh);

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));

    cleanup();
    window.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
