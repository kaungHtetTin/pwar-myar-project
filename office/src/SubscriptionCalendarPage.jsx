import React, { useEffect, useId, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { api } from './api';
import { officeDay, officeDateTime } from './dateTime';
import { OfficePageToolbar } from './OfficePageToolbar';
import { FilterDrawer } from './FilterDrawer';
import { OfficeModal } from './OfficeModal';
import { useRetainedActivity } from './retainedActivity';
import { calendarDays, calendarLabel, expiryUrgency, shiftMonth } from './subscriptionCalendar';
import './subscription-calendar.css';

function CalendarFilter({ kind, onApply, onClear }) {
  const [draft, setDraft] = useState(kind);
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}>
    <div className="office-drawer-filter-fields"><label>Plan type<select value={draft} onChange={event => setDraft(event.target.value)}><option value="all">Trial and paid plans</option><option value="trial">Trial only</option><option value="paid">Paid only</option></select></label></div>
    <div className="office-drawer-filter-actions"><button type="button" onClick={onClear}>Clear</button><button type="submit" className="office-button-primary">Apply filters</button></div>
  </form>;
}

function DayPanel({ day, query, kind, onClose, onOpenBusiness }) {
  const [data, setData] = useState({ items: [], total: 0, has_more: false });
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true); setError('');
      return api(`/office/subscription-calendar/day?${new URLSearchParams({ day, q: query, kind, offset, limit: 25 })}`);
    }).then(result => {
      if (cancelled || !result) return;
      setData(current => ({ ...result, items: offset === 0 ? result.items : [...new Map([...current.items, ...result.items].map(item => [item.id, item])).values()] }));
    }).catch(reason => { if (!cancelled) setError(reason.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [day, query, kind, offset, retry]);
  return <OfficeModal title={`Expirations · ${calendarLabel(day)}`} description="Businesses whose current trial or paid plan ends on this date." closeLabel="Close expirations" onClose={onClose} className="office-calendar-day-modal"
    footer={<><span>{data.items.length} of {data.total} businesses</span>{data.has_more && !error && <button type="button" className="office-button" disabled={loading} onClick={() => setOffset(data.offset + data.limit)}>Load more</button>}<button type="button" className="office-button" onClick={onClose}>Close</button></>}>
    {loading && <p role="status">Loading businesses…</p>}
    {error && <div className="office-calendar-error" role="alert">{error}<button className="office-button" type="button" onClick={() => setRetry(value => value + 1)}>Retry businesses</button></div>}
    {!loading && !error && !data.items.length && <p className="office-calendar-empty">No plans end on this date.</p>}
    <ul className="office-calendar-businesses">{data.items.map(business => <li key={business.id}><div><strong>{business.name}</strong><span>{business.owner_name || 'No owner name'}{business.owner_email && ` · ${business.owner_email}`}</span><small>{business.plan_name} · {business.access_type === 'trial' ? 'Trial' : 'Paid'} · {business.access_state}</small><small>Expires {officeDateTime(business.ends_at)}</small></div><button className="office-button" type="button" onClick={() => onOpenBusiness(business.id)}><Building2 size={15} aria-hidden="true" />View business</button></li>)}</ul>
  </OfficeModal>;
}

export default function SubscriptionCalendarPage({ refreshToken = 0, onOpenBusiness }) {
  const [month, setMonth] = useState(() => officeDay(new Date().toISOString()).slice(0, 7));
  const [kind, setKind] = useState('all'), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false), [selectedDay, setSelectedDay] = useState(null), [focusDay, setFocusDay] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const active = useRetainedActivity(), id = useId();
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('mkpos:office-subscription-changed', refresh);
    return () => window.removeEventListener('mkpos:office-subscription-changed', refresh);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true); setError('');
      return api(`/office/subscription-calendar?${new URLSearchParams({ month, kind, q: query })}`);
    }).then(result => { if (!cancelled && result) setData({ ...result, requestKey: `${month}|${kind}|${query}` }); })
      .catch(reason => { if (!cancelled) setError(reason.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, kind, query, refreshToken, revision]);
  useEffect(() => { if (!active) queueMicrotask(() => setFilterOpen(false)); }, [active]);
  function changeMonth(value) { if (/^(19|20)\d{2}-(0[1-9]|1[0-2])$|^2100-(0[1-9]|1[0-2])$/.test(value)) { setMonth(value); setSelectedDay(null); } }
  function applySearch() { setQuery(search.trim()); setSelectedDay(null); }
  function clearSearch() { setSearch(''); setQuery(''); setSelectedDay(null); }
  function applyKind(value) { setKind(value); setSelectedDay(null); setFilterOpen(false); }
  const today = data?.today || officeDay(new Date().toISOString());
  const days = calendarDays(month), matching = data?.requestKey === `${month}|${kind}|${query}`;
  const counts = new Map((matching ? data.days : []).map(day => [day.day, day]));
  const currentFocus = focusDay.startsWith(month) ? focusDay : today.startsWith(month) ? today : `${month}-01`;
  const title = calendarLabel(`${month}-01`, { month: 'long', year: 'numeric' });
  function moveFocus(event, day) {
    const amount = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!amount) return;
    event.preventDefault();
    const next = new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
    document.getElementById(`${id}-${next}`)?.focus();
  }
  return <div className="office-subscription-calendar">
    <OfficePageToolbar searchLabel="Search calendar businesses" placeholder="Business or owner" search={search} onSearchChange={setSearch} onSearch={applySearch} onClearSearch={clearSearch} onFilterOpen={() => setFilterOpen(true)} filterOpen={filterOpen} filterCount={kind === 'all' ? 0 : 1} />
    <div className="office-calendar-summary" aria-label="Current business subscription totals">{[['trial', 'Active trials'], ['paid', 'Active paid businesses'], ['expired', 'Expired businesses']].map(([key, label]) => <article key={key} className={`is-${key}`}><small>{label}</small><strong>{data?.summary[key] ?? '—'}</strong></article>)}</div>
    <p className="office-calendar-note">Current totals match your search. Calendar dates show the end of each business’s current plan.</p>
    <section className="office-panel office-calendar-panel" aria-label="Subscription expiry calendar" aria-busy={loading}>
      <div className="office-calendar-heading"><h2><CalendarDays size={19} aria-hidden="true" />{title}</h2><div className="office-calendar-controls"><button className="office-button" type="button" aria-label="Previous month" disabled={month === '1900-01'} onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button><button className="office-button" type="button" onClick={() => { changeMonth(today.slice(0, 7)); setFocusDay(today); }}>Today</button><button className="office-button" type="button" aria-label="Next month" disabled={month === '2100-12'} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button><label>Month<input aria-label="Calendar month" type="month" min="1900-01" max="2100-12" value={month} onChange={event => changeMonth(event.target.value)} /></label></div></div>
      <div className="office-calendar-legend"><span className="is-trial">Trial ending</span><span className="is-paid">Paid plan expiring</span><span className="is-warning">Within 7 days</span><span className="is-danger">Within 3 days / past expiry</span><small>{data?.timezone || 'Asia/Yangon'}</small></div>
      {loading && <p className="office-calendar-status" role="status">Loading calendar…</p>}
      {error && <div className="office-calendar-error" role="alert"><span>{error}{data && ' Last loaded totals are shown.'}</span><button className="office-button" type="button" onClick={() => setRevision(value => value + 1)}>Retry calendar</button></div>}
      {!loading && !error && matching && !data.days.some(day => day.total > 0) && <p className="office-calendar-status" role="status">No trial or paid plans expire in this month.</p>}
      <div className="office-calendar-grid" role="grid" aria-label={`${title} expirations`}><div className="office-calendar-weekdays" role="row">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div role="columnheader" key={day}>{day}</div>)}</div>
        {Array.from({ length: 6 }, (_, week) => <div className="office-calendar-week" role="row" key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
          const count = counts.get(day.day) || { trial: 0, paid: 0, total: 0 };
          return <div role="gridcell" key={day.day} className={day.inMonth ? '' : 'is-outside'}>{day.inMonth ? <button id={`${id}-${day.day}`} data-day={day.day} className={`office-subscription-day ${expiryUrgency(day.day, today, count.total)}${selectedDay === day.day ? ' is-selected' : ''}`} type="button" tabIndex={currentFocus === day.day ? 0 : -1} aria-current={day.day === today ? 'date' : undefined} aria-label={`${calendarLabel(day.day)}: ${count.trial} trials ending, ${count.paid} paid plans expiring`} disabled={loading || !matching || Boolean(error)} onFocus={() => setFocusDay(day.day)} onKeyDown={event => moveFocus(event, day.day)} onClick={() => setSelectedDay(day.day)}>
            <span className="office-calendar-date">{day.number}</span>{count.total > 0 ? <span className="office-calendar-counts">{count.trial > 0 && <span className="is-trial"><span>Trial</span><b>{count.trial}</b></span>}{count.paid > 0 && <span className="is-paid"><span>Paid</span><b>{count.paid}</b></span>}<small>Total {count.total}</small></span> : <span className="office-calendar-none" aria-hidden="true">—</span>}
          </button> : <span className="office-calendar-outside-date" aria-hidden="true">{day.number}</span>}</div>;
        })}</div>)}
      </div>
    </section>
    <FilterDrawer open={filterOpen && active} title="Calendar filters" onClose={() => setFilterOpen(false)}><CalendarFilter key={String(filterOpen)} kind={kind} onApply={applyKind} onClear={() => applyKind('all')} /></FilterDrawer>
    {selectedDay && <DayPanel key={`${selectedDay}|${query}|${kind}|${refreshToken}|${revision}`} day={selectedDay} query={query} kind={kind} onClose={() => setSelectedDay(null)} onOpenBusiness={onOpenBusiness} />}
  </div>;
}
