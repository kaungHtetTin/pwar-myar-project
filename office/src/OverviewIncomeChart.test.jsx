import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { OverviewIncomeChart } from './OverviewIncomeChart';

const report = () => ({ current_year: 2026, currency: 'Ks', monthly_cash_flow: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, label: new Date(2026, i, 1).toLocaleString('en', { month: 'short' }), income: i === 0 ? 100 : 0, outcome: i === 0 ? 150 : 0, profit: i === 0 ? -50 : 0 })) });

it('shows annual totals and exposes exact monthly values including a loss by keyboard and hover', () => {
  render(<OverviewIncomeChart report={report()} />);
  expect(screen.getByText('-50 Ks')).toBeInTheDocument();
  const january = screen.getByRole('img', { name: 'Jan: Income 100 Ks, Outcome 150 Ks, Profit -50 Ks' });
  fireEvent.focus(january);
  expect(screen.getAllByText('-50 Ks')).toHaveLength(2);
  fireEvent.mouseEnter(screen.getByRole('img', { name: 'Feb: Income 0 Ks, Outcome 0 Ks, Profit 0 Ks' }));
  expect(screen.getAllByText('-50 Ks')).toHaveLength(1);
  const chart = screen.getByRole('group', { name: 'Monthly income, outcome and profit bars' });
  expect(chart.querySelectorAll('rect.flow-income')).toHaveLength(12);
  expect(chart.querySelectorAll('rect.flow-outcome')).toHaveLength(12);
  expect(chart.querySelectorAll('rect.flow-profit')).toHaveLength(12);
  expect(chart.querySelector('polyline')).toBeNull();
  const januaryProfit = chart.querySelector('rect.flow-profit');
  expect(Number(januaryProfit.getAttribute('height'))).toBeGreaterThan(0);
  expect(Number(januaryProfit.getAttribute('y'))).toBe(Number(chart.querySelector('.office-income-zero').getAttribute('y1')));
});

it('distinguishes an empty year from unavailable data', () => {
  const data = report(); data.monthly_cash_flow.forEach(row => { row.income = 0; row.outcome = 0; row.profit = 0; });
  const { rerender } = render(<OverviewIncomeChart report={data} />);
  expect(screen.getByText('No income or expenses recorded for 2026.')).toBeInTheDocument();
  rerender(<OverviewIncomeChart report={null} />);
  expect(screen.getByText('Monthly financial data is unavailable.')).toBeInTheDocument();
});
