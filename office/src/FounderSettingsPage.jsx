import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Save, Trash2, X } from 'lucide-react';
import { api } from './api';
import { OfficePageToolbar } from './OfficePageToolbar';
import { OfficeActionCell, OfficeActionHeader } from './OfficeTable';
import { RowActions } from './RowActions';
import { OfficeModal } from './OfficeModal';
import './founder-settings.css';

const endpoint = '/office/financial-book?per_page=10';
const toDraft = founders => founders.filter(item => item.is_active !== false).map(item => ({ key: `founder-${item.id}`, id: item.id, name: item.name, share: String(item.share_bps / 100) }));
const basisPoints = value => /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) <= 100 ? Math.round(Number(value) * 100) : null;

function FounderModalForm({ founder, onApply, onCancel, disabled }) {
  const [name, setName] = useState(founder.name), [share, setShare] = useState(founder.share);
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    if (disabled) return;
    if (!name.trim() || basisPoints(share) === null) { setError('Enter a name and a share from 0 to 100, with up to two decimal places.'); return; }
    onApply({ ...founder, name: name.trim(), share });
  }
  return <OfficeModal title={founder.isNew ? 'Add founder' : 'Edit founder'} closeLabel="Close founder form" onClose={onCancel} busy={disabled} className="office-founder-modal"><form className="office-founder-modal-form" aria-label={founder.isNew ? 'Add founder' : 'Edit founder'} onSubmit={submit}>
    <fieldset disabled={disabled}>
      <label>Founder name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
      <label>Profit share (%)<input required type="number" min="0" max="100" step="0.01" value={share} onChange={event => setShare(event.target.value)} /></label>
      <div className="office-founder-row-actions"><button type="button" onClick={onCancel}><X size={14} />Cancel editing</button><button type="submit" className="office-button-primary"><Check size={14} />Apply changes</button></div>
    </fieldset>
    {error && <p className="feedback error" role="alert">{error}</p>}
  </form></OfficeModal>;
}

export function FounderSettingsPage({ refreshToken = 0 }) {
  const [data, setData] = useState(null), [draft, setDraft] = useState([]), [baseline, setBaseline] = useState([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [removing, setRemoving] = useState(null);
  const saving = useRef(false);
  const editorOrigin = useRef(null);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      api(endpoint).then(value => {
        if (!current) return;
        const rows = toDraft(value.founders);
        setData(value); setDraft(rows); setBaseline(rows); setNeedsReload(false); setEditor(null); setRemoving(null);
      }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    }, 0);
    return () => { current = false; clearTimeout(timer); };
  }, [refreshToken, revision]);

  const locked = busy || loading || needsReload;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const shares = draft.map(item => basisPoints(item.share));
  const total = shares.reduce((sum, value) => sum + (value ?? 0), 0);
  const complete = draft.length > 0 && shares.every(value => value !== null) && total === 10000;
  const archived = data?.founders.filter(item => item.is_active === false) || [];
  const pendingArchives = baseline.filter(item => !draft.some(row => row.id === item.id)).length;
  function openEditor(value) {
    editorOrigin.current = document.activeElement;
    setEditor(value); setError(''); setNotice('');
  }
  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => { if (editorOrigin.current?.isConnected) editorOrigin.current.focus({ preventScroll: true }); });
  }
  function applyFounder(value) {
    const { isNew, ...founder } = value;
    setDraft(rows => isNew ? [...rows, founder] : rows.map(item => item.key === founder.key ? founder : item));
    closeEditor();
    setError(''); setNotice('');
  }
  async function submit(event) {
    event.preventDefault();
    if (saving.current || locked || editor || !dirty) return;
    if (!complete || draft.some(item => !item.name.trim())) {
      setError('Enter founder names and shares totaling 100%. Use up to two decimal places.'); return;
    }
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await api('/office/financial-book/founders', { method: 'PUT', body: JSON.stringify({ version: data.settings_version,
        founders: draft.map((item, index) => ({ ...(item.id ? { id: item.id } : {}), name: item.name.trim(), share_bps: shares[index] })) }) });
      setNeedsReload(true);
      setNotice('Founder settings saved. New shares apply to future allocations.');
      window.dispatchEvent(new Event('mkpos:office-founders-changed'));
      setRevision(value => value + 1);
    } catch (e) { setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="office-page-stack office-founder-settings">
    <OfficePageToolbar actionLabel="Add founder" busy={locked || !data} actionDisabled={draft.length >= 100 || Boolean(editor) || Boolean(removing)} onCreate={() => {
      openEditor({ key: crypto.randomUUID(), name: '', share: '0', isNew: true });
    }} extraActions={<>
      <button type="button" className="office-button-primary" disabled={locked || !dirty || Boolean(editor) || Boolean(removing)} onClick={submit}><Save size={15} />{busy ? 'Saving...' : 'Save founders'}</button>
    </>} />
    {error && <div className="feedback error" role="alert">{error}<button type="button" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Reload saved settings</button></div>}
    {notice && <p className="office-success" role="status">{notice}</p>}
    {!data && loading && <div className="office-loading" role="status">Loading founder settings...</div>}
    {data && <>
      <section className="office-panel office-table-panel">
        <div className="office-panel-header office-founder-header">
          <div><h2>Active founders</h2><p>{draft.length} founders · {dirty ? 'Unsaved changes' : 'All changes saved'}</p></div>
          <div className="office-founder-total" data-complete={complete}><span>Total profit share</span><strong aria-live="polite">{(total / 100).toFixed(2)}%</strong>{!complete && <small>{total > 10000 ? `Reduce by ${((total - 10000) / 100).toFixed(2)}%` : `${((10000 - total) / 100).toFixed(2)}% remaining`}</small>}</div>
        </div>
        <div className="office-table-scroll"><table className="office-data-table office-founder-table" aria-label="Founder profit shares">
          <thead><tr><th>Founder name</th><th>Profit share (%)</th><th>Status</th><OfficeActionHeader /></tr></thead>
          <tbody>{draft.map(item => <tr key={item.key}>
              <td><strong>{item.name}</strong></td><td className="office-founder-share">{Number(item.share).toFixed(2)}%</td>
              <td><span className={`office-status office-status-${item.id ? 'active' : 'pending'}`}>{item.id ? 'Active' : 'New'}</span></td>
              <OfficeActionCell><RowActions label={`founder ${item.name}`} disabled={locked || Boolean(editor) || Boolean(removing)}>
                <button type="button" onClick={() => openEditor({ ...item })}><Pencil size={14} />Edit founder</button>
                <button type="button" className="danger-button" disabled={draft.length <= 1} onClick={() => setRemoving(item)}><Trash2 size={14} />Remove founder</button>
              </RowActions></OfficeActionCell>
            </tr>)}
          {!draft.length && !editor && <tr><td colSpan={4}>No active founders. Add a founder to set profit shares.</td></tr>}
          </tbody>
        </table></div>
        <footer className="office-founder-footer">
          <div className="office-founder-save-note"><span>Shares must total 100%. Apply changes, then save.</span>{pendingArchives > 0 && <span role="status">{pendingArchives} founder{pendingArchives === 1 ? '' : 's'} will be archived when you save.</span>}</div>
        </footer>
      </section>
      {archived.length > 0 && <section className="office-panel office-table-panel"><div className="office-panel-header"><h2>Archived founders</h2></div><div className="office-table-scroll"><table className="office-data-table" aria-label="Archived founders"><thead><tr><th>Founder name</th><th>Status</th></tr></thead><tbody>{archived.map(item => <tr key={item.id}><td>{item.name}</td><td><span className="office-status office-status-hidden">Archived</span></td></tr>)}</tbody></table></div></section>}
    </>}
    {editor && <FounderModalForm key={editor.key} founder={editor} disabled={locked} onApply={applyFounder} onCancel={closeEditor} />}
    {removing && <OfficeModal title="Remove founder" closeLabel="Close removal confirmation" onClose={() => setRemoving(null)} busy={locked} className="office-founder-modal" footer={<><button type="button" disabled={locked} onClick={() => setRemoving(null)}>Keep founder</button><button type="button" className="danger-button" disabled={locked} onClick={() => { setDraft(rows => rows.filter(row => row.key !== removing.key)); setRemoving(null); setError(''); setNotice(''); }}>Remove founder</button></>}><p>Remove <strong>{removing.name}</strong>? The founder will be archived when you save. Financial history stays recorded.</p></OfficeModal>}
  </div>;
}
