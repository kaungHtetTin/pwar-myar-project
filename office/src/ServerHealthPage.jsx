import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, PauseCircle, RefreshCw, Server, XCircle } from 'lucide-react';
import { api } from './api';
import { officeDateTime } from './dateTime';
import { useRetainedActivity } from './retainedActivity';
import { OfficePageToolbar, OfficeStatusFilterDrawer } from './OfficePageToolbar';
import './server-health.css';

const states = {
  healthy: { label: 'Healthy', icon: CheckCircle2 },
  warning: { label: 'Needs attention', icon: AlertTriangle },
  unhealthy: { label: 'Unhealthy', icon: XCircle },
  disabled: { label: 'Not required', icon: PauseCircle },
  unknown: { label: 'Unverified', icon: CircleHelp },
};
const scopes = { live: 'Live check', local: 'Server check', configuration: 'Configuration', heartbeat: 'Heartbeat' };

export function ServerHealthPage({ refreshToken = 0 }) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const busy = useRef(false), mounted = useRef(false);
  const active = useRetainedActivity();
  useEffect(() => {
    if (active) return;
    const timer = setTimeout(() => setFilterOpen(false), 0);
    return () => clearTimeout(timer);
  }, [active]);
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState(current => ({ ...current, loading: true }));
    try {
      const data = await api('/office/health/system');
      if (!['healthy', 'degraded', 'unhealthy'].includes(data.status) || !Array.isArray(data.checks) || !data.checked_at || data.checks.some(check => !states[check.status])) throw new Error('Invalid health response.');
      if (mounted.current) setState({ data, loading: false, error: '' });
    } catch {
      if (mounted.current) setState(current => ({ ...current, loading: false, error: 'Server health could not be refreshed. Retry to get current results.' }));
    } finally { busy.current = false; }
  }, []);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load, refreshToken]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000);
    return () => clearInterval(timer);
  }, [active, load]);

  const data = state.data;
  const counts = Object.keys(states).map(status => ({ status, count: data?.checks.filter(check => check.status === status).length ?? 0 }));
  const filtered = data?.checks.filter(check => {
    const matchesStatus = !status || (status === 'attention' ? ['unhealthy', 'warning', 'unknown'].includes(check.status) : check.status === status);
    return matchesStatus && `${check.label} ${check.group} ${check.message}`.toLowerCase().includes(search.trim().toLowerCase());
  }) || [];
  const groups = [...new Set(filtered.map(check => check.group))];
  const overall = state.error ? 'Unavailable' : !data ? 'Checking' : ({ healthy: 'Healthy', degraded: 'Needs attention', unhealthy: 'Unhealthy' })[data.status];

  return <section className="office-panel office-server-health" aria-label="Server health">
    <OfficePageToolbar searchLabel="Search server health" placeholder="Search components..." search={search} onSearchChange={setSearch} onSearch={() => {}} onClearSearch={() => setSearch('')} onFilterOpen={() => setFilterOpen(true)} filterOpen={filterOpen} filterCount={status ? 1 : 0} extraActions={<button type="button" disabled={state.loading} onClick={() => void load()}><RefreshCw size={14} className={state.loading ? 'office-spin' : undefined}/>{state.loading ? 'Checking...' : 'Check now'}</button>}/>
    <OfficeStatusFilterDrawer open={active && filterOpen} title="Server health filters" status={status} options={[[ '', 'All statuses' ],['attention','Needs attention'],...Object.entries(states).map(([key,value]) => [key,value.label])]} onApply={value => {setStatus(value);setFilterOpen(false);}} onClear={() => {setStatus('');setFilterOpen(false);}} onClose={() => setFilterOpen(false)}/>
    <div className="office-panel-header office-health-header"><div className="office-health-title"><Server size={16}/><h2>System checks</h2><span className={`office-health-badge is-${state.error ? 'unknown' : data?.status || 'unknown'}`}><Activity size={13}/>{overall}</span></div><p>{data ? `Last checked: ${officeDateTime(data.checked_at)}` : 'Checking server components...'}</p></div>
    <div className="office-health-content">
      <p className="office-health-scope-note">Updates every minute while this page is visible. Configuration checks do not verify external sign-in, email or message delivery.</p>
      {state.error && <p className="feedback error" role="alert">{state.error}{data && ' Previous results are shown below.'}</p>}
      {!data && state.loading && <p role="status">Loading server health...</p>}
      {data && <>
        <div className="office-health-summary" aria-label="Health summary">{counts.map(({ status, count }) => <div key={status} className={`office-health-total is-${status}`}><strong>{count}</strong><span>{states[status].label}</span></div>)}</div>
        {!filtered.length && <p role="status" className="office-health-empty">No components match your search or filters.</p>}
        <div className="office-health-groups">{groups.map(group => {
          const checks = filtered.filter(check => check.group === group);
          const issues = checks.filter(check => ['unhealthy', 'warning', 'unknown'].includes(check.status)).length;
          const open = expanded[group] ?? true;
          return <div className="office-health-group" key={group}>
            <button type="button" className="office-health-group-toggle" aria-expanded={open} onClick={() => setExpanded(current => ({ ...current, [group]: !open }))}><ChevronDown size={15} className={open ? '' : 'is-closed'}/><strong>{group}</strong><span>{checks.length} checks</span><span className={`office-health-group-result ${issues ? 'has-issues' : ''}`}>{issues ? `${issues} need attention` : 'No issues'}</span></button>
            <div hidden={!open} className="office-health-checks"><ul className="office-health-rows" aria-label={group}>{checks.map(check => {
              const { icon: Icon, label } = states[check.status];
              return <li className={`office-health-check is-${check.status}`} key={check.id}><Icon size={15} aria-hidden="true"/><strong>{check.label}</strong><span className={`office-health-badge is-${check.status}`}>{label}</span><small>{scopes[check.scope] || 'Server check'}{check.required ? ' · Required' : ''}</small><div><p>{check.message}</p>{check.last_seen_at && <small>Last heartbeat: {officeDateTime(check.last_seen_at)}</small>}</div></li>;
            })}</ul></div>
          </div>;
        })}</div>
      </>}
    </div>
  </section>;
}
