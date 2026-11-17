import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AssistantApprovals } from './AssistantApprovals';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
const row = { id: 9, label: 'Approve subscription payment', subject_id: 3, business_id: 2, business_name: 'Test shop', proposer_name: 'Admin',
  amount: 30000, currency: 'MMK', note: 'Review the bank receipt', expires_at: '2026-10-27T12:00:00Z', funds_verification_required: true };
const result = { items: [row], total: 1, page: 1, last_page: 1 };
beforeEach(() => api.mockReset());
async function review() {
  await screen.findByRole('table', { name: 'Assistant actions awaiting approval' });
  fireEvent.click(screen.getByRole('button', { name: 'Actions for assistant action 9' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Review action' }));
}

it('requires a human funds check, submits once, and removes the reviewed row', async () => {
  let resolveApproval;
  const applied = vi.fn();
  api.mockImplementation((path, options) => options ? new Promise(resolve => { resolveApproval = resolve; }) : Promise.resolve(result));
  render(<AssistantApprovals onApplied={applied} onOpenBusiness={vi.fn()} />);
  await review();
  expect(screen.getByRole('button', { name: 'Approve action' })).toBeDisabled();
  expect(api.mock.calls.filter(([, options]) => options)).toHaveLength(0);
  fireEvent.click(screen.getByRole('checkbox', { name: /independently verified/ }));
  const approve = screen.getByRole('button', { name: 'Approve action' });
  fireEvent.click(approve); fireEvent.click(approve);
  expect(api.mock.calls.filter(([, options]) => options)).toHaveLength(1);
  expect(api).toHaveBeenCalledWith('/office/assistant-approvals/9/approve', { method: 'POST', body: JSON.stringify({ confirmed: true, funds_verified: true }) });
  api.mockResolvedValue({ items: [], total: 0, page: 1, last_page: 1 });
  resolveApproval({ status: 'approved' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(applied).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('No assistant actions are waiting for approval.')).toBeVisible();
});

it('keeps the review open on failure and cancels without changing records', async () => {
  api.mockImplementation((_path, options) => options ? Promise.reject(new Error('Proposal expired')) : Promise.resolve(result));
  const open = vi.fn();
  render(<AssistantApprovals onOpenBusiness={open} />);
  await review();
  fireEvent.click(screen.getByRole('button', { name: 'View business' }));
  expect(open).toHaveBeenCalledWith(2);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Approve action' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Proposal expired');
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBeVisible();
  expect(api.mock.calls.filter(([, options]) => options)).toHaveLength(1);
});

it('rejects only the proposal and does not invoke the approval callback', async () => {
  const applied = vi.fn();
  api.mockImplementation((_path, options) => Promise.resolve(options ? { status: 'rejected' } : result));
  render(<AssistantApprovals onApplied={applied} onOpenBusiness={vi.fn()} />);
  await review();
  fireEvent.click(screen.getByRole('button', { name: 'Reject proposal' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api).toHaveBeenCalledWith('/office/assistant-approvals/9/reject', { method: 'POST', body: '{}' });
  expect(applied).not.toHaveBeenCalled();
});
