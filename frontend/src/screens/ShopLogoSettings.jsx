import React, { useRef, useState } from "react";
import { Store, Pencil, LoaderCircle } from "lucide-react";
import { request } from "../api";
import { emitDataChange } from "../dataEvents";

export function ShopLogoSettings({ logo, owner, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(file) {
    setBusy(true); setError("");
    try {
      const body = new FormData();
      if (file) body.append("logo", file);
      const saved = await request("/settings/logo", { method: file ? "POST" : "DELETE", ...(file ? { body } : {}), timeoutMs: 30000 });
      onChange(saved.receipt_logo_data_url);
      emitDataChange(["settings"], "shop");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <section className="shop-logo-row">
    <div className="shop-logo-preview">{logo ? <img src={logo} alt="Current business logo" /> : <Store size={30} aria-hidden="true" />}{owner && <button type="button" className="shop-image-edit" aria-label="Edit business logo" title="Edit business logo" disabled={busy} onClick={() => input.current?.click()}>{busy ? <LoaderCircle size={16} className="shop-image-spinner" aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}</button>}</div>
    {owner && <div className="shop-logo-actions">
      <input ref={input} className="shop-logo-input" type="file" aria-label="Business logo file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) save(file); }} />
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
