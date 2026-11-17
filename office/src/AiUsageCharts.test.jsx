import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AiUsageCharts } from './AiUsageCharts';

const bucket = { key: '2026-01-01', label: 'Jan 1', requests: 3, failures: 1, input_tokens: 100, output_tokens: 20 };
const charts = { timezone: 'Asia/Yangon', series: Object.fromEntries(['hourly', 'daily', 'monthly', 'yearly'].map(key => [key, [bucket, { ...bucket, key: 'next', label: 'Jan 2', requests: 0, failures: 0, input_tokens: 0, output_tokens: 0 }]])) };

it('shows all four periods and changes the metric and focused values', () => {
  render(<AiUsageCharts charts={charts} />);
  for (const name of ['24-hour usage', 'Daily usage', 'Monthly usage', 'Yearly usage']) {
    expect(screen.getByRole('region', { name })).toBeInTheDocument();
  }
  for (const [metric, label, expected] of [['failures', 'Failures', 1], ['input_tokens', 'Input tokens', 100], ['output_tokens', 'Output tokens', 20], ['total_tokens', 'Total tokens', 120], ['requests', 'Requests', 3]]) {
    fireEvent.change(screen.getByLabelText('Chart metric'), { target: { value: metric } });
    const chart = screen.getByRole('region', { name: 'Daily usage' });
    const bar = within(chart).getByRole('img', { name: `Jan 1 Asia/Yangon: ${expected} ${label.toLowerCase()}` });
    fireEvent.focus(bar);
    expect(within(chart).getByText(`Jan 1 Asia/Yangon: ${expected} ${label.toLowerCase()}`)).toBeInTheDocument();
    fireEvent.blur(bar);
    expect(within(chart).getByText('Hover over or focus a bar to see its value.')).toBeInTheDocument();
  }
});

it('shows zero usage and unavailable data clearly', () => {
  const { rerender } = render(<AiUsageCharts charts={{ series: { hourly: [], daily: [], monthly: [], yearly: [] } }} />);
  expect(screen.getAllByText('No usage recorded for this period.')).toHaveLength(4);
  rerender(<AiUsageCharts />);
  expect(screen.getByRole('status')).toHaveTextContent('Usage charts are unavailable');
});

it('charts combined model costs with USD precision and preserves small bar values', () => {
  const usage = [
    { model: 'deepseek-flash', status: 'completed', input_tokens: 1000, output_tokens: 100 },
    { model: 'deepseek-v4-pro', status: 'completed', input_tokens: 1000, output_tokens: 100 },
  ];
  const pricing = { rates: { 'deepseek-flash': { input: 0.3, output: 1.2 }, 'deepseek-v4-pro': { input: 1.32, output: 3.96 } } };
  const series = Object.fromEntries(['hourly', 'daily', 'monthly', 'yearly'].map(key => [key, [{ ...bucket, cost_usage: usage }, { ...bucket, key: 'zero', label: 'Jan 2', cost_usage: [] }]]));
  render(<AiUsageCharts charts={{ series }} pricing={pricing} />);
  fireEvent.change(screen.getByLabelText('Chart metric'), { target: { value: 'total_cost' } });
  for (const title of ['24-hour usage', 'Daily usage', 'Monthly usage', 'Yearly usage']) {
    const chart = screen.getByRole('region', { name: title });
    const bar = within(chart).getByRole('img', { name: 'Jan 1 Asia/Yangon: $0.002136 estimated cost (usd)' });
    expect(bar.querySelector('span')).toHaveStyle({ height: '100%' });
    fireEvent.focus(bar);
    expect(within(chart).getByText('Jan 1 Asia/Yangon: $0.002136 estimated cost (usd)')).toBeInTheDocument();
    expect(within(chart).getByRole('img', { name: 'Jan 2 Asia/Yangon: $0.000000 estimated cost (usd)' })).toBeInTheDocument();
  }
});

it('does not treat unavailable prices as zero or display partial totals', () => {
  const series = { daily: [{ ...bucket, cost_usage: [{ model: 'unknown', status: 'completed', input_tokens: 100, output_tokens: 20 }] }] };
  render(<AiUsageCharts charts={{ series }} pricing={{ rates: {} }} />);
  fireEvent.change(screen.getByLabelText('Chart metric'), { target: { value: 'total_cost' } });
  const chart = screen.getByRole('region', { name: 'Daily usage' });
  expect(within(chart).getByRole('img', { name: 'Jan 1 Asia/Yangon: Unavailable estimated cost (usd)' })).toBeInTheDocument();
  expect(within(chart).getByText('Cost unavailable for some requests; check pricing availability.')).toBeInTheDocument();
});

it('abbreviates token totals and axes while keeping exact values on focus', () => {
  const { rerender } = render(<AiUsageCharts charts={{ series: { daily: [{ ...bucket, input_tokens: 1250 }] } }} />);
  fireEvent.change(screen.getByLabelText('Chart metric'), { target: { value: 'input_tokens' } });
  for (const [amount, compact] of [[1250, '1.25k'], [2500000, '2.5M'], [3100000000, '3.1B'], [999999, '1M']]) {
    rerender(<AiUsageCharts charts={{ series: { daily: [{ ...bucket, input_tokens: amount }] } }} />);
    const chart = screen.getByRole('region', { name: 'Daily usage' });
    expect(within(chart).getByTitle(`${amount.toLocaleString()} tokens`)).toHaveTextContent(compact);
    const bar = within(chart).getByRole('img', { name: `Jan 1 Asia/Yangon: ${amount.toLocaleString()} input tokens` });
    fireEvent.focus(bar);
    expect(within(chart).getByText(`Jan 1 Asia/Yangon: ${amount.toLocaleString()} input tokens`)).toBeInTheDocument();
  }
});

it('uses cache-aware chart costs and exposes the cached-input metric', () => {
  const usage = { model: 'deepseek-flash', status: 'completed', input_tokens: 1000, output_tokens: 100, cached_input_tokens: 800 };
  const series = Object.fromEntries(['hourly', 'daily', 'monthly', 'yearly'].map(key => [key, [{ ...bucket, ...usage, cost_usage: [usage] }]]));
  render(<AiUsageCharts charts={{ series }} pricing={{ rates: { 'deepseek-flash': { input: 0.3, output: 1.2, cached_input: 0.006 } } }} />);
  fireEvent.change(screen.getByLabelText('Chart metric'), { target: { value: 'total_cost' } });
  expect(screen.getAllByRole('img', { name: 'Jan 1 Asia/Yangon: $0.000185 estimated cost (usd)' })).toHaveLength(4);
  fireEvent.change(screen.getByLabelText('Chart metric'), { target: { value: 'cached_input_tokens' } });
  const chart = screen.getByRole('region', { name: 'Daily usage' });
  fireEvent.focus(within(chart).getByRole('img', { name: 'Jan 1 Asia/Yangon: 800 cached input tokens' }));
  expect(within(chart).getByText('Jan 1 Asia/Yangon: 800 cached input tokens')).toBeInTheDocument();
});
