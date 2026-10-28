import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { PaymentReferenceSummary } from '../transactions/PaymentReferenceParts';

const kpiCss = readFileSync('src/styles/kpi-cards.css', 'utf8');

describe('shared mobile KPI card system', () => {
  it.each([
    '.expense-summary-grid',
    '.customer-overview-grid',
    '.transaction-summary',
    '.report-mobile-grid',
    '.report-account-grid-mobile',
    '.billing-summary',
    '.access-summary',
    '.customer-detail-summary',
    '.supplier-detail-summary',
    '.supplier-account-summary',
    '.purchase-detail-summary',
    '.sale-detail-summary',
  ])('includes %s in the shared KPI stylesheet', (selector) => {
    expect(kpiCss).toContain(selector);
  });

  it('uses the Products card dimensions and surface tokens', () => {
    expect(kpiCss).toContain('min-height: 4.45rem');
    expect(kpiCss).toContain('grid-template-columns: 2.35rem minmax(0, 1fr)');
    expect(kpiCss).toContain('border-radius: var(--radius-surface)');
    expect(kpiCss).toContain('box-shadow: 0 .25rem .8rem color-mix(in srgb, var(--theme-shadow) 4.5%, transparent)');
  });

  it('keeps incoming and outgoing amounts and labels available in the payment summary', () => {
    render(React.createElement(PaymentReferenceSummary, { summary: { incoming: 1000, outgoing: 500, incoming_count: 2, outgoing_count: 1 }, currency: 'Ks' }));
    const summary = screen.getByRole('region', { name: 'Matching payment summary' });
    expect(within(summary).getByText('Customer payments received')).toBeVisible();
    expect(within(summary).getByText('1,000 Ks')).toBeVisible();
    expect(within(summary).getByText('Shop pays customers')).toBeVisible();
    expect(within(summary).getByText('500 Ks')).toBeVisible();
    expect(within(summary).getByText('2 payments')).toBeVisible();
    expect(within(summary).getByText('1 payment')).toBeVisible();
  });
});
