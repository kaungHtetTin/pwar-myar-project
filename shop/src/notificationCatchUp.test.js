import { afterEach, expect, it, vi } from 'vitest';
import { trackNotificationCatchUp } from './notificationCatchUp';
afterEach(() => vi.restoreAllMocks());

it('keeps the entire paginated recovery quiet and switches back to live only after draining', () => {
  const tracker = trackNotificationCatchUp();
  const first = tracker.snapshot();
  expect(first.catchUp).toBe(true);
  tracker.settled(first, true);
  expect(tracker.snapshot()).toMatchObject({ catchUp: true, recoveryId: first.recoveryId });
  tracker.settled(tracker.snapshot(), false);
  expect(tracker.snapshot().catchUp).toBe(false);
  window.dispatchEvent(new Event('offline'));
  const missed = tracker.snapshot();
  expect(missed.catchUp).toBe(true);
  expect(missed.recoveryId).not.toBe(first.recoveryId);
  window.dispatchEvent(new Event('online'));
  tracker.settled(missed, false); // An older in-flight response cannot clear recovery.
  expect(tracker.snapshot().catchUp).toBe(true);
  tracker.settled(tracker.snapshot(), false);
  expect(tracker.snapshot().catchUp).toBe(false);
  tracker.stop();
});

it('recovers after background visibility and removes its listeners on cleanup', () => {
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  const tracker = trackNotificationCatchUp();
  tracker.settled(tracker.snapshot(), false);
  hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  tracker.settled(tracker.snapshot(), false);
  expect(tracker.snapshot().catchUp).toBe(true);
  hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  tracker.settled(tracker.snapshot(), false);
  expect(tracker.snapshot().catchUp).toBe(false);
  tracker.stop();
  window.dispatchEvent(new Event('offline'));
  expect(tracker.snapshot().catchUp).toBe(false);
});
