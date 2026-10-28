import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { request } from "../api";
import { captureDeviceLocation } from "../shopLocation";

export function ShopLocationGate({ children }) {
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setSetup(null);
    setError("");
    Promise.all([request("/auth/me"), request("/shop-admin/owner-location")])
      .then(([session, location]) => { if (active) setSetup({ owner: session.user.role === "owner", submitted: location.submitted }); })
      .catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [retry]);
  async function submitLocation() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const captured = await captureDeviceLocation();
      await request("/shop-admin/owner-location", { method: "POST", body: JSON.stringify(captured) });
      setSetup((current) => ({ ...current, submitted: true }));
    } catch (error) {
      setError(error.message);
    } finally { setBusy(false); }
  }
  if (setup?.submitted) return children;
  return <div className="shop-location-gate-container"><section className="panel shop-location-gate">
    <MapPin size={24} aria-hidden="true" />
    <h2>Shop location required</h2>
    {!setup ? <>
      {error ? <><p role="alert">{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></> : <p role="status">Checking shop location…</p>}
    </> : setup.owner ? <>
      <p>Allow location access and submit your current shop location to use Shop management.</p>
      <p>Your submitted shop location will be shown publicly to customers.</p>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="primary" disabled={busy} onClick={submitLocation}><MapPin size={16} />{busy ? "Getting current location…" : "Allow location and submit"}</button>
    </> : <>
      <p>The business owner must submit the shop location before staff can use Shop management.</p>
      <button type="button" onClick={() => setRetry((value) => value + 1)}>Check again</button>
    </>}
  </section></div>;
}
