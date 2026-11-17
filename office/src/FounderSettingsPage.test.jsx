import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FounderSettingsPage } from './FounderSettingsPage';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
const founders = [
  { id: 1, name: 'First Founder', share_bps: 6000, is_active: true },
  { id: 2, name: 'Second Founder', share_bps: 4000, is_active: true },
  { id: 3, name: 'Past Founder', share_bps: 0, is_active: false },
];
let saved;
beforeEach(() => {
  saved = { founders: structuredClone(founders), settings_version: 4 };
  api.mockReset(); api.mockImplementation((_path, options) => {
    if (options?.method === 'PUT') {
      const body = JSON.parse(options.body);
      saved = { founders: body.founders.map((item, i) => ({ ...item, id: item.id || i + 10, is_active: true })), settings_version: saved.settings_version + 1 };
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve(saved);
  });
});
const mount = async (onBack = vi.fn()) => { render(<FounderSettingsPage onBack={onBack} />); await screen.findByRole('table', { name: 'Founder profit shares' }); return onBack; };
const edit = name => {
  fireEvent.click(screen.getByRole('button', { name: `Actions for founder ${name}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit founder' }));
};
const apply = () => fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }));
it('creates through a modal and commits exact shares together with optimistic versioning', async () => {
  await mount();
  expect(screen.getByRole('table', { name: 'Archived founders' })).toHaveTextContent('Past Founder');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('search')).not.toBeInTheDocument();
  expect(document.querySelector('.office-founder-footer button')).toBeNull();
  expect(screen.getByRole('button', { name: 'Save founders' }).closest('.office-topbar-actions')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Reset changes' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel', exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add founder' }));
  expect(screen.getByRole('form', { name: 'Add founder' }).closest('[role="dialog"]')).toHaveAccessibleName('Add founder');
  expect(screen.getByRole('button', { name: 'Close founder form' })).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Founder name'), { target: { value: 'New Founder' } });
  fireEvent.change(screen.getByLabelText('Profit share (%)'), { target: { value: '10' } });
  apply();
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save founders' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('totaling 100%');
  expect(api.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
  edit('First Founder');
  fireEvent.change(screen.getByLabelText('Profit share (%)'), { target: { value: '50' } }); apply();
  fireEvent.click(screen.getByRole('button', { name: 'Save founders' }));
  await screen.findByText('Founder settings saved. New shares apply to future allocations.');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add founder' })).toBeEnabled());
  const call = api.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(call[1].body)).toEqual({ version: 4, founders: [{ id: 1, name: 'First Founder', share_bps: 5000 }, { id: 2, name: 'Second Founder', share_bps: 4000 }, { name: 'New Founder', share_bps: 1000 }] });
  expect(screen.getByRole('button', { name: 'Save founders' })).toBeDisabled();
});
it('cancels modal edits and stages removal without writes or refetching', async () => {
  await mount(); const count = api.mock.calls.length;
  const table = screen.getByRole('table', { name: 'Founder profit shares' });
  edit('First Founder');
  fireEvent.change(screen.getByLabelText('Founder name'), { target: { value: 'Discard me' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));
  expect(table).toHaveTextContent('First Founder');
  expect(table).not.toHaveTextContent('Discard me');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for founder Second Founder' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Remove founder' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove founder', exact: true }));
  expect(table).not.toHaveTextContent('Second Founder');
  expect(screen.getByText('1 founder will be archived when you save.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Actions for founder First Founder' }));
  expect(screen.getByRole('menuitem', { name: 'Remove founder' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  edit('First Founder');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel editing' }));
  expect(api).toHaveBeenCalledTimes(count);
  expect(screen.getByRole('table', { name: 'Founder profit shares' })).toBe(table);
});
it('retains staged edits on conflicts, reloads on request and blocks duplicate saves while busy', async () => {
  await mount(); edit('First Founder');
  fireEvent.change(screen.getByLabelText('Founder name'), { target: { value: 'Renamed Founder' } }); apply();
  api.mockRejectedValueOnce(new Error('Founder settings changed. Refresh and try again.'));
  fireEvent.click(screen.getByRole('button', { name: 'Save founders' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Founder settings changed');
  expect(screen.getByRole('table', { name: 'Founder profit shares' })).toHaveTextContent('Renamed Founder');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved settings' }));
  await screen.findByRole('button', { name: 'Actions for founder First Founder' });
  edit('First Founder');
  fireEvent.change(screen.getByLabelText('Founder name'), { target: { value: 'Retry Founder' } }); apply();
  let finish; api.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Save founders' }));
  fireEvent.click(screen.getByRole('button', { name: 'Saving...' }));
  expect(screen.getByRole('button', { name: 'Add founder' })).toBeDisabled();
  expect(api.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(2);
  await act(async () => finish({ ok: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add founder' })).toBeEnabled());
});
it('requires reload after a successful write if refreshing the saved IDs fails', async () => {
  await mount(); edit('First Founder');
  fireEvent.change(screen.getByLabelText('Founder name'), { target: { value: 'Changed' } }); apply();
  api.mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Save founders' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  expect(screen.getByRole('button', { name: 'Save founders' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved settings' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add founder' })).toBeEnabled());
});
it('validates row fields and prevents a bulk save until the editor is applied or cancelled', async () => {
  await mount(); edit('First Founder');
  expect(screen.getByRole('button', { name: 'Save founders' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Profit share (%)'), { target: { value: '10.123' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Edit founder' }));
  expect(screen.getByRole('alert')).toHaveTextContent('up to two decimal places');
  fireEvent.change(screen.getByLabelText('Profit share (%)'), { target: { value: '60' } });
  fireEvent.change(screen.getByLabelText('Founder name'), { target: { value: '  First Founder  ' } }); apply();
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save founders' })).toBeDisabled();
});

it('commits a removed founder only with rebalanced shares and keeps the existing founder ID', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'Actions for founder Second Founder' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Remove founder' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove founder', exact: true }));
  edit('First Founder');
  fireEvent.change(screen.getByLabelText('Profit share (%)'), { target: { value: '100' } }); apply();
  fireEvent.click(screen.getByRole('button', { name: 'Save founders' }));
  await screen.findByText('Founder settings saved. New shares apply to future allocations.');
  const write = api.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(write[1].body)).toEqual({ version: 4, founders: [{ id: 1, name: 'First Founder', share_bps: 10000 }] });
});

it('dismisses forms and removal confirmation without changing or refetching the mounted table', async () => {
  await mount();
  const table = screen.getByRole('table', { name: 'Founder profit shares' });
  const reads = api.mock.calls.length;
  screen.getByRole('button', { name: 'Add founder' }).focus();
  fireEvent.click(screen.getByRole('button', { name: 'Add founder' }));
  fireEvent.change(screen.getByLabelText('Founder name'), { target: { value: 'Discarded' } });
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add founder' })).toHaveFocus());
  edit('First Founder');
  fireEvent.click(screen.getByRole('button', { name: 'Close founder form' }));
  edit('First Founder');
  fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Actions for founder Second Founder' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Remove founder' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep founder' }));
  expect(table).toHaveTextContent('Second Founder');
  expect(table).not.toHaveTextContent('Discarded');
  expect(screen.getByRole('table', { name: 'Founder profit shares' })).toBe(table);
  expect(api).toHaveBeenCalledTimes(reads);
});
