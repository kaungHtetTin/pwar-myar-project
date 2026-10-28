import React, { useEffect, useRef, useState } from "react";
import { Package } from "lucide-react";
import { ProductPhoto } from "../components/ProductPhoto";
import { request } from "../api";

export function ShopPublicationRow({ product, busy = false, onSaved, onSaving }) {
  const [form, setForm] = useState({ published: !!product.published, unit: product.unit || "base" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const working = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!working.current) setForm({ published: !!product.published, unit: product.unit || "base" }); }, [product.published, product.unit]);

  async function save(patch) {
    if (working.current || busy) return;
    const previous = form;
    const next = { ...form, ...patch };
    working.current = true;
    setForm(next); setSaving(true); setError("");
    onSaving?.(true);
    try {
      await request(`/shop-admin/publications/${product.id}`, { method: "PUT", body: JSON.stringify(next) });
      if (mounted.current) onSaved?.(next);
    } catch (error) {
      if (mounted.current) { setForm(previous); setError(error.message); }
    } finally {
      working.current = false;
      if (mounted.current) setSaving(false);
      onSaving?.(false);
    }
  }

  const price = form.unit === "purchase" ? product.purchase_price : product.base_price;
  const salesUnit = form.unit === "purchase" ? product.purchase_unit : product.base_unit;
  return <tr className="shop-publication-row" aria-busy={saving}>
    <td><div className="shop-publication-product"><span className="shop-publication-photo" aria-hidden="true"><Package size={18} />{product.photo_url && <ProductPhoto path={product.photo_url} />}</span><span><strong>{product.name}</strong><small className="shop-cell-meta">{product.category || product.base_unit}</small></span></div></td>
    <td><strong>{Number(product.stock || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong><small className="shop-cell-meta">{product.base_unit}</small></td>
    <td>{salesUnit}</td>
    <td className="shop-money-cell"><strong>{price == null ? "Not set" : `${Number(price).toLocaleString()} ${product.currency}`}</strong><small className="shop-cell-meta">{product.price_type}</small></td>
    <td>
      <label className="shop-checkbox">
        <span className="shop-publication-control">
          <input hidden={saving} disabled={busy || saving} type="checkbox" aria-label={`Publish ${product.name} online`} checked={form.published} onChange={(event) => save({ published: event.target.checked })} />
          {saving && <span className="shop-publication-progress" role="progressbar" aria-label={`Saving publication for ${product.name}`} />}
        </span>
        Publish online
      </label>
      {error && <small className="shop-publication-feedback" role="alert">{error}</small>}
    </td>
  </tr>;
}
