import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { Button, Select } from '../components/Controls';
import { usePageRefresh } from '../navigation/pageRefresh';
import { configureTimezone } from '../timezone';
import { SettingField, SettingsSection } from './SettingsParts';

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
    if (submitting.current) return;
    setLoading(true); setLoadError(''); setError(''); setFieldError('');
    try {
      const data = await apiRequest('/settings/timezone', signal ? { signal } : undefined);
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
  usePageRefresh(load);

  async function save(event) {
    event.preventDefault();
    if (submitting.current || loading || loadError) return;
    submitting.current = true; setSaving(true); setError(''); setFieldError('');
    try {
      const saved = await apiRequest('/settings/timezone', { method: 'PUT', body: JSON.stringify({ timezone, expected_timezone: original }) });
      configureTimezone(saved.session);
      window.dispatchEvent(new CustomEvent('mkpos:session-updated', { detail: saved.session }));
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

  return <form className="settings-mobile-form" onSubmit={save} aria-label="Business time zone settings">
    <SettingsSection title="Business time zone" description="Use one time zone across desktop and mobile. Asia/Yangon is the default.">
      {loading && <p role="status">Loading time zones...</p>}
      {loadError && <p className="mobile-field-error" role="alert">{loadError}</p>}
      <SettingField label="Business time zone" error={fieldError} hint="Dates, receipts, daily reports, filters and weekly opening hours follow this time zone.">
        <Select value={timezone} onChange={event => { setTimezone(event.target.value); setFieldError(''); }} disabled={loading || saving || Boolean(loadError)}>
          {[...new Set(['Asia/Yangon', timezone, ...options])].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}{value === 'Asia/Yangon' ? ' (Myanmar - default)' : ''}</option>)}
        </Select>
      </SettingField>
      {preview && <p>Time preview: <strong>{preview}</strong> ({timezone})</p>}
      <p>Historical daily totals may move between dates. Recorded transaction times stay unchanged. Existing promotions keep their scheduled moments, so their displayed local times may change. Other devices use the updated setting after refreshing or reconnecting.</p>
      {error && <p className="mobile-field-error" role="alert">{error}</p>}
      <Button variant="secondary" type="button" onClick={() => load()} disabled={loading || saving}>Reload time zones</Button>
    </SettingsSection>
    <div className="mobile-form-actions">
      <Button variant="secondary" className="mobile-secondary" type="button" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button variant="primary" className="mobile-primary" type="submit" disabled={loading || saving || Boolean(loadError) || !options.length}>{saving ? 'Saving...' : 'Save time zone'}</Button>
    </div>
  </form>;
}
