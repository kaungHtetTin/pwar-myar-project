import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Plus, ChevronRight, Bot } from 'lucide-react';
import { apiRequest } from '../api/client';
import { Button, IconButton, Input, Select } from '../components/Controls';
import { PageAppBar } from '../navigation/PageAppBar';
import { usePageRefresh } from '../navigation/pageRefresh';
import { useEndlessList } from '../hooks/useEndlessList';
import { fieldErrors } from './shopUtils';

const root = '/shop-admin/sales-ai/telegram', page = '/shop/sales-ai/telegram';
const draft = row => Object.fromEntries(['version', 'enabled', 'groups_enabled', 'daily_limit', 'per_user_limit'].map(key => [key, row[key]]));
const newGroup = { version: 0, title: '', chat_id: '', status: 'pending', reply_mentions: true, reply_to_bot: true, daily_limit: 100, per_user_limit: 20 };

function Header({ title, onBack, children }) {
  return <PageAppBar><IconButton aria-label="Back" variant="ghost" onClick={onBack}><ArrowLeft size={21} /></IconButton><h1>{title}</h1>{children}</PageAppBar>;
}

function GroupForm({ id, onBack, onSaved }) {
  const [form, setForm] = useState(id === 'new' ? { ...newGroup } : null), [error, setError] = useState(''), [errors, setErrors] = useState({}), [busy, setBusy] = useState(false);
  const working = useRef(false);
  const load = useCallback(async () => {
    if (id === 'new') return;
    try { const data = await apiRequest(`${root}/groups/${id}`); setForm(current => current || data.group); setError(''); } catch (failure) { setError(failure.message); }
  }, [id]);
  useEffect(() => { void load(); }, [load]); usePageRefresh(load);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function save(event) {
    event.preventDefault(); if (working.current) return;
    working.current = true; setBusy(true); setError(''); setErrors({});
    try { const result = await apiRequest(`${root}/groups${id === 'new' ? '' : `/${id}`}`, { method: id === 'new' ? 'POST' : 'PUT', body: JSON.stringify(form) }); onSaved(result.group); onBack(); }
    catch (failure) { setError(failure.message); setErrors(fieldErrors(failure)); }
    finally { working.current = false; setBusy(false); }
  }
  return <><Header title={id === 'new' ? 'Add group' : 'Manage group'} onBack={onBack} /><div className="shop-mobile-content">
    {error && <p role="alert">{error}<Button onClick={load}>Retry</Button></p>}
    {!form ? !error && <p role="status">Loading group…</p> : <form className="shop-mobile-card sales-telegram-form" onSubmit={save}><fieldset disabled={busy}>
      {Object.entries({ title: 'Group name', chat_id: 'Telegram group ID', daily_limit: 'Group daily limit', per_user_limit: 'Group daily limit per user' }).map(([key, label]) => <label key={key}>{label}<Input aria-label={label} aria-describedby={errors[key] ? `tg-group-${key}-error` : undefined} required type={key.includes('limit') ? 'number' : 'text'} readOnly={key === 'chat_id' && id !== 'new'} value={form[key]} onChange={event => change(key, key.includes('limit') ? Number(event.target.value) : event.target.value)} />{errors[key] && <small role="alert" id={`tg-group-${key}-error`}>{errors[key]}</small>}</label>)}
      <label>Status<Select aria-label="Status" value={form.status} onChange={event => change('status', event.target.value)}>{['pending', 'approved', 'disabled'].map(value => <option key={value} value={value}>{value}</option>)}</Select></label>
      <label className="sales-ai-mobile-choice"><Input type="checkbox" checked={Boolean(form.reply_mentions)} onChange={event => change('reply_mentions', event.target.checked)} />Reply when mentioned</label>
      <label className="sales-ai-mobile-choice"><Input type="checkbox" checked={Boolean(form.reply_to_bot)} onChange={event => change('reply_to_bot', event.target.checked)} />Reply to bot replies</label>
      <p>The bot must be a member of an approved group before it can reply.</p>
      <div className="sales-telegram-actions"><Button onClick={onBack}>Cancel</Button><Button type="submit" variant="primary" busy={busy}>Save group</Button></div>
    </fieldset></form>}
  </div></>;
}

export function SalesTelegramPage({ pathname, onNavigate }) {
  const [settings, setSettings] = useState(null), [form, setForm] = useState(null), [token, setToken] = useState(''), [replace, setReplace] = useState(false);
  const [connection, setConnection] = useState(null), [error, setError] = useState(''), [errors, setErrors] = useState({}), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [query, setQuery] = useState('');
  const working = useRef(false);
  const groupId = pathname.match(/\/groups\/(new|\d+)$/)?.[1];
  const load = useCallback(async () => {
    try { const data = await apiRequest(root); setSettings(data.settings); setForm(current => current || draft(data.settings)); setError(''); }
    catch (failure) { setError(failure.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const changed = ({ detail }) => {
      if (!detail.settings) return;
      setSettings(previous => {
        if (!previous || detail.settings.version <= previous.version) return previous;
        setForm(current => ({ ...draft(detail.settings), ...Object.fromEntries(Object.entries(current || {}).filter(([key, value]) => key !== 'version' && value !== previous[key])) }));
        return detail.settings;
      });
      setNotice('Telegram settings updated in the assistant. Review any unsaved edits before saving.');
    };
    window.addEventListener('mkpos:sales-ai-telegram-updated', changed);
    return () => window.removeEventListener('mkpos:sales-ai-telegram-updated', changed);
  }, []);
  const loadPage = useCallback(({ limit, offset, signal }) => apiRequest(`${root}/groups?${new URLSearchParams({ limit, offset, q: query })}`, { signal }), [query]);
  const list = useEndlessList({ loadPage, queryKey: query });
  const reloadGroups = list.reload;
  useEffect(() => {
    if (groupId) return undefined;
    const changed = () => { setNotice('Telegram group saved.'); void reloadGroups(); };
    window.addEventListener('mkpos:sales-telegram-groups-updated', changed);
    const assistantChanged = ({ detail }) => { if (detail.group) changed(); };
    window.addEventListener('mkpos:sales-ai-telegram-updated', assistantChanged);
    return () => { window.removeEventListener('mkpos:sales-telegram-groups-updated', changed); window.removeEventListener('mkpos:sales-ai-telegram-updated', assistantChanged); };
  }, [groupId, reloadGroups]);
  usePageRefresh(() => groupId ? undefined : Promise.all([load(), list.reload()]));
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const accept = data => { setSettings(data.settings); setForm(draft(data.settings)); setToken(''); };
  async function run(operation) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(''); setErrors({}); setNotice('');
    try { await operation(); } catch (failure) { setError(failure.message); setErrors(fieldErrors(failure)); }
    finally { working.current = false; setBusy(false); }
  }
  const dirty = settings && form && (token !== '' || JSON.stringify(form) !== JSON.stringify(draft(settings)));
  const back = () => onNavigate(page, { back: true });
  return <>
    {!groupId && <Header title="Telegram bot" onBack={() => onNavigate('/shop/sales-ai', { back: true })}><IconButton aria-label="Refresh Telegram settings" disabled={busy} onClick={() => { void load(); void list.reload(); }}><RefreshCw size={19} /></IconButton></Header>}
    <div hidden={Boolean(groupId)} className="shop-mobile-content sales-telegram-page">
      {error && <p role="alert">{error}<Button onClick={load}>Retry</Button></p>}{notice && <p role="status">{notice}</p>}
      {!form ? !error && <p role="status">Loading Telegram settings…</p> : <>
        <form className="shop-mobile-card sales-telegram-form" onSubmit={event => { event.preventDefault(); void run(async () => { accept(await apiRequest(root, { method: 'PUT', body: JSON.stringify({ ...form, ...(token.trim() ? { bot_token: token.trim() } : {}) }) })); setNotice('Telegram settings saved.'); void list.reload(); }); }}>
          <h2>Shop Telegram bot</h2><p>Connect your shop bot to Sales AI. Replies use your Sales AI credit.</p>
          <fieldset disabled={busy}>
            <label>Bot token<Input type="password" aria-label="Bot token" autoComplete="new-password" maxLength={256} value={token} onChange={event => setToken(event.target.value)} placeholder={settings.token_configured ? 'Leave blank to keep the saved token' : 'Paste the token from BotFather'} aria-describedby={errors.bot_token ? 'tg-token-error' : undefined} />{errors.bot_token && <small role="alert" id="tg-token-error">{errors.bot_token}</small>}</label>
            <label>Webhook URL<Input aria-label="Webhook URL" readOnly value={settings.webhook_url} /></label>
            <label className="sales-ai-mobile-choice"><Input type="checkbox" checked={Boolean(form.enabled)} onChange={event => change('enabled', event.target.checked)} />Enable Telegram replies</label>
            <label className="sales-ai-mobile-choice"><Input type="checkbox" checked={Boolean(form.groups_enabled)} onChange={event => change('groups_enabled', event.target.checked)} />Enable replies in approved groups</label>
            {['daily_limit', 'per_user_limit'].map(key => <label key={key}>{key === 'daily_limit' ? 'Daily Telegram AI requests' : 'Daily AI requests per Telegram user'}<Input aria-label={key === 'daily_limit' ? 'Daily Telegram AI requests' : 'Daily AI requests per Telegram user'} type="number" required min={1} max={key === 'daily_limit' ? 10000 : 500} value={form[key]} onChange={event => change(key, Number(event.target.value))} aria-describedby={errors[key] ? `tg-${key}-error` : undefined} />{errors[key] && <small role="alert" id={`tg-${key}-error`}>{errors[key]}</small>}</label>)}
            <p>Use a dedicated bot for this shop. The saved token stays hidden. Save settings before testing or registering.</p>
            <Button variant="primary" type="submit" busy={busy}>Save Telegram settings</Button>
          </fieldset>
        </form>
        <section className="shop-mobile-card sales-telegram-form"><h2>Connection and webhook</h2><p><span data-no-localize>{settings.bot_username ? `@${settings.bot_username}` : ''}</span> · {settings.registered_at ? 'Webhook registered' : 'Webhook not registered'}</p>
          <label className="sales-ai-mobile-choice"><Input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />Replace an existing webhook for this bot</label>
          <div className="sales-telegram-actions"><Button disabled={busy || dirty || !settings.token_configured} onClick={() => void run(async () => { const result = await apiRequest(`${root}/test`, { method: 'POST', body: '{}' }); setConnection(result.connection); setNotice('Telegram connection verified.'); })}>Test connection</Button><Button disabled={busy || dirty || !settings.token_configured} onClick={() => void run(async () => { accept(await apiRequest(`${root}/register`, { method: 'POST', body: JSON.stringify({ version: settings.version, replace_existing: replace }) })); setNotice('Telegram webhook registered.'); })}>Register webhook</Button></div>
          {connection && <p><span data-no-localize>@{connection.bot_username}</span> · {connection.can_join_groups ? 'Bot can join groups' : 'Enable groups in BotFather'}</p>}
          <p>In groups, reply to the bot or use /help@your_bot. Enable group joining in BotFather. For ordinary mentions, make the bot an administrator or disable privacy mode and re-add it. This app still answers only approved mentions and replies.</p>
          <p>Guest checkout is available in private chat. Account linking is optional for account orders. Group chats never show private orders.</p>
        </section>
      </>}
      <section className="shop-mobile-card sales-telegram-form"><div className="sales-telegram-actions"><h2>Telegram groups</h2><Button disabled={!settings?.token_configured} onClick={() => onNavigate(`${page}/groups/new`)}><Plus size={17} />Add group</Button></div>
        <label>Search groups<Input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search groups" /></label>
        <p>Add your bot to a group to discover it here, then approve that group. Each group has its own limits.</p>
        {list.items.map(group => <Button key={group.id} variant="plain" className="sales-ai-settings-row" onClick={() => onNavigate(`${page}/groups/${group.id}`)}><Bot size={18} aria-hidden="true" /><span className="sales-ai-row-copy"><strong data-no-localize>{group.title}</strong><small>{group.chat_id} · <span>{group.status}</span></small><small>{group.is_member ? 'Member' : 'Bot is not a member'} · {group.daily_limit} / {group.per_user_limit}</small></span><ChevronRight size={19} /></Button>)}
        {list.initialLoading && <p role="status">Loading groups…</p>}{list.error && <p role="alert">{list.error}<Button onClick={list.retry}>Retry</Button></p>}{!list.initialLoading && !list.items.length && !list.error && <p>No Telegram groups yet.</p>}
        {list.hasMore && !list.initialLoading && <Button disabled={list.loadingMore} onClick={list.loadMore}>Load more</Button>}<div ref={list.sentinelRef} />
      </section>
    </div>
    {groupId && <GroupForm key={groupId} id={groupId} onBack={back} onSaved={() => window.dispatchEvent(new CustomEvent('mkpos:sales-telegram-groups-updated'))} />}
  </>;
}
