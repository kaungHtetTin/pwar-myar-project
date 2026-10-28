import React, { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search, Navigation, Store, X } from 'lucide-react';
import { useText } from './i18n';
import { useEndless } from './useEndless';
import { useShopPageActive } from './RetainedViews';
import { ProductMedia } from './ShoppingComponents';
import './shop-radar.css';

function RadarLoading({ children, centered = false }) {
  return <div className={`radar-loading${centered ? ' radar-loading-centered' : ''}`} role="status"><span className="radar-loading-signal" aria-hidden="true"><LocateFixed size={22} /></span><span>{children}<span className="radar-loading-dots" aria-hidden="true"><i /><i /><i /></span></span></div>;
}

function RadarResults({ position, radius, query, ListEnd }) {
  const text = useText(), active = useShopPageActive();
  const path = `/marketplace/radar?${new URLSearchParams({ latitude: position.latitude, longitude: position.longitude, radius_km: radius, q: query })}`;
  const list = useEndless(path);
  const [selection, setSelection] = useState(null);
  const selected = selection?.path === path ? selection.shop : null;
  const center = selected?.location || position;
  const directions = selected ? `https://www.google.com/maps/dir/?api=1&origin=${position.latitude},${position.longitude}&destination=${selected.location.latitude},${selected.location.longitude}` : null;
  const distanceLabel = value => value < 1 ? text('{distance} m away', { distance: Math.round(value * 1000) }) : text('{distance} km away', { distance: Number(value).toFixed(1) });
  return <div className="radar-results">
    <section className="radar-map-panel" aria-label={text('Nearby shop map')}>
      {active && <iframe title={text('Shop Radar map')} src={`https://maps.google.com/maps?q=${encodeURIComponent(`${center.latitude},${center.longitude}`)}&z=${selected ? 16 : radius > 10 ? 11 : 14}&output=embed`} loading="lazy" referrerPolicy="no-referrer" />}
      <div className="radar-map-caption"><MapPin size={17} aria-hidden="true" /><span>{selected ? selected.display_name : text('Your current location')}</span>{selected && <><button type="button" aria-label={text('Center on my location')} onClick={() => setSelection(null)}><LocateFixed size={18} /></button><a className="button radar-directions" href={directions} target="_blank" rel="noreferrer"><Navigation size={16} aria-hidden="true" />{text('Directions')}</a></>}</div>
    </section>
    <aside className="radar-nearby-panel" aria-label={text('Nearby shops')}>
    <div className="radar-list-heading"><h2>{text('Nearby shops')}</h2><span>{text('Nearest first')}</span></div>
    {!list.busy && !list.error && !list.items.length && <div className="radar-empty"><Store size={32} aria-hidden="true" /><h3>{text('No shops found nearby')}</h3><p>{text('Try a wider distance range or another shop name.')}</p></div>}
    <div className="radar-shop-list">{list.items.map(shop => <article key={shop.slug} className={`radar-shop${selected?.slug === shop.slug ? ' is-selected' : ''}`}>
      <a className="radar-shop-link" href={`#/store/${encodeURIComponent(shop.slug)}?origin=marketplace`}>
        <ProductMedia src={shop.logo_url} name={shop.display_name} className="radar-shop-logo" fallback={<Store size={22} />} />
        <span className="radar-shop-copy"><strong title={shop.display_name}>{shop.display_name}</strong><small className={shop.accepting_orders ? 'is-open' : ''}>{text(shop.accepting_orders ? 'Accepting orders' : 'Orders paused')}</small></span>
      </a>
      <div className="radar-shop-actions"><strong>{distanceLabel(shop.distance_km)}</strong><button type="button" aria-label={text('Show on map')} title={text('Show on map')} aria-pressed={selected?.slug === shop.slug} onClick={() => { setSelection({ path, shop }); }}><MapPin size={17} aria-hidden="true" /></button></div>
    </article>)}</div>
    {list.busy && <RadarLoading>{text('Finding nearby shops…')}</RadarLoading>}
    {!list.busy && (list.error || list.items.length > 0) && <ListEnd list={list} skeleton="shops" />}
    </aside>
  </div>;
}

export function ShopRadar({ ListEnd }) {
  const text = useText(), searchId = useId();
  const [position, setPosition] = useState(null), [locating, setLocating] = useState(true), [error, setError] = useState('');
  const [radius, setRadius] = useState(5), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const requestId = useRef(0), busy = useRef(false);
  const initialLocate = useRef(locate);
  useEffect(() => {
    initialLocate.current();
    return () => { requestId.current++; busy.current = false; };
  }, []);
  function locate() {
    if (busy.current) return;
    if (!navigator.geolocation) { setLocating(false); setError(text('Location is unavailable in this browser.')); return; }
    busy.current = true; setLocating(true); setError(''); const id = ++requestId.current;
    navigator.geolocation.getCurrentPosition(result => {
      if (requestId.current !== id) return;
      busy.current = false; setLocating(false);
      const { latitude, longitude, accuracy } = result.coords;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { setError(text('Unable to determine your location. Please try again.')); return; }
      setPosition({ latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)), accuracy, fix: id });
    }, failure => {
      if (requestId.current !== id) return;
      busy.current = false; setLocating(false);
      setError(text(failure.code === 1 ? 'Allow location access in your browser settings, then try again.' : failure.code === 3 ? 'Finding your location timed out. Please try again.' : 'Unable to determine your location. Please try again.'));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  return <section className={`shop-radar-page${position ? ' has-position' : ''}`}>
    {locating && <RadarLoading centered>{text('Finding your location…')}</RadarLoading>}
    {error && <div className="notice error radar-location-error" role="alert">{error}<button type="button" disabled={locating} onClick={locate}>{text('Try again')}</button></div>}
    {position && <>
      <div data-shop-refresh-bar className="radar-controls"><label><span className="sr-only">{text('Distance range')}</span><select aria-label={text('Distance range')} value={radius} onChange={event => setRadius(Number(event.target.value))}>{[1, 3, 5, 10, 25, 50].map(value => <option key={value} value={value}>{value} km</option>)}</select></label>
        <form className="radar-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}><label className="sr-only" htmlFor={searchId}>{text('Search nearby shops')}</label><input id={searchId} type="search" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Search nearby shops')} />{search && <button type="button" aria-label={text('Clear search')} onClick={() => { setSearch(''); setQuery(''); }}><X size={17} /></button>}<button type="submit" aria-label={text('Search nearby shops')}><Search size={18} /></button></form>
      </div>
      <RadarResults key={position.fix} position={position} radius={radius} query={query} ListEnd={ListEnd} />
    </>}
  </section>;
}
