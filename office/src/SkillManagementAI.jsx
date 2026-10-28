import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from './api';
import { OfficeModal } from './OfficeModal';
import './skill-management-ai.css';

const base = '/office/agent-skills/ai/proposals';
const labels = { create_skill: 'Create draft', update_skill: 'Update draft', publish_skill: 'Publish skill', archive_skill: 'Archive skill', restore_skill: 'Restore published version', assign_skills: 'Change assignments' };
const fields = { title: 'Name', category: 'Category', description: 'When to use', body: 'Instructions', examples: 'Examples', tools: 'Related tools', modules: 'Required modules', private: 'Private guidance', family: 'Kind', topic: 'Lookup topic', screen: 'Screen', status: 'Status', published_version: 'Published version', published_content: 'Published content', draft: 'Draft', skill: 'Skill' };
function flat(value, prefix = '') {
  return Object.fromEntries(Object.entries(value || {}).flatMap(([key, item]) => {
    const name = [prefix, fields[key] || key].filter(Boolean).join(' / ');
    return item && typeof item === 'object' && !Array.isArray(item) ? Object.entries(flat(item, name)) : [[name, item]];
  }));
}
const text = value => value == null ? 'Not set' : Array.isArray(value) ? value.join(', ') || 'None' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);
function assignmentText(item) {
  if (!item) return 'Not assigned';
  const conditions = Object.entries(item.conditions || {}).filter(([, values]) => values.length).map(([key, values]) => `${key}: ${values.join(', ')}`);
  return `${item.mode === 'always' ? 'Always' : 'On demand'}; order ${item.position}; ${item.enabled ? 'enabled' : 'disabled'}${conditions.length ? `; ${conditions.join('; ')}` : '; unrestricted'}`;
}
function diff(change) {
  if (change.action === 'assign_skills') {
    const before = Object.fromEntries((change.before?.assignments || []).map(item => [item.skill, item]));
    const after = Object.fromEntries((change.after?.assignments || []).map(item => [item.skill, item]));
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => ({ name: key, before: assignmentText(before[key]), after: assignmentText(after[key]) }));
  }
  const before = flat(change.before), after = flat(change.after);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => ({ name: key, before: text(before[key]), after: text(after[key]) }));
}

export function SkillManagementAI({ context = {}, onApplied, onBusyChange }) {
  const [instruction, setInstruction] = useState('');
  const [proposal, setProposal] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const generation = useRef(null);
  const running = useRef(false), controller = useRef(null), alive = useRef(true), busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); busyCallback.current?.(false); }; }, []);
  function start() { if (running.current) return false; running.current = true; setBusy(true); setError(''); setMessage(''); busyCallback.current?.(true); controller.current = new AbortController(); return true; }
  function stop() { running.current = false; if (alive.current) setBusy(false); busyCallback.current?.(false); }
  async function generate(event) {
    event.preventDefault();
    if (!instruction.trim() || !start()) return;
    const signature = JSON.stringify({ instruction: instruction.trim(), context });
    if (!generation.current || generation.current.signature !== signature || proposal) generation.current = { signature, id: crypto.randomUUID() };
    setProposal(null); setReviewed(false);
    try {
      const value = await api(base, { method: 'POST', body: JSON.stringify({ request_id: generation.current.id, instruction: instruction.trim(), context }), signal: controller.current.signal });
      if (alive.current) { setProposal(value); if (value.status !== 'ready') { generation.current = null; setError('This proposal is not ready. Generate a fresh proposal.'); } }
    } catch (e) { if (alive.current) setError(e.message); } finally { stop(); }
  }
  async function apply() {
    if (!reviewed || proposal?.status !== 'ready' || !start()) return;
    try {
      const value = await api(`${base}/${proposal.id}/apply`, { method: 'POST', body: JSON.stringify({ reviewed: true }), signal: controller.current.signal });
      if (!alive.current) return;
      setProposal(value); setReviewed(false); setMessage('Reviewed changes applied.');
      try { await onApplied?.(value.result); } catch { if (alive.current) setError('Changes were applied. Refresh the page to see the latest records.'); }
    } catch (e) { if (alive.current) setError(e.message); } finally { stop(); }
  }
  async function discard() {
    if (!proposal || !start()) return;
    try {
      await api(`${base}/${proposal.id}/discard`, { method: 'POST', body: '{}', signal: controller.current.signal });
      if (alive.current) { setProposal(null); setReviewed(false); setMessage('Proposal discarded.'); }
    } catch (e) { if (alive.current) setError(e.message); } finally { stop(); }
  }
  const plan = proposal?.proposal;
  return <section className="office-skill-ai" aria-label="AI skill management">
    <p>Describe the skill or assignment changes you want, or ask AI to check for conflicts. Uses the configured platform AI balance.</p>
    <form onSubmit={generate} className="office-skill-fields">
      <label>What should AI help with?<textarea required minLength={5} maxLength={6000} rows={3} disabled={busy} value={instruction} placeholder="Improve this workflow, suggest assignments, or compare conflicting skills..." onChange={event => { setInstruction(event.target.value); setProposal(null); setReviewed(false); setError(''); setMessage(''); }} /></label>
      <div className="office-skill-ai-actions"><button className="office-button-primary" type="submit" disabled={busy || instruction.trim().length < 5}><Sparkles size={16} />{busy ? 'Working...' : 'Generate proposal'}</button></div>
    </form>
    {error && <p role="alert" className="feedback error">{error}</p>}
    {message && <p role="status" className="feedback success">{message}</p>}
    {plan?.summary && <div className="office-skill-ai-proposal">
      <h3>AI proposal</h3><p className="office-skill-ai-text">{plan.summary}</p>
      {plan.findings?.length > 0 && <><h4>Findings</h4><ul>{plan.findings.map((finding, index) => <li key={index}>{finding}</li>)}</ul></>}
      {plan.review?.map((change, index) => <section className="office-skill-ai-change" key={index}>
        <h4>{labels[change.action] || change.action}: {change.target}</h4>
        {diff(change).map(row => <details key={row.name} open><summary>{row.name}</summary><div className="office-skill-grid"><div><strong>Before</strong><pre>{row.before}</pre></div><div><strong>Proposed</strong><pre>{row.after}</pre></div></div></details>)}
      </section>)}
      {plan.test_cases?.length > 0 && <section><h4>Suggested checks</h4><p>These examples have not been run against an agent.</p><ul>{plan.test_cases.map((item, index) => <li key={index}><strong>{item.request}</strong><p>{item.expected}</p></li>)}</ul></section>}
      {proposal.estimated_cost_usd != null && <small>Estimated system AI cost: ${proposal.estimated_cost_usd}</small>}
      {proposal.status === 'ready' && <>
        {plan.affects_live_agents && <p className="feedback">This proposal changes published guidance or live assignments. New agent replies will use the resulting configuration.</p>}
        {plan.review?.length > 0 && <label className="office-skill-check"><input type="checkbox" checked={reviewed} disabled={busy} onChange={event => setReviewed(event.target.checked)} />I reviewed the exact changes above.</label>}
        <div className="office-skill-ai-actions"><button type="button" disabled={busy} onClick={discard}>Discard proposal</button>{plan.review?.length > 0 && <button type="button" className="office-button-primary" disabled={busy || !reviewed} onClick={apply}>Apply reviewed changes</button>}</div>
      </>}
    </div>}
  </section>;
}

export function SkillManagementModal({ onClose, ...props }) {
  const [busy, setBusy] = useState(false);
  return <OfficeModal title="Manage skills with AI" description="Review every proposed change before applying it." className="office-skill-modal" busy={busy} onClose={onClose} footer={<button type="button" disabled={busy} onClick={onClose}>Close</button>}><SkillManagementAI {...props} onBusyChange={setBusy} /></OfficeModal>;
}
