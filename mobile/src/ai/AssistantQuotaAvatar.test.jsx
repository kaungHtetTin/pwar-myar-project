import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AssistantQuotaAvatar, AssistantQuotaReset } from './AssistantQuotaAvatar';
import { weeklyProgress } from './weeklyProgress';

it('shows accurate remaining percent, including fractional and empty credit, without inventing unknown credit', () => {
  const view = render(<AssistantQuotaAvatar usage={{ limit: 50, remaining: 40 }}/>);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '40 of 50 AI requests remaining this week (80%)');
  expect(screen.getByText('80%')).toBeVisible();
  view.rerender(<AssistantQuotaAvatar usage={{ limit: 500, remaining: 1 }}/>);
  expect(screen.getByText('0.2%')).toBeVisible();
  view.rerender(<AssistantQuotaAvatar usage={{ limit: 50, remaining: -2 }}/>);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByRole('progressbar')).toHaveAttribute('data-empty', 'true');
  view.rerender(<AssistantQuotaAvatar/>);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

it('interpolates green through yellow to red while clamping out-of-range values', () => {
  expect(weeklyProgress({limit:100,remaining:100}).color).toContain('var(--theme-success) 100%');
  expect(weeklyProgress({limit:100,remaining:75}).color).toContain('var(--theme-success) 50%');
  expect(weeklyProgress({limit:100,remaining:50}).color).toContain('var(--theme-success) 0%, var(--theme-warning)');
  expect(weeklyProgress({limit:100,remaining:25}).color).toContain('var(--theme-warning) 50%');
  expect(weeklyProgress({limit:100,remaining:0}).color).toContain('var(--theme-warning) 0%, var(--theme-danger)');
  expect(weeklyProgress({limit:50,remaining:60}).percent).toBe(100);
  expect(weeklyProgress({limit:0,remaining:0})).toBeNull();
});

it('shows the server reset instant in Yangon time and hides unknown reset dates', () => {
  const view = render(<AssistantQuotaReset usage={{ resets_at: '2026-10-25T17:30:00Z' }}/>);
  expect(screen.getByText('Resets Mon, Oct 26')).toBeVisible();
  expect(screen.queryByText('12:00 AM · Yangon')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Next weekly reset:.*2026.*Asia\/Yangon/)).toHaveAttribute('datetime', '2026-10-25T17:30:00Z');
  view.rerender(<AssistantQuotaReset usage={{ resets_at: 'invalid' }}/>);
  expect(screen.queryByText(/Resets/)).not.toBeInTheDocument();
  expect(screen.getByText('PwarMyar assistant')).toBeVisible();
});


it('localizes quota accessibility and reset labels while preserving numeric limits and reset instants', () => {
  const view = render(<><AssistantQuotaAvatar usage={{ limit: 50, remaining: 40 }} language="my" /><AssistantQuotaReset usage={{ resets_at: '2026-10-25T17:30:00Z' }} language="my" /></>);
  const progress = screen.getByRole('progressbar');
  expect(progress.getAttribute('aria-valuetext')).toMatch(/\p{Script=Myanmar}/u);
  expect(progress.getAttribute('aria-valuetext')).toContain('50');
  expect(progress.getAttribute('aria-valuetext')).toContain('40');
  expect(progress).toHaveAttribute('aria-valuenow', '80');
  const reset = document.querySelector('time');
  expect(reset).toHaveAttribute('datetime', '2026-10-25T17:30:00Z');
  expect(reset.getAttribute('aria-label')).toMatch(/\p{Script=Myanmar}/u);
  view.rerender(<AssistantQuotaAvatar usage={{ limit: 50, remaining: 40 }} language="en" />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '40 of 50 AI requests remaining this week (80%)');
});
