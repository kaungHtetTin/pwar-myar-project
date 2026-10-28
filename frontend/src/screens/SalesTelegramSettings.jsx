import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { request } from '../api';
import { Field, Modal } from '../components/common';

const root = '/shop-admin/sales-ai/telegram';
const defaults = { version: 0, chat_id: '', title: '', status: 'pending', reply_mentions: true, reply_to_bot: true, daily_limit: 100, per_user_limit: 20 };
const draft = row => Object.fromEntries(['version', 'enabled', 'groups_enabled', 'daily_limit', 'per_user_limit'].map(key => [key, row[key]]));

export function SalesTelegramSettings() {
  const [settings, setSettings] = useState(null), [form, setForm] = useState(null), [token, setToken] = useState('');
  const [groups, setGroups] = useState([]), [total, setTotal] = useState(0), [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState({}), [notice, setNotice] = useState('');
  const [connection, setConnection] = useState(null), [replace, setReplace] = useState(false), [loadingGroups, setLoadingGroups] = useState(false);
  const working = useRef(false), paging = useRef(false), mounted = useRef(false), generationRef = useRef(0);
  const totalRef = useRef(total), knownGroups = useRef(new Set()); totalRef.current = total;
  const groupFormId = useId();
  const openGroup = group => { setEditing({ ...group }); setError(''); setErrors({}); };
  const closeGroup = () => { if (!working.current) { setEditing(null); setError(''); setErrors({}); } };
  const accept = result => { setSettings(result.settings); setForm(draft(result.settings)); setToken(''); };
  const load = useCallback(async () => {
    setError('');
    try { const result = await request(root); setSettings(result.settings); setForm(current => current || draft(result.settings)); }
    catch (failure) { setError(failure.message); }
  }, []);
  const loadGroups = useCallback(async (offset = 0) => {
    if (offset && paging.current) return;
    const generation = offset ? generationRef.current : ++generationRef.current;
    paging.current = true; setLoadingGroups(true); 
    try { const result = await request(`${root}/groups?limit=20&offset=${offset}`); if (!mounted.current || generation !== generationRef.current) return; setGroups(current => offset ? [...current, ...result.items.filter(item => !current.some(old => old.id === item.id))] : result.items); setTotal(result.total); }
    catch (failure) { if (generation === generationRef.current) setError(failure.message); }
    finally { if (generation === generationRef.current) { paging.current = false; setLoadingGroups(false); } }
  }, []);
  useEffect(() => { mounted.current = true; void load(); void loadGroups(); return () => { mounted.current = false; }; }, [load, loadGroups]);
  useEffect(() => { groups.forEach(group => knownGroups.current.add(group.id)); }, [groups]);
  useEffect(() => {
    const changed = ({ detail }) => {
      if (detail.settings) {
        setSettings(previous => {
          if (!previous || detail.settings.version <= previous.version) return previous;
          setForm(current => ({ ...draft(detail.settings), ...Object.fromEntries(Object.entries(current || {}).filter(([key, value]) => key !== 'version' && value !== previous[key])) }));
          return detail.settings;
        });
      }
      if (detail.group) {
        const fresh = detail.created && !knownGroups.current.has(detail.group.id);
        knownGroups.current.add(detail.group.id);
        setGroups(current => current.some(group => group.id === detail.group.id)
          ? current.map(group => group.id === detail.group.id && detail.group.version > group.version ? detail.group : group)
          : fresh && current.length >= totalRef.current ? [...current, detail.group] : current);
        if (fresh) setTotal(current => current + 1);
      }
      setNotice('Telegram settings updated in the assistant. Review any unsaved edits before saving.');
    };
    window.addEventListener('mkpos:sales-ai-telegram-updated', changed);
    return () => window.removeEventListener('mkpos:sales-ai-telegram-updated', changed);
  }, []);
  async function run(operation) {
    if (working.current) return;
    working.current = true; setBusy(true); setError(''); setErrors({}); setNotice('');
    try { await operation(); } catch (failure) { setError(failure.message); setErrors(failure.payload?.errors || {}); }
    finally { working.current = false; setBusy(false); }
  }
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const fieldError = (key, group = false) => Boolean(editing) === group ? errors[key] : null;
  const validation = (key, group = false) => fieldError(key, group) && <small role="alert" id={`sales-telegram-${group ? 'group-' : ''}${key}-error`}>{fieldError(key, group)[0]}</small>;
  const inputProps = (key, group = false) => ({ 'aria-label': ({ bot_token: 'Bot token', title: 'Group name', chat_id: 'Telegram group ID', daily_limit: 'Daily Telegram AI requests', per_user_limit: 'Daily AI requests per Telegram user' })[key], 'aria-describedby': fieldError(key, group) ? `sales-telegram-${group ? 'group-' : ''}${key}-error` : undefined, 'aria-invalid': fieldError(key, group) ? true : undefined });
  const dirty = settings && form && (token !== '' || JSON.stringify(form) !== JSON.stringify(draft(settings)));
  return <section className="sales-ai-settings sales-telegram-settings" aria-label="Sales AI Telegram settings">
    <header className="sales-ai-heading"><div><h2>Telegram bot</h2><p>Connect your shop bot to Sales AI. Replies use your Sales AI credit.</p></div><button type="button" disabled={busy} onClick={() => { void load(); void loadGroups(); }}>Refresh</button></header>
    {error && !editing && <p role="alert">{error}{!settings && <button type="button" onClick={load}>Retry</button>}</p>}{notice && <p role="status">{notice}</p>}
    {!form ? !error && <p role="status">Loading Telegram settings…</p> : <>
      <form className="shop-settings" onSubmit={event => { event.preventDefault(); void run(async () => { accept(await request(root, { method: 'PUT', body: JSON.stringify({ ...form, ...(token.trim() ? { bot_token: token.trim() } : {}) }) })); setNotice('Telegram settings saved.'); void loadGroups(); }); }}>
        <fieldset className="sales-ai-fields" disabled={busy}>
          <Field label="Bot token"><input {...inputProps('bot_token')} type="password" autoComplete="new-password" maxLength={256} value={token} onChange={event => setToken(event.target.value)} placeholder={settings.token_configured ? 'Leave blank to keep the saved token' : 'Paste the token from BotFather'} />{validation('bot_token')}</Field>
          <Field label="Webhook URL"><input readOnly value={settings.webhook_url} /></Field>
          <label><input type="checkbox" checked={Boolean(form.enabled)} onChange={event => field('enabled', event.target.checked)} />Enable Telegram replies</label>
          <label><input type="checkbox" checked={Boolean(form.groups_enabled)} onChange={event => field('groups_enabled', event.target.checked)} />Enable replies in approved groups</label>
          {['daily_limit', 'per_user_limit'].map(key => <Field key={key} label={key === 'daily_limit' ? 'Daily Telegram AI requests' : 'Daily AI requests per Telegram user'}><input {...inputProps(key)} type="number" min={1} max={key === 'daily_limit' ? 10000 : 500} required value={form[key]} onChange={event => field(key, Number(event.target.value))} />{validation(key)}</Field>)}
          <p>Use a dedicated bot for this shop. The saved token stays hidden. Save settings before testing or registering.</p>
          <button type="submit" className="primary">{busy ? 'Saving…' : 'Save Telegram settings'}</button>
        </fieldset>
      </form>
      <section className="sales-ai-policies"><h3>Connection and webhook</h3>
        <p><span data-no-localize>{settings.bot_username ? `@${settings.bot_username}` : ''}</span> · {settings.registered_at ? 'Webhook registered' : 'Webhook not registered'}</p>
        <label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />Replace an existing webhook for this bot</label>
        <div className="form-actions"><button type="button" disabled={busy || dirty || !settings.token_configured} onClick={() => void run(async () => { const result = await request(`${root}/test`, { method: 'POST', body: '{}' }); setConnection(result.connection); setNotice('Telegram connection verified.'); })}>Test connection</button>
          <button type="button" disabled={busy || dirty || !settings.token_configured} onClick={() => void run(async () => { accept(await request(`${root}/register`, { method: 'POST', body: JSON.stringify({ version: settings.version, replace_existing: replace }) })); setNotice('Telegram webhook registered.'); })}>Register webhook</button></div>
        {connection && <p><span data-no-localize>@{connection.bot_username}</span> · {connection.can_join_groups ? 'Bot can join groups' : 'Enable groups in BotFather'} · {connection.pending_updates} pending updates</p>}
        <p>In groups, reply to the bot or use /help@your_bot. Enable group joining in BotFather. For ordinary mentions, make the bot an administrator or disable privacy mode and re-add it. This app still answers only approved mentions and replies.</p>
        <p>Guest checkout is available in private chat. Account linking is optional for account orders. Group chats never show private orders.</p>
      </section>
      <section className="sales-ai-policies"><header className="sales-ai-heading"><h3>Telegram groups</h3><button type="button" disabled={busy} onClick={() => openGroup(defaults)}>Add group</button></header>
        <p>Add your bot to a group to discover it here, then approve that group. Each group has its own limits.</p>
        <div className="table-wrap"><table className="shop-data-table" aria-label="Telegram groups"><thead><tr><th>Group</th><th>Status</th><th>Bot membership</th><th>Daily limit</th><th>Actions</th></tr></thead><tbody>{groups.map(group => <tr key={group.id}><td><strong data-no-localize>{group.title}</strong><small>{group.chat_id}</small></td><td>{group.status}</td><td>{group.is_member ? 'Member' : 'Bot is not a member'}</td><td>{group.daily_limit} / {group.per_user_limit}</td><td><button type="button" onClick={() => openGroup(group)}>Manage group</button></td></tr>)}</tbody></table></div>
        {!groups.length && !loadingGroups && <p>No Telegram groups yet.</p>}{loadingGroups && <p role="status">Loading groups…</p>}{groups.length < total && <button type="button" disabled={loadingGroups} onClick={() => void loadGroups(groups.length)}>Load more</button>}
      </section>
      {editing && <Modal open title={editing.id ? 'Manage group' : 'Add group'} size="medium" className="sales-telegram-settings sales-telegram-group-modal" busy={busy} onClose={closeGroup} footer={<><button type="button" disabled={busy} onClick={closeGroup}>Cancel</button><button type="submit" form={groupFormId} disabled={busy} className="primary">Save group</button></>}>
        {error && <p role="alert">{error}</p>}
        <form id={groupFormId} className="shop-settings" onSubmit={event => { event.preventDefault(); void run(async () => { const result = await request(`${root}/groups${editing.id ? `/${editing.id}` : ''}`, { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(editing) }); setGroups(current => current.some(group => group.id === result.group.id) ? current.map(group => group.id === result.group.id ? result.group : group) : [...current, result.group]); if (!editing.id) setTotal(current => current + 1); setEditing(null); setNotice('Telegram group saved.'); }); }}>
        <fieldset disabled={busy} className="sales-ai-fields">
          {['title', 'chat_id', 'daily_limit', 'per_user_limit'].map(key => <Field key={key} label={({ title: 'Group name', chat_id: 'Telegram group ID', daily_limit: 'Group daily limit', per_user_limit: 'Group daily limit per user' })[key]}><input {...inputProps(key, true)} aria-label={({ title: 'Group name', chat_id: 'Telegram group ID', daily_limit: 'Group daily limit', per_user_limit: 'Group daily limit per user' })[key]} required readOnly={key === 'chat_id' && Boolean(editing.id)} type={key.includes('limit') ? 'number' : 'text'} value={editing[key]} onChange={event => setEditing(current => ({ ...current, [key]: key.includes('limit') ? Number(event.target.value) : event.target.value }))} />{validation(key, true)}</Field>)}
          <Field label="Status"><select value={editing.status} onChange={event => setEditing(current => ({ ...current, status: event.target.value }))}>{['pending', 'approved', 'disabled'].map(status => <option key={status} value={status}>{status}</option>)}</select></Field>
          {['reply_mentions', 'reply_to_bot'].map(key => <label key={key}><input type="checkbox" checked={Boolean(editing[key])} onChange={event => setEditing(current => ({ ...current, [key]: event.target.checked }))} />{key === 'reply_mentions' ? 'Reply when mentioned' : 'Reply to bot replies'}</label>)}
        </fieldset>
        </form>
      </Modal>}
    </>}
  </section>;
}
