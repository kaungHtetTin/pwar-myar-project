import React, { useEffect, useState } from "react";
import { Edit, Plus, Save, Trash2 } from "lucide-react";
import { request } from "../api";
import { Field, Modal } from "../components/common";
import { AppBarActions } from "../components/WorkspaceHeader";
import { RowActions } from "../components/RowActions";

export function ShopDeliveryZones({ run, refresh, busy = false }) {
  const [zones, setZones] = useState(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const working = busy || saving;
  useEffect(() => {
    let active = true;
    request("/shop-admin/delivery-zones").then((data) => { if (active) { setZones(data.items); setError(""); } })
      .catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [refresh]);
  const open = (zone) => { setFormError(""); setEdit(zone); };
  function save(event) {
    event.preventDefault();
    if (working || !edit.name.trim()) return;
    setSaving(true);
    setFormError("");
    run(async () => {
      try {
        const zone = await request(`/shop-admin/delivery-zones${edit.id ? `/${encodeURIComponent(edit.id)}` : ""}`, {
          method: edit.id ? "PUT" : "POST", body: JSON.stringify({ name: edit.name.trim(), fee: Number(edit.fee) }),
        });
        setZones((items) => edit.id ? items.map((item) => item.id === edit.id ? zone : item) : [...items, zone]);
        setEdit(null);
      } catch (error) { setFormError(error.message); throw error; }
      finally { setSaving(false); }
    });
  }
  return <div className="shop-settings">
    <AppBarActions><button type="button" className="primary" disabled={working || !zones || zones.length >= 100} onClick={() => open({ name: "", fee: 0 })}><Plus size={16} /> Add delivery zone</button></AppBarActions>
    {error && <p role="alert">{error}</p>}
    {!zones ? <p role="status">Loading delivery zones…</p> : <div className="shop-table-card"><div className="table-wrap sheet-table shop-table-scroll">
      <table className="shop-data-table" aria-label="Delivery zones">
        <colgroup><col /><col style={{ width: "30%" }} /><col style={{ width: 88 }} /></colgroup>
        <thead><tr><th scope="col">Zone name</th><th scope="col" className="shop-money-cell">Delivery fee</th><th scope="col" className="table-actions-cell">Actions</th></tr></thead>
        <tbody>{zones.map((zone) => <tr key={zone.id}>
          <td><strong>{zone.name}</strong></td><td className="shop-money-cell">{Number(zone.fee).toLocaleString()}</td>
          <td className="table-actions-cell"><RowActions label={zone.name} disabled={working}>
            <button type="button" onClick={() => open({ ...zone })}><Edit size={15} /> Edit</button>
            <button type="button" className="danger-button" onClick={() => {
              if (!window.confirm(`Delete ${zone.name}? Existing order delivery details will be preserved.`)) return;
              run(async () => {
                await request(`/shop-admin/delivery-zones/${encodeURIComponent(zone.id)}`, { method: "DELETE" });
                setZones((items) => items.filter((item) => item.id !== zone.id));
              });
            }}><Trash2 size={15} /> Delete</button>
          </RowActions></td>
        </tr>)}</tbody>
      </table>
      {!zones.length && <p className="shop-list-end">No delivery zones yet.</p>}
    </div></div>}
    {edit && <Modal open title={edit.id ? "Edit delivery zone" : "Add delivery zone"} size="small" busy={working} onClose={() => setEdit(null)} footer={<>
      <button type="button" disabled={working} onClick={() => setEdit(null)}>Cancel</button>
      <button type="submit" form="shop-delivery-zone-form" className="primary" disabled={working || !edit.name.trim() || edit.fee === ""}><Save size={16} /> Save delivery zone</button>
    </>}>
      <form id="shop-delivery-zone-form" onSubmit={save}>
        {formError && <p role="alert">{formError}</p>}
        <Field label="Zone name"><input required maxLength={255} disabled={working} value={edit.name} onChange={(event) => setEdit((zone) => ({ ...zone, name: event.target.value }))} /></Field>
        <Field label="Delivery fee"><input required type="number" min="0" max="1000000000" step="1" disabled={working} value={edit.fee} onChange={(event) => setEdit((zone) => ({ ...zone, fee: event.target.value }))} /></Field>
      </form>
    </Modal>}
  </div>;
}
