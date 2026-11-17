import React, { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../api';
import { Field } from '../components/common';
import { configureTimezone } from '../timezone';
import { emitDataChange } from '../dataEvents';

export function BusinessTimezoneSettings({ onSaved, onCancel }) {
  const [timezone, setTimezone] = useState('Asia/Yangon');
  const [original, setOriginal] = useState('Asia/Yangon');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const alive = useRef(false), submitting = useRef(false);

  const load = useCallback(async (signal) => {
    setLoading(true); setLoadError(''); setError(''); setFieldError('');
    try {
      const data = await request('/settings/timezone', signal ? { signal } : undefined);
      if (!alive.current || signal?.aborted) return;
      setTimezone(data.timezone || 'Asia/Yangon');
      setOriginal(data.timezone || 'Asia/Yangon');
      setOptions(data.options || []);
    } catch (err) {
      if (!alive.current || signal?.aborted) return;
      setLoadError(err.status === 404 ? 'Update the backend to enable business time zone settings.' : err.message);
    } finally {
      if (alive.current && !signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => { alive.current = false; controller.abort(); };
  }, [load]);

  async function save(event) {
    event.preventDefault();
    if (submitting.current || loading || loadError) return;
    submitting.current = true; setSaving(true); setError(''); setFieldError('');
    try {
      const saved = await request('/settings/timezone', { method: 'PUT', body: JSON.stringify({ timezone, expected_timezone: original }) });
      configureTimezone(saved.session);
      window.dispatchEvent(new CustomEvent('mkpos:session-updated', { detail: saved.session }));
      emitDataChange(['settings', 'timezone', 'sales', 'reports', 'shop'], 'settings');
      if (alive.current) { setOriginal(saved.timezone); onSaved?.(saved); }
    } catch (err) {
      if (!alive.current) return;
      const message = err.payload?.errors?.timezone;
      if (message) setFieldError(Array.isArray(message) ? message[0] : message);
      else setError(err.message);
    } finally {
      submitting.current = false;
      if (alive.current) setSaving(false);
    }
  }

  let preview = '';
  try { preview = new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date()); } catch { /* Server validation reports unsupported zone identifiers. */ }

  return <form className="settings-form" onSubmit={save} aria-label="Business time zone settings">
    <p>Use one time zone for this business across desktop and mobile. Asia/Yangon is the default.</p>
    {loading && <p role="status">Loading time zones...</p>}
    {loadError && <p role="alert">{loadError}</p>}
    <Field label="Business time zone">
      <select aria-label="Business time zone" value={timezone} onChange={event => { setTimezone(event.target.value); setFieldError(''); }} disabled={loading || saving || Boolean(loadError)} aria-invalid={Boolean(fieldError)} aria-describedby={`business-timezone-hint${fieldError ? ' business-timezone-error' : ''}`}>
        {[...new Set(['Asia/Yangon', timezone, ...options])].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}{value === 'Asia/Yangon' ? ' (Myanmar - default)' : ''}</option>)}
      </select>
    </Field>
    <small id="business-timezone-hint">Dates, receipts, daily reports, filters and weekly opening hours follow this time zone. Historical daily totals may move between dates. Existing promotions keep their scheduled moments, so their displayed local times may change.</small>
    {fieldError && <small id="business-timezone-error" role="alert">{fieldError}</small>}
    {preview && <p>Time preview: <strong>{preview}</strong> ({timezone})</p>}
    {error && <p role="alert">{error}</p>}
    <div className="settings-footer">
      <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
      <button type="button" onClick={() => load()} disabled={loading || saving}>Reload time zones</button>
      <button type="submit" className="primary" disabled={loading || saving || Boolean(loadError) || !options.length}>{saving ? 'Saving...' : 'Save time zone'}</button>
    </div>
  </form>;
}
