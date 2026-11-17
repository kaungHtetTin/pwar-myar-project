import React, { useEffect, useState } from "react";
import { Edit, Plus, Power, Save, Trash2 } from "lucide-react";
import { request } from "../api";
import { Field, Modal } from "../components/common";
import { AppBarActions } from "../components/WorkspaceHeader";
import { RowActions } from "../components/RowActions";

const blank = { name: "", type: "transfer", bank: "", account_name: "", account_no: "", instructions: "", is_active: true, provider: "manual" };

export function ShopPaymentMethods({ run, refresh, busy }) {
  const [methods, setMethods] = useState(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const formBusy = busy || saving;
  const openForm = (method) => { setFormError(""); setEdit(method); };
  useEffect(() => {
    let active = true;
    request("/shop-admin/payment-methods").then((data) => { if (active) setMethods(data.items); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [refresh]);
  const change = (key, value) => setEdit((current) => ({ ...current, [key]: value }));
  const editor = edit && <Modal open title={edit.id ? "Edit payment method" : "Add payment method"} size="medium" busy={formBusy} onClose={() => setEdit(null)} footer={<>
    <button type="button" disabled={formBusy} onClick={() => setEdit(null)}>Cancel</button>
    <button type="submit" form="shop-payment-method-form" className="primary" disabled={formBusy}><Save size={16} /> Save payment method</button>
  </>}>
    <form id="shop-payment-method-form" className="shop-settings" onSubmit={(event) => {
      event.preventDefault();
      if (formBusy) return;
      setSaving(true);
      setFormError("");
      run(async () => {
        try {
        await request(`/shop-admin/payment-methods${edit.id ? `/${encodeURIComponent(edit.id)}` : ""}`, {
          method: edit.id ? "PUT" : "POST", body: JSON.stringify(edit),
        });
        setEdit(null);
        } catch (error) { setFormError(error.message); throw error; }
        finally { setSaving(false); }
      });
    }}>
      {formError && <p role="alert">{formError}</p>}
      <fieldset disabled={formBusy} className="shop-payment-form-fields">
        <p>Customers pay your shop directly. Check receipt before approving each order.</p>
        <div className="shop-form-grid">
          <Field label="Method name"><input required maxLength={100} value={edit.name} onChange={(e) => change("name", e.target.value)} /></Field>
          <Field label="Method type"><select value={edit.type} onChange={(e) => change("type", e.target.value)}>
            <option value="cash">Cash</option><option value="transfer">Manual bank / wallet transfer</option>
          </select></Field>
          {edit.type === "transfer" && <>
            <Field label="Bank / wallet"><input maxLength={100} value={edit.bank || ""} onChange={(e) => change("bank", e.target.value)} /></Field>
            <Field label="Account holder"><input maxLength={255} value={edit.account_name || ""} onChange={(e) => change("account_name", e.target.value)} /></Field>
            <Field label="Account number / phone"><input maxLength={100} value={edit.account_no || ""} onChange={(e) => change("account_no", e.target.value)} /></Field>
          </>}
        </div>
        <Field label="Customer instructions"><textarea rows={3} maxLength={2000} value={edit.instructions || ""} onChange={(e) => change("instructions", e.target.value)} /></Field>
        <label className="shop-checkbox"><input type="checkbox" checked={edit.is_active} onChange={(e) => change("is_active", e.target.checked)} />Available at checkout</label>
        <p>Processing: manual review. Automatic bank and card processing will be added later.</p>
      </fieldset>
    </form>
  </Modal>;
  return <div className="shop-settings">
    <AppBarActions><button type="button" className="primary" disabled={formBusy || !methods || methods.length >= 20} onClick={() => openForm({ ...blank })}><Plus size={16} /> Add payment method</button></AppBarActions>
    {editor}
    {error && <p role="alert">{error}</p>}
    {!methods ? <p role="status">Loading payment methods…</p> : <div className="shop-table-card"><div className="table-wrap sheet-table shop-table-scroll">
      <table className="shop-data-table" aria-label="Shop payment methods">
        <colgroup><col style={{ width: "23%" }} /><col /><col style={{ width: "16%" }} /><col style={{ width: "16%" }} /><col style={{ width: 88 }} /></colgroup>
        <thead><tr><th>Method</th><th>Receiving account</th><th>Processing</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{methods.map((method) => <tr key={method.id}>
          <td><strong>{method.name}</strong><small className="shop-cell-meta">{method.type === "cash" ? "Cash" : "Bank / wallet transfer"}</small></td>
          <td>{method.type === "cash" ? "On delivery or pickup" : <>{method.bank}<small className="shop-cell-meta">{method.account_name}</small><small className="shop-cell-meta">{method.account_no}</small></>}</td>
          <td>Manual approval</td><td><span className={`status-badge ${method.is_active ? "completed" : "voided"}`}>{method.is_active ? "Active" : "Disabled"}</span></td>
          <td><RowActions label={method.name} disabled={busy}>
            <button type="button" onClick={() => openForm({ ...blank, ...method })}><Edit size={15} /> Edit</button>
            <button type="button" onClick={() => run(() => request(`/shop-admin/payment-methods/${encodeURIComponent(method.id)}`, { method: "PUT", body: JSON.stringify({ ...method, is_active: !method.is_active }) }))}><Power size={15} /> {method.is_active ? "Disable" : "Enable"}</button>
            <button type="button" className="danger-button" onClick={() => {
              if (window.confirm(`Delete ${method.name}? Existing order payment details will be preserved.`)) run(() => request(`/shop-admin/payment-methods/${encodeURIComponent(method.id)}`, { method: "DELETE" }));
            }}><Trash2 size={15} /> Delete</button>
          </RowActions></td>
        </tr>)}</tbody>
      </table>
    </div></div>}
  </div>;
}
