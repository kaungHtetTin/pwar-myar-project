import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatLastSeen } from './ChatLastSeen';
import { lastSeenLabel } from '../shopChatPresentation';

afterEach(() => vi.useRealTimers());
it('formats elapsed offline time and keeps active status separate', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  expect(lastSeenLabel('2026-10-06 11:59:30', now)).toBe('Last seen just now');
  expect(lastSeenLabel('2026-10-06 11:55:00', now)).toBe('Last seen 5 minutes ago');
  expect(lastSeenLabel('2026-10-06 10:00:00', now)).toBe('Last seen 2 hours ago');
  expect(lastSeenLabel('2026-10-04 12:00:00', now)).toBe('Last seen 2 days ago');
  expect(lastSeenLabel(null, now)).toBe('');
  expect(lastSeenLabel('invalid', now)).toBe('');
  vi.useFakeTimers(); vi.setSystemTime(now);
  const view = render(<ChatLastSeen active={false} known value="2026-10-06 11:55:00" />);
  expect(screen.getByText('Last seen 5 minutes ago')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByText('Last seen 6 minutes ago')).toBeInTheDocument();
  view.rerender(<ChatLastSeen active known value="2026-10-06 11:55:00" />);
  expect(screen.getByText('Active now')).toBeInTheDocument();
});
