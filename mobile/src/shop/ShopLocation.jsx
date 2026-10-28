import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, IconButton } from '../components/Controls';
import React, { useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronRight, Clock3, Crosshair, Info, MapPin, MapPinOff, Navigation, RefreshCw, ShieldCheck, Store, WifiOff } from 'lucide-react';
import { apiRequest } from '../api/client';
import { ShopBusy, ShopLoadState } from './ShopPrimitives';
import { useShopResource } from './useShopResource';
import { shopDate } from './shopUtils';

const HELP = [
  ['denied', Navigation, 'Location permission denied', 'Allow location access for this app in your phone settings.', 'Open your browser or device app settings, allow location access for PwarMyar, then return here and try again.'],
  ['unavailable', WifiOff, 'Location unavailable', 'Make sure GPS is turned on and you are outdoors or near a window.', 'Turn on device location services and move somewhere with a clearer GPS signal, then try again.'],
  ['timeout', Clock3, 'Location request timed out', 'Check your connection and try again.', 'Wait for a stronger GPS signal, check your connection and try updating the location again.'],
  ['insecure', ShieldCheck, 'Insecure environment', 'Update your location from a secure, trusted device.', 'Open the app over HTTPS or on localhost. Location access is unavailable on an insecure connection.'],
];
function locationError(kind, message) { return Object.assign(new Error(message), { kind }); }
function deviceLocation() {
  if (!navigator.geolocation) return Promise.reject(locationError('unavailable', 'Location is unavailable on this device.'));
  if (window.isSecureContext === false) return Promise.reject(locationError('insecure', 'Location access requires HTTPS or localhost.'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
    error => reject(locationError(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable', error.code === 1 ? 'Allow location access in your device and app settings, then retry.' : error.code === 3 ? 'Location timed out. Check device location and retry.' : 'Enable device location and retry.')),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  ));
}
function LocationDisclosure({ detailed = false }) {
  return <aside className="shop-location-disclosure"><Info size={21} aria-hidden="true" /><div>{detailed && <strong>Why we need your location</strong>}<p>{detailed ? 'Only the shop owner can update the shop location using this device’s GPS. Your exact coordinates will be shared publicly with customers so they can find your shop on the map and see the correct distance in delivery services.' : 'Only the shop owner can update the location using this device’s GPS. Your exact coordinates will be shared publicly with customers.'}</p></div></aside>;
}
export function ShopLocation({ session, onNavigate, required = false, onSubmitted, locationState }) {
  const resource = useShopResource(locationState ? null : '/shop-admin/owner-location');
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [saved, setSaved] = useState(null);
  const working = useRef(false), owner = session?.user?.role === 'owner';
  const state = locationState || resource.data, location = state?.location;
  function back() { if (!working.current) { if (required) setError(null); else onNavigate?.('/shop', { back: true }); } }
  async function submit(event) {
    event.preventDefault(); if (working.current || !owner) return;
    working.current = true; setBusy(true); setError(current => current?.kind === 'denied' ? current : null);
    try { const coords = await deviceLocation(); const result = await apiRequest('/shop-admin/owner-location', { method: 'POST', body: JSON.stringify(coords) }); setError(null); resource.setData(result); setSaved(true); onSubmitted?.(result); }
    catch (e) { setError({ kind: e.kind || 'save', message: e.message }); }
    finally { working.current = false; setBusy(false); }
  }
  const denied = error?.kind === 'denied';
  return <section className={`shop-location-screen${denied ? ' is-denied' : ''}${required ? ' is-required' : ''}`}>
    {!required && <PageAppBar className="shop-location-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back" disabled={busy} onClick={back}><ArrowLeft size={21} aria-hidden="true" /></IconButton><h1>Shop location</h1><AppBarMenu /></PageAppBar>}
    <ShopLoadState resource={locationState ? { data: locationState } : resource}>{state && (denied ? <div className="shop-location-denied"><span className="shop-location-denied-icon"><MapPinOff size={58} aria-hidden="true" /></span><h2>Location access denied</h2><p>This app can’t access your device’s location. Enable location access for this app in your phone settings, then try again.</p><LocationDisclosure detailed /><form onSubmit={submit}><Button variant="primary" type="submit" className="mobile-primary" disabled={busy}>{busy ? <ShopBusy label="Getting current location..." /> : <><RefreshCw size={20} aria-hidden="true" />Try again</>}</Button><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy} onClick={back}><ArrowLeft size={20} aria-hidden="true" />Back</Button></form></div> : <>
      {required && <><h1>Shop location</h1><p className="shop-location-required-note">Submit the shop location before opening shop management.</p></>}
      <section className="shop-location-card shop-location-saved"><div className="shop-location-section-heading"><span className="shop-location-symbol"><MapPin size={25} aria-hidden="true" /></span><div><h2>{state.submitted ? 'Location is set' : 'Set your shop location'}</h2><p>{state.submitted ? 'Your shop’s public location is saved.' : 'Save your shop’s location so customers can find you.'}</p></div></div>{location && <dl><div><Crosshair size={22} aria-hidden="true" /><div><dt>Coordinates</dt><dd>{Number(location.latitude).toFixed(4)}, {Number(location.longitude).toFixed(4)}</dd></div></div><div><CalendarDays size={22} aria-hidden="true" /><div><dt>Last updated</dt><dd>{location.captured_at ? shopDate(location.captured_at, session?.business?.timezone) : 'Not available'}</dd></div></div></dl>}</section>
      <section className="shop-location-card"><div className="shop-location-section-heading"><span className="shop-location-symbol"><Store size={24} aria-hidden="true" /></span><div><h2>Your public location</h2><p>Your shop’s location helps customers find your shop on the map and see the correct distance in delivery services.</p></div></div><LocationDisclosure />{saved && <p role="status" className="shop-location-success">Shop location saved.</p>}{error && <p role="alert" className="shop-location-error">{error.message}</p>}{owner ? <form onSubmit={submit}><Button variant="primary" type="submit" className="mobile-primary" disabled={busy}>{busy ? <ShopBusy label="Getting current location..." /> : <><Crosshair size={20} aria-hidden="true" />{state.submitted ? 'Update location' : 'Allow location and save'}</>}</Button><p className="shop-location-update-hint">Move to your shop and make sure GPS is on, then tap to update your location.</p></form> : <p role="alert">Ask the business owner to submit the shop location.</p>}</section>
      <section className="shop-location-card shop-location-help"><h2>Need help?</h2><p>If we can’t get your location, try the steps below.</p>{HELP.map(([key, Icon, title, summary, detail]) => <details key={key}><summary><Icon size={23} aria-hidden="true" /><span><strong>{title}</strong><small>{summary}</small></span><ChevronRight size={18} aria-hidden="true" /></summary><p>{detail}</p></details>)}</section>
    </>)}</ShopLoadState>
  </section>;
}
export function ShopLocationGate({ children, session, onNavigate }) {
  const resource = useShopResource('/shop-admin/owner-location');
  return <ShopLoadState resource={resource}>{resource.data?.submitted ? children : <ShopLocation required locationState={resource.data} session={session} onNavigate={onNavigate} onSubmitted={resource.setData} />}</ShopLoadState>;
}
