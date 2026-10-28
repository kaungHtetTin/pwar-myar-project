import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Edit,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { request } from '../api';
import { RowActions } from '../components/RowActions';
import { Field, Modal, TableLoadingState } from '../components/common';
import { useConfirmation } from '../components/confirmations';
import { useScreenNotifications } from '../components/notifications';
import { CsvExportButton } from '../components/CsvExportButton';
import { csvFilename, exportFilteredCsv } from '../csvExport';
import { AppBarActions } from '../components/WorkspaceHeader';

const DEFAULT_ACCESS_MODULES = Object.freeze([
  { id: 'sell', label: 'Sell' },
  { id: 'products', label: 'Products' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'sales', label: 'Sales' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'customers', label: 'Customers' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'reports', label: 'Reports' },
]);

function RoleModal({ role, modules, busy, onClose, onSaved }) {
  const [form, setForm] = useState({ name: role?.name || '', permissions: role?.permissions || [] });

  function toggle(permission) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission],
    }));
  }

  function submit(event) {
    event.preventDefault();
    onSaved(form);
  }

  return (
    <Modal open title={role ? 'Edit role' : 'Create role'} onClose={onClose} busy={busy} className="access-form-modal" footer={<><button type="button" onClick={onClose}>Cancel</button><button type="submit" form="access-role-form" className="primary" disabled={busy || !form.name.trim() || !form.permissions.length}>{busy ? 'Saving...' : 'Save role'}</button></>}>
      <form id="access-role-form" className="access-modal-form" onSubmit={submit}>
        <Field label="Role name">
          <input autoFocus required maxLength="100" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Cashier" />
        </Field>
        <fieldset className="access-permission-fieldset">
          <legend>Page access</legend>
          <p>Select the pages this role can open from the navigation drawer.</p>
          <div className="access-permission-grid">
            {modules.map((module) => (
              <label className={form.permissions.includes(module.id) ? 'selected' : ''} key={module.id}>
                <input type="checkbox" checked={form.permissions.includes(module.id)} onChange={() => toggle(module.id)} />
                <span><strong>{module.label}</strong><small>{form.permissions.includes(module.id) ? 'Allowed' : 'Not allowed'}</small></span>
                {form.permissions.includes(module.id) && <Check size={15} />}
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

function StaffModal({ staff, roles, busy, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    access_role_id: staff?.access_role_id ? String(staff.access_role_id) : String(roles[0]?.id || ''),
    is_active: staff?.is_active ?? true,
    password: '',
    password_confirmation: '',
  });

  function submit(event) {
    event.preventDefault();
    onSaved({ ...form, access_role_id: Number(form.access_role_id) });
  }

  return (
    <Modal open title={staff ? 'Edit staff member' : 'Create staff account'} onClose={onClose} busy={busy} className="access-form-modal" footer={<><button type="button" onClick={onClose}>Cancel</button><button type="submit" form="access-staff-form" className="primary" disabled={busy || !form.access_role_id}>{busy ? 'Saving...' : staff ? 'Update staff' : 'Create staff'}</button></>}>
      <form id="access-staff-form" className="access-modal-form" onSubmit={submit}>
        <div className="access-form-grid">
          <Field label="Staff name"><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Email address"><input required type="email" autoComplete="off" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
        </div>
        <Field label="Assigned role">
          <select required value={form.access_role_id} onChange={(event) => setForm({ ...form, access_role_id: event.target.value })}>
            <option value="">Select a role</option>
            {roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
          </select>
        </Field>
        {!staff && <div className="access-form-grid">
          <Field label="Password"><input required minLength="8" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
          <Field label="Confirm password"><input required minLength="8" type="password" autoComplete="new-password" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} /></Field>
        </div>}
        <label className="access-active-toggle"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /><span><strong>Active account</strong><small>Inactive staff cannot sign in and active sessions are blocked.</small></span></label>
      </form>
    </Modal>
  );
}

function PasswordModal({ staff, busy, onClose, onSaved }) {
  const [form, setForm] = useState({ password: '', password_confirmation: '' });

  return (
    <Modal open title={`Reset password for ${staff.name}`} onClose={onClose} busy={busy} className="access-password-modal" size="small" footer={<><button type="button" onClick={onClose}>Cancel</button><button type="submit" form="access-password-form" className="primary" disabled={busy}>{busy ? 'Resetting...' : 'Reset password'}</button></>}>
      <form id="access-password-form" className="access-modal-form" onSubmit={(event) => { event.preventDefault(); onSaved(form); }}>
        <Field label="New password"><input autoFocus required minLength="8" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
        <Field label="Confirm new password"><input required minLength="8" type="password" autoComplete="new-password" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} /></Field>
      </form>
    </Modal>
  );
}

export function AccessManagementScreen() {
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modules, setModules] = useState(DEFAULT_ACCESS_MODULES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [roleModal, setRoleModal] = useState(undefined);
  const [staffModal, setStaffModal] = useState(undefined);
  const [passwordStaff, setPasswordStaff] = useState(null);
  const confirmAction = useConfirmation();
  const { setError, setMessage } = useScreenNotifications();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rolePayload, staffPayload] = await Promise.all([request('/roles'), request('/staff')]);
      setRoles(rolePayload.items || []);
      setModules(Array.isArray(rolePayload.modules) && rolePayload.modules.length
        ? rolePayload.modules
        : DEFAULT_ACCESS_MODULES);
      setStaff(staffPayload.items || []);
    } catch (error) {
      setError(`Cannot load access management. ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => { load(); }, [load]);

  async function saveRole(payload) {
    setBusy(true);
    try {
      await request(roleModal?.id ? `/roles/${roleModal.id}` : '/roles', { method: roleModal?.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setRoleModal(undefined);
      setMessage('Role saved.');
      await load();
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }

  async function deleteRole(role) {
    const result = await confirmAction({ title: 'Delete role', message: `Delete ${role.name}? Roles assigned to staff cannot be deleted.`, confirmLabel: 'Delete role' });
    if (!result.confirmed) return;
    try {
      await request(`/roles/${role.id}`, { method: 'DELETE' });
      setMessage('Role deleted.');
      await load();
    } catch (error) { setError(error.message); }
  }

  async function saveStaff(payload) {
    setBusy(true);
    try {
      await request(staffModal?.id ? `/staff/${staffModal.id}` : '/staff', { method: staffModal?.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setStaffModal(undefined);
      setMessage('Staff account saved.');
      await load();
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }

  async function resetPassword(payload) {
    setBusy(true);
    try {
      await request(`/staff/${passwordStaff.id}/password`, { method: 'PUT', body: JSON.stringify(payload) });
      setPasswordStaff(null);
      setMessage('Staff password reset.');
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }

  async function deleteStaff(item) {
    const result = await confirmAction({ title: 'Delete staff account', message: `Permanently delete ${item.name}'s login account?`, confirmLabel: 'Delete staff' });
    if (!result.confirmed) return;
    try {
      await request(`/staff/${item.id}`, { method: 'DELETE' });
      setMessage('Staff account deleted.');
      await load();
    } catch (error) { setError(error.message); }
  }

  function exportStaff() {
    return exportFilteredCsv({
      path: '/staff',
      filename: csvFilename('staff-accounts'),
      columns: [
        { label: 'Name', value: (row) => row.name }, { label: 'Email', value: (row) => row.email },
        { label: 'Role', value: (row) => row.access_role?.name || 'No role' },
        { label: 'Status', value: (row) => row.is_active ? 'Active' : 'Inactive' },
      ],
    });
  }

  return (
    <section className="screen access-screen mkpos-sheet">
      <AppBarActions>
        <button type="button" className="primary" onClick={() => setRoleModal(null)}><Plus size={15} /> New role</button>
        <button type="button" className="primary" disabled={!roles.length} onClick={() => setStaffModal(null)}><Plus size={15} /> New staff</button>
        <CsvExportButton onExport={exportStaff} onError={setError} onSuccess={setMessage} />
      </AppBarActions>

      <div className="access-layout">
        <section className="access-panel access-role-panel">
          <div className="access-role-table-wrap">
            {loading && <TableLoadingState>Loading roles…</TableLoadingState>}
            <table className="access-table access-role-table">
              <colgroup><col className="access-role-name-column" /><col className="access-permissions-column" /><col className="access-role-staff-column" /><col className="table-action-column" /></colgroup>
              <thead><tr><th>Role</th><th>Permissions</th><th>Staff</th><th>Actions</th></tr></thead>
              <tbody>{roles.map((role) => <tr key={role.id}>
                <td><div className="access-role-heading"><span><ShieldCheck size={15} /></span><div><strong>{role.name}</strong></div></div></td>
                <td><div className="access-role-permissions">{(Array.isArray(role.permissions) ? role.permissions : []).map((permission) => <span key={permission}>{modules.find((item) => item.id === permission)?.label || permission}</span>)}</div></td>
                <td>{role.staff_count}</td>
                <td><RowActions label={role.name}><button title="Edit role" onClick={() => setRoleModal(role)}><Edit size={14} /> Edit role</button><button className="danger-button" title="Delete role" onClick={() => deleteRole(role)}><Trash2 size={14} /> Delete role</button></RowActions></td>
              </tr>)}</tbody>
            </table>
            {!roles.length && !loading && <div className="access-empty"><ShieldCheck size={22} /><strong>No roles yet</strong><span>Create a role before adding staff.</span></div>}
          </div>
        </section>

        <section className="access-panel access-staff-panel">
          <div className="access-table-wrap">{loading && <TableLoadingState>Loading staff accounts…</TableLoadingState>}<table className="access-table"><colgroup><col className="access-staff-column" /><col className="access-role-column" /><col className="access-status-column" /><col className="table-action-column" /></colgroup>
            <thead><tr><th>Staff</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{staff.map((item) => <tr key={item.id}>
              <td><div className="access-person"><span><UserRound size={15} /></span><div><strong>{item.name}</strong><small>{item.email}</small></div></div></td>
              <td><strong>{item.access_role?.name || 'No role'}</strong></td>
              <td><span className={`access-status ${item.is_active ? 'active' : 'inactive'}`}>{item.is_active ? 'Active' : 'Inactive'}</span></td>
              <td><RowActions label={item.name}><button title="Edit staff" onClick={() => setStaffModal(item)}><Edit size={14} /> Edit staff</button><button title="Reset password" onClick={() => setPasswordStaff(item)}><KeyRound size={14} /> Reset password</button><button className="danger-button" title="Delete staff" onClick={() => deleteStaff(item)}><Trash2 size={14} /> Delete staff</button></RowActions></td>
            </tr>)}</tbody>
          </table>{!staff.length && !loading && <div className="access-empty"><Users size={22} /><strong>No staff accounts</strong><span>Create a role, then add your first staff login.</span></div>}</div>
        </section>
      </div>

      {roleModal !== undefined && <RoleModal role={roleModal} modules={modules} busy={busy} onClose={() => setRoleModal(undefined)} onSaved={saveRole} />}
      {staffModal !== undefined && <StaffModal staff={staffModal} roles={roles} busy={busy} onClose={() => setStaffModal(undefined)} onSaved={saveStaff} />}
      {passwordStaff && <PasswordModal staff={passwordStaff} busy={busy} onClose={() => setPasswordStaff(null)} onSaved={resetPassword} />}
    </section>
  );
}
