import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { OfficeTablePagination } from './OfficeTable';

function PaginationHarness() {
  const [page, setPage] = useState(2), [perPage, setPerPage] = useState(25);
  return <OfficeTablePagination label="Customer" total={251} page={page} perPage={perPage} lastPage={Math.ceil(251 / perPage)}
    onPageChange={setPage} onPerPageChange={size => { setPerPage(size); setPage(1); }} />;
}

describe('Global Office table footer', () => {
  it('supports all four paging controls and resets page when row size changes', async () => {
    const user = userEvent.setup(); render(<PaginationHarness />);
    expect(screen.getByRole('status')).toHaveTextContent('26–50 of 251 customers');
    await user.click(screen.getByRole('button', { name: 'Last' }));
    expect(screen.getByText('Page 11 of 11')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('251–251 of 251 customers');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Last' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Page 10 of 11')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'First' }));
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'First' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 11')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Rows per page'), '100');
    expect(screen.getByText('Page 1 of 3')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('1–100 of 251 customers');
    screen.getByRole('button', { name: 'Next' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('Page 2 of 3')).toBeVisible();
  });

  it('disables pagination and row-size changes during a mutation', () => {
    render(<OfficeTablePagination label="Payment" total={100} page={2} perPage={25} lastPage={4} disabled />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByLabelText('Rows per page')).toBeDisabled();
  });

  it('shows zero matching rows and the optional global total without negative ranges', () => {
    render(<OfficeTablePagination label="Businesses" total={0} page={1} perPage={25} lastPage={1} overallTotal={12} />);
    expect(screen.getByRole('status')).toHaveTextContent('0 of 0 matching businesses · 12 total');
    expect(screen.getByText('Page 1 of 1')).toBeVisible();
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
