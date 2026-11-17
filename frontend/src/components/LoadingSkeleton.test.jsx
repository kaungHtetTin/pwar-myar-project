import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { LoadingState, TableLoadingState, TableSkeletonRows } from './common';

it('keeps loading rows aligned with the real table and excludes placeholders from accessibility', () => {
  const { container, rerender } = render(<table><thead><tr><th>Product</th><th>Price</th></tr></thead><tbody><TableSkeletonRows columns={2} identityColumn={0} /></tbody></table>);
  expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  expect(screen.getAllByRole('row')).toHaveLength(1);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(6);
  for (const row of container.querySelectorAll('tbody tr')) {
    expect(row.children).toHaveLength(2);
    expect(row.querySelectorAll('.skeleton-avatar')).toHaveLength(1);
  }
  rerender(<><table><tbody><tr><td>Existing product</td><td>1,000 Ks</td></tr></tbody></table><TableLoadingState refreshing /></>);
  expect(screen.getByRole('status')).toHaveTextContent('Refreshing records…');
  expect(screen.getByText('Existing product')).toBeVisible();
  expect(container.querySelector('.table-skeleton-row')).toBeNull();
});

it.each(['form', 'cards', 'list', 'report'])('announces %s loading once without exposing fake controls', variant => {
  const { container } = render(<LoadingState variant={variant}>Loading this section…</LoadingState>);
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Loading this section…');
  expect(screen.queryByRole('button')).toBeNull();
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(container.querySelector('.loading-skeleton-content')).toHaveAttribute('aria-hidden', 'true');
});
