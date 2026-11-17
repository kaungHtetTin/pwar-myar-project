import React, { useEffect, useState } from 'react';
import { Check, RefreshCw, Save } from 'lucide-react';
import { api } from './api';

const emptyContacts = { phone_numbers: '', viber_numbers: '', telegram_url: '', email: '', community_label: '', community_url: '' };
const lines = value => value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);

export function ContactSettingsPage({ refreshToken = 0 }) {
  const [form, setForm] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [retry, setRetry] = useState(0);
  const loadKey = `${refreshToken}:${retry}`;
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let current = true;
    api('/office/contact-settings').then(data => {
      if (current) { setError(''); setForm({ ...emptyContacts, ...data, phone_numbers: (data.phone_numbers || []).join('\n'), viber_numbers: (data.viber_numbers || []).join('\n') }); }
    }).catch(error => { if (current) setError(error.message); })
      .finally(() => { if (current) setLoadedKey(loadKey); });
    return () => { current = false; };
  }, [loadKey]);

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setSuccess('');
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || !form) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await api('/office/contact-settings', {
        method: 'PUT',
        body: JSON.stringify({ ...form, phone_numbers: lines(form.phone_numbers), viber_numbers: lines(form.viber_numbers) }),
      });
      setForm({ ...data, phone_numbers: data.phone_numbers.join('\n'), viber_numbers: data.viber_numbers.join('\n') });
      setSuccess('Contact information saved. Public contact sections now use these details.');
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="office-release-loading" role="status"><RefreshCw size={16} className="office-spin" /> Loading contact information…</div>;
  if (!form) return <div className="feedback error" role="alert">{error} <button type="button" onClick={() => setRetry(value => value + 1)}>Retry</button></div>;

  return <form className="office-contact-settings-form" onSubmit={submit}>
    <section>
      <h2>Direct contact</h2>
      <p>These details appear in billing help and the website contact area.</p>
      <div className="office-contact-settings-grid">
        <label>Phone numbers<textarea rows="3" value={form.phone_numbers} onChange={event => change('phone_numbers', event.target.value)} placeholder="One phone number per line" /><small>One number per line, up to eight.</small></label>
        <label>Viber numbers<textarea rows="3" value={form.viber_numbers} onChange={event => change('viber_numbers', event.target.value)} placeholder="One Viber number per line" /><small>Use numbers that can receive Viber messages.</small></label>
        <label>Telegram link<input type="url" value={form.telegram_url} onChange={event => change('telegram_url', event.target.value)} placeholder="https://t.me/youraccount" /></label>
        <label>Support email<input type="email" value={form.email} onChange={event => change('email', event.target.value)} placeholder="support@example.com" /></label>
      </div>
    </section>
    <section>
      <h2>Community</h2>
      <p>Add a group, channel, or community page where PwarMyar users can connect.</p>
      <div className="office-contact-settings-grid">
        <label>Community name<input maxLength="100" value={form.community_label} onChange={event => change('community_label', event.target.value)} placeholder="PwarMyar community" /><small>Shown when a community link is provided.</small></label>
        <label>Community link<input type="url" value={form.community_url} onChange={event => change('community_url', event.target.value)} placeholder="https://example.com/community" /><small>Use a secure https:// link.</small></label>
      </div>
    </section>
    {error && <div className="feedback error" role="alert">{error}</div>}
    {success && <div className="office-success" role="status"><Check size={15} /> {success}</div>}
    <footer className="office-settings-footer"><span>Keep at least one contact method or community link. Empty fields stay hidden.</span><button className="office-button-primary" type="submit" disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save contact details'}</button></footer>
  </form>;
}
