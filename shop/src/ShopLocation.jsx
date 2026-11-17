import React from "react";
import { MapPin } from "lucide-react";
import { useText } from "./i18n";

export function ShopLocation({ location }) {
  const text = useText();
  if (!location || [location.latitude, location.longitude].some(value => value == null || String(value).trim() === '')) return null;
  const latitude = Number(location.latitude), longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  const coordinates = `${latitude},${longitude}`;
  return <div className="store-location">
    <MapPin size={18} aria-hidden="true" />
    <span><strong>{text("Shop location")}</strong><small>{latitude.toFixed(6)}, {longitude.toFixed(6)}</small></span>
    <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer">{text("Open in maps")}</a>
    <iframe className="store-location-map" title={text('Shop location')} src={`https://maps.google.com/maps?q=${encodeURIComponent(coordinates)}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer" />
  </div>;
}
