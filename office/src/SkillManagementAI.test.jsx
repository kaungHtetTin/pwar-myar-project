import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SkillManagementAI } from './SkillManagementAI';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const ready = { id: 'proposal-1', status: 'ready', estimated_cost_usd: '0.000001000', proposal: { summary: 'Improve fractional guidance.', findings: ['Add a supported-quantity check.'], test_cases: [{ request: 'Sell half a unit', expected: 'Check base unit first.' }], affects_live_agents: false,
  review: [{ action: 'update_skill', target: 'fractional', before: { draft: { body: 'Old instructions' } }, after: { draft: { body: 'Check the base unit before selling 0.5.' } } }] } };
beforeEach(() => {
  api.mockReset();
  api.mockImplementation(async path => path.endsWith('/apply') ? { ...ready, status: 'applied', result: { skill_ids: [1], created_skills: {}, agents: [] } } : path.endsWith('/discard') ? { status: 'cancelled' } : ready);
});
afterEach(() => vi.restoreAllMocks());
async function generate() {
  fireEvent.change(screen.getByLabelText('What should AI help with?'), { target: { value: 'Improve fractional instructions.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate proposal' }));
  await screen.findByText('Improve fractional guidance.');
}

it('shows exact changes and suggested checks without writing until reviewed Apply is clicked once', async () => {
  const applied = vi.fn();
  render(<SkillManagementAI context={{ skill_id: 1 }} onApplied={applied} />);
  await generate();
  expect(screen.getByText('Old instructions')).toBeVisible();
  expect(screen.getByText('Check the base unit before selling 0.5.')).toBeVisible();
  expect(screen.getByText('These examples have not been run against an agent.')).toBeVisible();
  expect(JSON.parse(api.mock.calls[0][1].body).context).toEqual({ skill_id: 1 });
  expect(api.mock.calls.some(([path]) => path.endsWith('/apply'))).toBe(false);
  const apply = screen.getByRole('button', { name: 'Apply reviewed changes' });
  expect(apply).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'I reviewed the exact changes above.' }));
  fireEvent.click(apply); fireEvent.click(apply);
  await screen.findByText('Reviewed changes applied.');
  expect(api.mock.calls.filter(([path]) => path.endsWith('/apply'))).toHaveLength(1);
  expect(applied).toHaveBeenCalledTimes(1);
});

it('discards a proposal and preserves the instruction for refinement', async () => {
  render(<SkillManagementAI />);
  await generate();
  fireEvent.click(screen.getByRole('button', { name: 'Discard proposal' }));
  await screen.findByText('Proposal discarded.');
  expect(screen.getByLabelText('What should AI help with?')).toHaveValue('Improve fractional instructions.');
  expect(screen.queryByRole('button', { name: 'Apply reviewed changes' })).not.toBeInTheDocument();
  expect(api.mock.calls.some(([path]) => path.endsWith('/apply'))).toBe(false);
});

it('invalidates a reviewed proposal when its instruction is edited', async () => {
  render(<SkillManagementAI />);
  await generate();
  fireEvent.click(screen.getByRole('checkbox', { name: 'I reviewed the exact changes above.' }));
  fireEvent.change(screen.getByLabelText('What should AI help with?'), { target: { value: 'Different task.' } });
  expect(screen.queryByRole('button', { name: 'Apply reviewed changes' })).not.toBeInTheDocument();
});

it('retains a stale proposal error without reporting success or altering the source', async () => {
  api.mockImplementation(async path => { if (path.endsWith('/apply')) throw new Error('Agent assignments changed. Generate a fresh proposal.'); return ready; });
  const applied = vi.fn();
  render(<SkillManagementAI onApplied={applied} />);
  await generate();
  fireEvent.click(screen.getByRole('checkbox', { name: 'I reviewed the exact changes above.' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply reviewed changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Agent assignments changed.');
  expect(applied).not.toHaveBeenCalled();
  expect(screen.getByLabelText('What should AI help with?')).toHaveValue('Improve fractional instructions.');
});

it('renders analysis without an Apply action and labels live changes before approval', async () => {
  api.mockResolvedValue({ ...ready, proposal: { ...ready.proposal, review: [], affects_live_agents: false } });
  const view = render(<SkillManagementAI />);
  await generate();
  expect(screen.queryByRole('button', { name: 'Apply reviewed changes' })).not.toBeInTheDocument();
  view.unmount();
  api.mockResolvedValue({ ...ready, proposal: { ...ready.proposal, affects_live_agents: true } });
  render(<SkillManagementAI context={{ agent: 'wyne_wyne' }} />);
  await generate();
  expect(screen.getByText(/changes published guidance or live assignments/)).toBeVisible();
});

it('reuses the request ID after a lost response to avoid generating and charging twice', async () => {
  api.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce(ready);
  render(<SkillManagementAI />);
  fireEvent.change(screen.getByLabelText('What should AI help with?'), { target: { value: 'Improve fractional instructions.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate proposal' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Generate proposal' }));
  await screen.findByText('Improve fractional guidance.');
  expect(JSON.parse(api.mock.calls[0][1].body).request_id).toBe(JSON.parse(api.mock.calls[1][1].body).request_id);
});

it('aborts an abandoned request and ignores its late result', async () => {
  let resolve;
  api.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<SkillManagementAI />);
  fireEvent.change(screen.getByLabelText('What should AI help with?'), { target: { value: 'Improve fractional instructions.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate proposal' }));
  const signal = api.mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  resolve(ready);
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
});
