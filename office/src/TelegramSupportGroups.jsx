import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { officeDateTime as time } from './dateTime';
import { OfficeActionCell, OfficeActionHeader, OfficeTablePagination } from './OfficeTable';
import { RowActions } from './RowActions';
import { OfficeModal } from './OfficeModal';
import { OfficePageToolbar, OfficeStatusFilterDrawer } from './OfficePageToolbar';

const endpoint = '/office/telegram-support/groups';
const statuses = [['', 'All groups'], ['pending', 'Pending approval'], ['approved', 'Approved'], ['disabled', 'Disabled']];
const diagnostics = { service_disabled: 'Bot service is disabled', group_replies_disabled: 'Group replies is disabled', bot_username_missing: 'Register webhook to save the bot username',
  not_approved: 'Group approval required', not_a_member: 'Bot is not a member', no_matching_trigger: 'Last message did not match a trigger', bot_or_anonymous_sender: 'Bot or anonymous sender ignored',
  storage_error: 'Message storage failed; check migrations/logs', ai_queued: 'Accepted for an AI reply', notice_queued: 'Accepted for a help or limit reply', duplicate_update: 'Duplicate update ignored',
  membership_update: 'Membership update received', received: 'Group message received', notice_rate_limited: 'Notice rate limit reached' };
const diagnostic = group => diagnostics[group.reply_blocker || group.last_update?.reason] || (!group.is_member ? diagnostics.not_a_member : '');

export default function TelegramSupportGroups({ active, refreshToken, botIdentity }) {
  const [data, setData] = useState(null), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [status, setStatus] = useState(''), [page, setPage] = useState(1), [perPage, setPerPage] = useState(25);
  const [filter, setFilter] = useState(false), [edit, setEdit] = useState(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0);
  const loaded = useRef(''), sequence = useRef(0), saving = useRef(false);
  useEffect(() => {
    if (active) return;
    const timer = setTimeout(() => setFilter(false), 0);
    return () => clearTimeout(timer);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const key = JSON.stringify([refreshToken, botIdentity, query, status, page, perPage, revision]);
    if (loaded.current === key) return;
    const request = ++sequence.current;
    let live = true;
    api(`${endpoint}?${new URLSearchParams({ search: query, status, page, per_page: perPage })}`).then(result => {
      if (!live || request !== sequence.current) return;
      loaded.current = key; setData(result); setError('');
    }).catch(e => { if (live && request === sequence.current) setError(e.message); });
    return () => { live = false; };
  }, [active, refreshToken, botIdentity, query, status, page, perPage, revision]);

  async function save(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const existing = !!edit.id;
      const body = existing ? { version: edit.version, status: edit.status, reply_mentions: !!edit.reply_mentions, reply_to_bot: !!edit.reply_to_bot,
        daily_limit: Number(edit.daily_limit), per_user_daily_limit: Number(edit.per_user_daily_limit) } : { chat_id: edit.chat_id, title: edit.title };
      const result = await api(existing ? `${endpoint}/${edit.id}` : endpoint, { method: existing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setEdit(null); setNotice(result.message); setRevision(value => value + 1);
    } catch (e) { setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }

  return <section className="office-panel office-table-panel office-telegram-groups" aria-label="Telegram groups">
    <OfficePageToolbar visible={active && !edit} searchLabel="Search Telegram groups" placeholder="Group name or ID" search={search}
      onSearchChange={setSearch} onSearch={() => { setQuery(search.trim()); setPage(1); }} onClearSearch={() => { setSearch(''); setQuery(''); setPage(1); }}
      actionLabel="Add group" onCreate={() => { setError(''); setEdit({ chat_id: '', title: '' }); }} busy={busy}
      onFilterOpen={() => setFilter(true)} filterOpen={filter} filterCount={status ? 1 : 0} />
    <header className="office-panel-header"><div><h2>Telegram groups</h2>
      <p>Add the bot to each group, then approve it here. Only mentions and replies to the bot can trigger answers. Re-register the webhook once to receive group membership updates.</p></div></header>
    {notice && <p role="status" className="office-success office-telegram-groups-message">{notice}</p>}
    {error && !edit && <p role="alert" className="feedback error office-telegram-groups-message">{error}<button type="button" onClick={() => setRevision(v => v + 1)}>Reload groups</button></p>}
    {!data && !error && <p role="status" className="office-telegram-groups-message">Loading groups...</p>}
    {data && <><div className="office-table-scroll"><table className="office-data-table office-telegram-groups-table" aria-label="Telegram groups"><thead><tr><th scope="col">Group</th><th scope="col">Status</th><th scope="col">Triggers</th><th scope="col">Today / daily limit</th><th scope="col">Activity</th><OfficeActionHeader /></tr></thead><tbody>
      {data.groups.map(group => <tr key={group.id}><td><strong data-no-localize>{group.title}</strong><small>{group.chat_id}</small></td>
        <td><span className={`office-status office-status-${group.status}`}>{statuses.find(([key]) => key === group.status)?.[1] || group.status}</span>{diagnostic(group) && <small>{diagnostic(group)}</small>}</td>
        <td>{[group.reply_mentions && 'Mention', group.reply_to_bot && 'Reply'].filter(Boolean).join(', ') || 'None'}</td>
        <td>{group.requests_today} / {group.daily_limit}<small>{group.per_user_daily_limit} per user</small></td>
        <td><small>Seen: {time(group.last_seen_at)}</small><small>Reply: {time(group.last_reply_at)}</small>{group.last_update && <small>Input check: {time(group.last_update.checked_at)}</small>}{group.last_error && <small>Error: {group.last_error}</small>}</td>
        <OfficeActionCell><RowActions label={group.title} disabled={busy}><button type="button" onClick={() => { setError(''); setEdit({ ...group }); }}>Manage group</button></RowActions></OfficeActionCell>
      </tr>)}
      {!data.groups.length && <tr><td colSpan={6}>No groups found. Add the bot to a group or use Add group.</td></tr>}
    </tbody></table></div>
    <OfficeTablePagination label="Groups" {...{ total: data.total, page: data.page, perPage: data.per_page, lastPage: data.last_page }} disabled={busy}
      onPageChange={setPage} onPerPageChange={value => { setPerPage(value); setPage(1); }} /></>}
    <OfficeStatusFilterDrawer open={filter && active} title="Telegram group filters" status={status} options={statuses} busy={busy} onClose={() => setFilter(false)}
      onApply={value => { setStatus(value); setPage(1); setFilter(false); }} onClear={() => { setStatus(''); setPage(1); setFilter(false); }} />
    {edit && active && <OfficeModal title={edit.id ? `Manage ${edit.title}` : 'Add Telegram group'} onClose={() => { setEdit(null); setError(''); }} busy={busy}>
      {error && <p role="alert" className="feedback error">{error}</p>}
      {edit.id && <div className="office-telegram-delivery-check"><strong>Group delivery checks</strong><p>{diagnostic(edit) || 'Send /help@your_bot in this group, then refresh Office to inspect the last input.'}</p>{edit.last_update && <small>Last input check: {time(edit.last_update.checked_at)}</small>}{edit.last_error && <p>Last recorded reply error: {edit.last_error}</p>}</div>}
      <form className="office-management-form" onSubmit={save}><fieldset disabled={busy}>
        {!edit.id ? <><label>Group ID<input required inputMode="numeric" pattern="-[0-9]+" value={edit.chat_id} onChange={e => setEdit({ ...edit, chat_id: e.target.value })} placeholder="-1001234567890" /></label>
          <label>Group name<input required maxLength={255} value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} /></label><p>New entries start pending approval. The bot must also be added to the group in Telegram.</p></> : <>
          <p className="office-telegram-wide">Group ID: {edit.chat_id}. Saving cancels existing queued replies for this group.</p>
          <label>Status<select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>{statuses.slice(1).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Daily AI requests<input type="number" required min={1} max={10000} value={edit.daily_limit} onChange={e => setEdit({ ...edit, daily_limit: e.target.value })} /></label>
          <label>Daily AI requests per user<input type="number" required min={1} max={500} value={edit.per_user_daily_limit} onChange={e => setEdit({ ...edit, per_user_daily_limit: e.target.value })} /></label>
          <label className="office-telegram-check"><input type="checkbox" checked={!!edit.reply_mentions} onChange={e => setEdit({ ...edit, reply_mentions: e.target.checked })} />Reply when mentioned</label>
          <label className="office-telegram-check"><input type="checkbox" checked={!!edit.reply_to_bot} onChange={e => setEdit({ ...edit, reply_to_bot: e.target.checked })} />Reply to bot replies</label>
        </>}
        <div className="office-management-actions"><button type="button" onClick={() => { setEdit(null); setError(''); }}>Cancel</button><button type="submit" className="office-button-primary">{busy ? 'Saving...' : edit.id ? 'Save group' : 'Add group'}</button></div>
      </fieldset></form>
    </OfficeModal>}
  </section>;
}
