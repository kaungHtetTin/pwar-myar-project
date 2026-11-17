import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed, RotateCcw } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useRetainedActivity } from './retainedActivity';

export function ShopDistributionMap({ points, selected, onSelect, filterKey }) {
  const host = useRef(null), map = useRef(null), layer = useRef(null), tiles = useRef(null), select = useRef(onSelect), fitted = useRef(null);
  const active = useRetainedActivity();
  const [tileError, setTileError] = useState(false);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    const instance = L.map(host.current, { preferCanvas: true, scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false }).setView([20.5, 96], 5);
    map.current = instance;
    layer.current = L.layerGroup().addTo(instance);
    tiles.current = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: import.meta.env.VITE_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    tiles.current.on('tileerror', () => setTileError(true));
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(host.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    const displayed = selected?.latitude != null && !points.some(point => point.id === selected.id) ? [...points, selected] : points;
    for (const point of displayed) {
      const marker = L.circleMarker([point.latitude, point.longitude], { radius: point.id === selected?.id ? 10 : 7,
        color: point.status === 'suspended' ? '#b45309' : '#006bdc', weight: 2, fillOpacity: .8 });
      const label = document.createElement('span'); label.textContent = point.display_name || point.business_name;
      marker.bindTooltip(label).on('click', () => select.current(point)).addTo(layer.current);
    }
    if (points.length && fitted.current !== filterKey) {
      map.current.fitBounds(points.map(point => [point.latitude, point.longitude]), { padding: [35, 35], maxZoom: 14, animate: false });
      fitted.current = filterKey;
    }
  }, [points, selected, filterKey]);
  useEffect(() => {
    if (selected?.latitude != null) map.current?.setView([selected.latitude, selected.longitude], 15, { animate: false });
  }, [selected?.id, selected?.latitude, selected?.longitude]);
  useEffect(() => { if (active) map.current?.invalidateSize({ pan: false }); }, [active]);
  function fitShops() {
    if (points.length) map.current.fitBounds(points.map(point => [point.latitude, point.longitude]), { padding: [35, 35], maxZoom: 14, animate: false });
  }
  return <section className="office-distribution-map-panel" aria-label="Shop location map">
    <div className="office-distribution-map-tools"><span><i />Active business <i className="is-suspended" />Suspended business</span><button className="office-button" type="button" onClick={fitShops} disabled={!points.length}><LocateFixed size={15} aria-hidden="true" />Fit shops</button></div>
    {tileError && <div className="office-distribution-tile-error" role="status">Map background could not load. Shop locations and the list are still available. <button className="office-button" type="button" onClick={() => { setTileError(false); tiles.current.redraw(); }}><RotateCcw size={15} aria-hidden="true" />Retry map</button></div>}
    <div ref={host} className="office-distribution-map" role="region" aria-label="Shop distribution map" />
  </section>;
}
