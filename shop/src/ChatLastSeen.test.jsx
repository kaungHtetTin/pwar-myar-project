import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatLastSeen } from './ChatLastSeen';
import { LocaleContext } from './i18n';

afterEach(() => vi.useRealTimers());
it('shows elapsed shop-owner activity and supports the customer language setting', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
  const view = render(<ChatLastSeen known value="2026-10-06 11:55:00" />);
  expect(screen.getByText('Last seen 5 minutes ago')).toBeInTheDocument();
  view.rerender(<LocaleContext.Provider value="my"><ChatLastSeen known value="2026-10-06 11:55:00" /></LocaleContext.Provider>);
  expect(screen.queryByText('Last seen 5 minutes ago')).not.toBeInTheDocument();
  expect(screen.getByTitle(new Date('2026-10-06T11:55:00Z').toLocaleString()).textContent).toMatch(/အသုံးပြု/);
});
