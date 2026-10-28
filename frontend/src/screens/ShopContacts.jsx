import React, { useEffect, useState } from "react";
import { Edit, Plus, Save, Trash2 } from "lucide-react";
import { request } from "../api";
import { Field, Modal } from "../components/common";
import { AppBarActions } from "../components/WorkspaceHeader";
import { RowActions } from "../components/RowActions";

const platforms = { phone: "Phone", email: "Email", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", telegram: "Telegram", viber: "Viber", instagram: "Instagram", whatsapp: "WhatsApp" };

export function ShopContacts({ run, refresh, busy = false }) {
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const working = busy || saving;
  useEffect(() => {
    let active = true;
    request("/shop-admin/contacts").then((data) => { if (active) { setContacts(data.items); setError(""); } })
      .catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [refresh]);
  const open = (contact) => { setFormError(""); setEdit(contact); };
  function save(event) {
    event.preventDefault();
    if (working || !edit.value.trim()) return;
    setSaving(true);
    setFormError("");
    run(async () => {
      try {
        const contact = await request(`/shop-admin/contacts${edit.id ? `/${encodeURIComponent(edit.id)}` : ""}`, {
          method: edit.id ? "PUT" : "POST", body: JSON.stringify({ platform: edit.platform, label: edit.label.trim(), value: edit.value.trim() }),
        });
        setContacts((items) => edit.id ? items.map((item) => item.id === edit.id ? contact : item) : [...items, contact]);
        setEdit(null);
      } catch (error) { setFormError(error.message); throw error; }
      finally { setSaving(false); }
    });
  }
  return <div className="shop-settings">
    <AppBarActions><button type="button" className="primary" disabled={working || !contacts || contacts.length >= 100} onClick={() => open({ platform: "phone", label: "", value: "" })}><Plus size={16} /> Add contact</button></AppBarActions>
    {error && <p role="alert">{error}</p>}
    {!contacts ? <p role="status">Loading contacts…</p> : <div className="shop-table-card"><div className="table-wrap sheet-table shop-table-scroll">
      <table className="shop-data-table" aria-label="Contacts">
        <colgroup><col style={{ width: "18%" }} /><col style={{ width: "25%" }} /><col /><col style={{ width: 88 }} /></colgroup>
        <thead><tr><th scope="col">Platform</th><th scope="col">Label</th><th scope="col">Contact details</th><th scope="col" className="table-actions-cell">Actions</th></tr></thead>
        <tbody>{contacts.map((contact) => <tr key={contact.id}>
          <td><strong>{platforms[contact.platform]}</strong></td><td>{contact.label || "—"}</td><td>{contact.value}</td>
          <td className="table-actions-cell"><RowActions label={contact.label || platforms[contact.platform]} disabled={working}>
            <button type="button" onClick={() => open({ ...contact })}><Edit size={15} /> Edit</button>
            <button type="button" className="danger-button" onClick={() => {
              if (!window.confirm(`Delete ${contact.label || platforms[contact.platform]} contact? It will be removed from your customer shop.`)) return;
              run(async () => {
                await request(`/shop-admin/contacts/${encodeURIComponent(contact.id)}`, { method: "DELETE" });
                setContacts((items) => items.filter((item) => item.id !== contact.id));
              });
            }}><Trash2 size={15} /> Delete</button>
          </RowActions></td>
        </tr>)}</tbody>
      </table>
      {!contacts.length && <p className="shop-list-end">No contacts yet.</p>}
    </div></div>}
    {edit && <Modal open title={edit.id ? "Edit contact" : "Add contact"} size="small" busy={working} onClose={() => setEdit(null)} footer={<>
      <button type="button" disabled={working} onClick={() => setEdit(null)}>Cancel</button>
      <button type="submit" form="shop-contact-form" className="primary" disabled={working || !edit.value.trim()}><Save size={16} /> Save contact</button>
    </>}>
      <form id="shop-contact-form" onSubmit={save}>
        {formError && <p role="alert">{formError}</p>}
        <p>Contacts are shown publicly in your customer shop.</p>
        <Field label="Platform"><select disabled={working} value={edit.platform} onChange={(event) => setEdit((contact) => ({ ...contact, platform: event.target.value, value: "" }))}>{Object.entries(platforms).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></Field>
        <Field label="Label (optional)"><input maxLength={100} disabled={working} value={edit.label} onChange={(event) => setEdit((contact) => ({ ...contact, label: event.target.value }))} /></Field>
        <Field label={edit.platform === "email" ? "Email address" : edit.platform === "phone" ? "Phone number" : ["viber", "whatsapp"].includes(edit.platform) ? "Phone number or contact link" : "Contact link"}>
          <input required maxLength={500} type={edit.platform === "email" ? "email" : edit.platform === "phone" ? "tel" : ["viber", "whatsapp"].includes(edit.platform) ? "text" : "url"} disabled={working} value={edit.value} onChange={(event) => setEdit((contact) => ({ ...contact, value: event.target.value }))} />
        </Field>
        <small>{["viber", "whatsapp"].includes(edit.platform) ? "Use an international number starting with + and country code, or a full http:// or https:// contact link." : !["phone", "email"].includes(edit.platform) ? "Paste the full http:// or https:// profile, page or channel link." : ""}</small>
      </form>
    </Modal>}
  </div>;
}
