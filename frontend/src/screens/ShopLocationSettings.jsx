import React, { useState } from "react";
import { MapPin } from "lucide-react";
import { request } from "../api";
import { captureDeviceLocation } from "../shopLocation";

export function ShopLocationSettings({ location, owner, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function update() {
    if (busy) return;
    setBusy(true); setError(""); setSuccess(false);
    try {
      const captured = await captureDeviceLocation();
      await request("/shop-admin/owner-location", { method: "POST", body: JSON.stringify(captured) });
      onChange(captured);
      setSuccess(true);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="shop-location-settings">
    <div className="shop-location-settings-heading">
      <h3>Shop location</h3>
      {owner && <button type="button" disabled={busy} onClick={update}><MapPin size={16} />{busy ? "Getting current location…" : "Update shop location"}</button>}
    </div>
    <p>Your submitted shop location will be shown publicly to customers.</p>
    {location ? <p className="shop-location-coordinates">
      <span>{Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}</span>
      <a href={`https://www.google.com/maps?q=${Number(location.latitude)},${Number(location.longitude)}`} target="_blank" rel="noreferrer">Open in maps</a>
    </p> : <p>No shop location available.</p>}
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">Shop location updated.</p>}
  </div>;
}
