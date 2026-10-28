import { useEffect, useRef, useState } from 'react';
import { PlugZap, Save, Send } from 'lucide-react';
import { api, officeApiBase } from './api';
import './telegram-support-settings.css';
import TelegramSupportGroups from './TelegramSupportGroups';

const endpoint = '/office/telegram-support';
function draft(settings) {
  return { enabled: settings.enabled, groups_enabled: !!settings.groups_enabled, images_enabled: !!settings.images_enabled,
    receipt_notices_enabled: !!settings.receipt_notices_enabled, admin_group_chat_id: settings.admin_group_chat_id ? String(settings.admin_group_chat_id) : '',
    admin_group_thread_id: String(settings.admin_group_thread_id || 0), webhook_url: settings.webhook_url || '', daily_limit: String(settings.daily_limit), per_chat_daily_limit: String(settings.per_chat_daily_limit) };
}

export default function TelegramSupportSettingsPage({ active = true, refreshToken = 0 }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(null);
  const [token, setToken] = useState('');
  const [connection, setConnection] = useState(null);
  const [replace, setReplace] = useState(false);
  const [task, setTask] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  const loaded = useRef('');
  const sequence = useRef(0);
  const latest = useRef(null);
  useEffect(() => { latest.current = { settings, form, token }; }, [settings, form, token]);
  const dirty = !!settings && (token.trim() !== '' || JSON.stringify(form) !== JSON.stringify(draft(settings)));

  useEffect(() => {
    if (!active) return;
    const key = `${refreshToken}:${revision}`;
    if (loaded.current === key) return;
    let live = true;
    const request = ++sequence.current;
    api(endpoint).then(result => {
      if (!live || request !== sequence.current) return;
      loaded.current = key;
      const previous = latest.current;
      setSettings(result.settings);
      if (!previous.form || (!previous.token && JSON.stringify(previous.form) === JSON.stringify(draft(previous.settings)))) setForm(draft(result.settings));
      setError('');
    }).catch(e => { if (live && request === sequence.current) setError(e.message); });
    return () => { live = false; };
  }, [active, refreshToken, revision]);

  function field(key, value) {
    setForm(current => ({ ...current, [key]: value, ...(key === 'images_enabled' && !value ? { receipt_notices_enabled: false } : {}) }));
    setNotice('');
  }

  async function run(action) {
    if (busy.current) return;
    busy.current = true;
    ++sequence.current;
    setTask(action); setError(''); setNotice('');
    try {
      let path = endpoint;
      let method = 'PUT';
      let body;
      if (action === 'save') {
        body = { ...form, version: settings.version, admin_group_chat_id: form.admin_group_chat_id || null, admin_group_thread_id: Number(form.admin_group_thread_id), daily_limit: Number(form.daily_limit), per_chat_daily_limit: Number(form.per_chat_daily_limit), ...(token.trim() ? { bot_token: token.trim() } : {}) };
      } else if (action === 'test') {
        path += '/test-connection'; method = 'POST';
        body = token.trim() ? { bot_token: token.trim() } : {};
      } else {
        path += '/register-webhook'; method = 'POST';
        body = { version: settings.version, replace_existing: replace };
      }
      const result = await api(path, { method, body: JSON.stringify(body) });
      if (result.settings) {
        setSettings(result.settings); setForm(draft(result.settings)); setToken('');
      }
      if (action === 'save') { setConnection(null); setReplace(false); }
      if (result.connection) setConnection(result.connection);
      if (action === 'register') setReplace(false);
      setNotice(result.message);
    } catch (e) { setError(e.message); }
    finally { busy.current = false; setTask(''); }
  }

  return <div className="office-page-stack office-telegram-settings">
    {error && <div className="feedback error" role="alert">{error}<button type="button" disabled={!!task} onClick={() => setRevision(value => value + 1)}>Reload saved settings</button></div>}
    {notice && <p className="office-success" role="status">{notice}</p>}
    {!settings && !error && <p role="status">Loading Telegram settings...</p>}
    {settings && form && <section className="office-panel office-branding-panel">
      <h2>Telegram customer service</h2>
      <p>Connect your dedicated PwarMyar support bot. It answers public product questions using the shared AI model and platform AI balance.</p>
      <div className="office-telegram-status" role="status"><span>Bot token: <strong>{settings.token_configured ? 'Configured' : 'Not configured'}</strong></span><span>Service: <strong>{settings.enabled ? 'Enabled' : 'Disabled'}</strong></span>{settings.bot_username && <span>Bot: <strong>@{settings.bot_username}</strong></span>}</div>
      {!settings.storage_ready && <p className="feedback error" role="alert">Telegram settings storage is not ready. Run the latest server migrations.</p>}
      <form className="office-management-form" onSubmit={event => { event.preventDefault(); void run('save'); }}>
        <fieldset disabled={!!task || !settings.storage_ready}>
          <label className="office-telegram-wide">Bot token<input type="password" autoComplete="new-password" spellCheck={false} maxLength={256} pattern="[1-9][0-9]{0,15}:[A-Za-z0-9_\-]{20,}" value={token} onChange={event => { setToken(event.target.value); setConnection(null); setReplace(false); }} placeholder={settings.token_configured ? 'Leave blank to keep the saved token' : 'Paste the token from BotFather'} /><small>The saved token stays hidden. A replacement token is saved only when you click Save settings.</small></label>
          <label>Status<select aria-label="Telegram service status" value={String(form.enabled)} onChange={event => field('enabled', event.target.value === 'true')}><option value="false">Disabled</option><option value="true">Enabled</option></select></label>
          <label>Group replies<select aria-label="Group replies" value={String(form.groups_enabled)} onChange={event => field('groups_enabled', event.target.value === 'true')}><option value="false">Disabled</option><option value="true">Enabled for approved groups</option></select><small>New groups require approval. Private chats remain separate.</small></label>
          <label className="office-telegram-wide">Webhook URL<input type="url" required={form.enabled} maxLength={2048} value={form.webhook_url} onChange={event => field('webhook_url', event.target.value)} placeholder="https://your-domain.com/integrations/telegram/customer-service"/><small>Use the public HTTPS server URL ending in /integrations/telegram/customer-service. Localhost cannot receive Telegram updates.</small></label>
          <label>Daily AI requests, all chats<input required type="number" min={1} max={10000} value={form.daily_limit} onChange={event => field('daily_limit', event.target.value)}/></label>
          <label>Daily AI requests per chat<input aria-label="Daily AI requests per chat" required type="number" min={1} max={500} value={form.per_chat_daily_limit} onChange={event => field('per_chat_daily_limit', event.target.value)}/><small>Private chats only. Each group has its own limits below.</small></label>
          <div className="office-telegram-wide office-telegram-subheading"><h3>Images & payment receipt review</h3><p>Read visible image details. Payment approval stays with an administrator.</p></div>
          <label>Image reading<select aria-label="Image reading" value={String(form.images_enabled)} onChange={event => field('images_enabled', event.target.value === 'true')}><option value="false">Disabled</option><option value="true">Enabled</option></select><small>JPEG, PNG and WebP up to 5 MB. Uses the shared AI allowance.</small></label>
          <label>Admin receipt notices<select aria-label="Admin receipt notices" disabled={!form.images_enabled} value={String(form.receipt_notices_enabled)} onChange={event => field('receipt_notices_enabled', event.target.value === 'true')}><option value="false">Disabled</option><option value="true">Send receipt image and details</option></select><small>Enable image reading first. Only matching PwarMyar receipts and unresolved error screenshots go to the selected admin group.</small></label>
          <label>Admin group chat ID<input aria-label="Admin group chat ID" inputMode="numeric" pattern="-[0-9]+" required={form.receipt_notices_enabled} value={form.admin_group_chat_id} onChange={event => field('admin_group_chat_id', event.target.value)} placeholder="-1001234567890"/><small>Add the bot to your private admin group first. Copy its ID from Telegram groups below. Selecting it authorizes receipt sharing with that group.</small></label>
          <label>Admin group topic ID<input aria-label="Admin group topic ID" type="number" min={0} max={2147483647} required value={form.admin_group_thread_id} onChange={event => field('admin_group_thread_id', event.target.value)}/><small>Use 0 for the default chat, or a forum topic ID.</small></label>
          <div className="office-management-actions"><button className="office-button-primary" type="submit"><Save size={15}/>{task === 'save' ? 'Saving...' : 'Save settings'}</button></div>
        </fieldset>
      </form>
      <section className="office-telegram-connection" aria-label="Connection & webhook">
        <div className="office-telegram-connection-heading">
          <span className="office-telegram-connection-icon"><PlugZap size={18} aria-hidden="true"/></span>
          <div><h3>Connection & webhook</h3>
          <p>Test checks the bot token without saving or sending a chat message. Register connects Telegram to the saved webhook URL.</p></div>
        </div>
        {connection && <dl><div><dt>Bot</dt><dd>@{connection.bot_username || connection.bot_id}</dd></div><div><dt>Webhook</dt><dd>{({ registered: 'Registered', different: 'Another integration is connected', not_registered: 'Not registered' })[connection.webhook_status]}</dd></div><div><dt>Pending updates</dt><dd>{connection.pending_updates}</dd></div></dl>}
        {connection && (connection.group_privacy_enabled != null || connection.username_matches_saved === false || connection.message_updates_enabled === false || connection.last_delivery_error_at) && <div className="office-telegram-delivery-check">
          {connection.group_privacy_enabled != null && <p>Group Privacy: <strong>{connection.group_privacy_enabled ? 'Enabled — use addressed commands or replies; plain mentions may not arrive.' : 'Disabled — ordinary group mentions can be delivered.'}</strong></p>}
          {connection.username_matches_saved === false && <p>Bot username is missing or different in saved settings. Click Register webhook to refresh it.</p>}
          {connection.message_updates_enabled === false && <p>Telegram message updates are disabled for this webhook. Click Register webhook.</p>}
          {connection.last_delivery_error_at && <p>Telegram last reported a webhook delivery error at {connection.last_delivery_error_at}. This may be historical; send a new /help command to test delivery.</p>}
        </div>}
        <label className="office-telegram-replace"><input type="checkbox" checked={replace} disabled={!!task || dirty} onChange={event => setReplace(event.target.checked)}/>Replace an existing webhook for this bot</label>
        <div className="office-telegram-buttons"><button type="button" disabled={!!task || (!token.trim() && !settings.token_configured)} onClick={() => void run('test')}><PlugZap size={15}/>{task === 'test' ? 'Testing...' : 'Test connection'}</button><button type="button" disabled={!!task || dirty || !settings.enabled || !settings.token_configured || !settings.storage_ready} onClick={() => void run('register')}><Send size={15}/>{task === 'register' ? 'Registering...' : 'Register webhook'}</button><a href={`${officeApiBase}/health/workers`} target="_blank" rel="noreferrer">Worker health</a></div>
        {dirty && <small>Save your changes before registering the webhook.</small>}
        {settings.last_registered_at && <small>Last registered: {settings.last_registered_at} UTC</small>}
        <small>Keep the customer-service worker and scheduler running. Disabling pauses replies; it does not remove the Telegram webhook.</small>
      </section>
    </section>}
    {settings && (settings.token_configured
      ? <TelegramSupportGroups active={active} refreshToken={refreshToken} botIdentity={settings.bot_username || settings.version} />
      : <section className="office-panel office-table-panel office-telegram-groups" aria-label="Telegram groups"><header className="office-panel-header"><div><h2>Telegram groups</h2><p>Save your bot token above to load and manage groups. After saving, enable Group replies and approve each group here.</p></div></header></section>)}
  </div>;
}
