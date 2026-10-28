import { officeDateTime } from './dateTime';
import React, { useRef, useState } from 'react';
import { Ban, ExternalLink, MapPin, ShieldCheck, Store } from 'lucide-react';
import { api } from './api';
import './business-storefront.css';

export function BusinessStorefront({ businessId, storefront, disabled = false, onSaved }) {
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const saving = useRef(false);
  const suspended = Boolean(storefront.marketplace_suspended);
  async function submit(event) {
    event.preventDefault();
    if (saving.current || disabled) return;
    if (!reason.trim()) { setError('Enter a reason for this change.'); return; }
    saving.current = true; setBusy(true); setError(''); setNotice('');
    const changes = { marketplace_suspended: !suspended, marketplace_suspension_reason: reason.trim() };
    try {
      await api(`/office/ecommerce/stores/${businessId}/marketplace`, { method: 'PUT', body: JSON.stringify({ marketplace_suspended: changes.marketplace_suspended, reason: changes.marketplace_suspension_reason }) });
      onSaved({ ...storefront, ...changes }); setReason('');
      setNotice(suspended ? 'Marketplace visibility restored.' : 'Marketplace visibility suspended.');
    } catch (e) { setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <section className="office-panel office-storefront-card" aria-label="Customer storefront">
    <div className="office-panel-header"><div className="office-storefront-heading"><span className="office-storefront-icon"><Store size={20} /></span><div><h2>Customer storefront</h2><p>Manage visibility in the customer marketplace.</p></div></div><span className={`office-status office-status-${suspended ? 'suspended' : 'active'}`}>{suspended ? 'Suspended' : 'Allowed'}</span></div>
    <div className="office-storefront-body">
      <div className="office-storefront-identity"><strong>{storefront.display_name}</strong><small>/{storefront.slug}</small></div>
      <dl className="office-storefront-statuses"><div><dt>Storefront</dt><dd>{storefront.storefront_enabled ? 'Enabled' : 'Disabled'}</dd></div><div><dt>Marketplace participation</dt><dd>{storefront.marketplace_enabled ? 'Opted in' : 'Opted out'}</dd></div></dl>
      {storefront.marketplace_suspension_reason && <div className="office-storefront-reason"><strong>Last visibility change</strong><p>{storefront.marketplace_suspension_reason}</p></div>}
      <form onSubmit={submit}>
        <fieldset disabled={busy || disabled}>
          <label>Reason for {suspended ? 'restoring' : 'suspending'} visibility<textarea required maxLength={2000} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain this marketplace visibility change" /></label>
          <p className="office-storefront-help">{suspended ? 'Restoring allows marketplace listing when the shop is opted in and its storefront is enabled.' : 'Suspending hides this shop from marketplace discovery.'}</p>
          {error && <div className="feedback error" role="alert">{error}</div>}
          {notice && <p className="office-success" role="status">{notice}</p>}
          <button type="submit" className={suspended ? 'office-button-primary' : 'office-button-danger'}>{suspended ? <ShieldCheck size={15} /> : <Ban size={15} />}{busy ? 'Saving...' : suspended ? 'Restore marketplace visibility' : 'Suspend marketplace visibility'}</button>
        </fieldset>
      </form>
    </div>
  </section>;
}

export function ShopGpsPosition({ location }) {
  const lat = Number(location?.latitude), lng = Number(location?.longitude);
  const valid = location && location.latitude != null && location.longitude != null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const coordinates = `${lat},${lng}`;
  return <section className="office-panel office-shop-location" aria-label="Shop GPS position">
    <div className="office-panel-header"><div className="office-storefront-heading"><span className="office-storefront-icon"><MapPin size={19} /></span><div><h2>Shop GPS position</h2><p>Location submitted by the shop owner.</p></div></div></div>
    {valid ? <>
      <iframe title="Shop GPS map" src={`https://maps.google.com/maps?q=${encodeURIComponent(coordinates)}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer" />
      <div className="office-location-body"><dl><div><dt>Latitude</dt><dd>{lat.toFixed(7)}</dd></div><div><dt>Longitude</dt><dd>{lng.toFixed(7)}</dd></div>{location.accuracy != null && <div><dt>GPS accuracy</dt><dd>Within {Number(location.accuracy).toLocaleString()} m</dd></div>}{location.captured_at && <div><dt>Captured</dt><dd>{officeDateTime(location.captured_at)}</dd></div>}</dl>
      <a className="office-location-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open in Google Maps</a></div>
    </> : <div className="office-location-empty"><MapPin size={28} /><strong>No GPS position saved</strong><p>The shop owner has not submitted a location yet.</p></div>}
  </section>;
}
