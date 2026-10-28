import {OfficeTableLoading, OfficeActionHeader, OfficeActionCell, OfficeTablePagination} from './OfficeTable';
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, Pencil, Trash2, Video } from 'lucide-react';
import { RetainedViews } from './RetainedViews';
import { usePageNavigation } from './usePageNavigation';
import { OfficePageToolbar, OfficeStatusFilterDrawer } from './OfficePageToolbar';
import { useRetainedActivity } from './retainedActivity';
import { RowActions } from './RowActions';
import { api, apiBlob } from './api';

function Thumbnail({ tutorial, file }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    let objectUrl;
    const blob = file ? Promise.resolve(file) : apiBlob(`/office/tutorials/${tutorial.id}/thumbnail`);
    blob.then(value => {
      if (!current) return;
      objectUrl = URL.createObjectURL(value);
      setSource(objectUrl);
    }).catch(() => { if (current) setError('Thumbnail preview unavailable.'); });
    return () => { current = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file, tutorial?.id]);
  return source ? <img className="office-tutorial-preview" src={source} alt="Tutorial thumbnail preview" /> : <small>{error || 'Loading thumbnail…'}</small>;
}

function TutorialEditor({ tutorial, onClose, onSaved }) {
  const [form, setForm] = useState(tutorial || { title: '', description: '', youtube_url: '', is_published: false, sort_order: 0 });
  const [file, setFile] = useState(null);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    if (busy) return;
    setBusy(true); setError('');
    const data = new FormData();
    ['title', 'description', 'youtube_url', 'sort_order'].forEach(key => data.append(key, String(form[key])));
    data.append('is_published', form.is_published ? '1' : '0');
    data.append('remove_thumbnail', remove ? '1' : '0');
    if (file) data.append('thumbnail', file);
    if (tutorial) data.append('_method', 'PUT');
    try {
      await api(`/office/tutorials${tutorial ? `/${tutorial.id}` : ''}`, { method: 'POST', body: data });
      if (!tutorial) setForm({ title: '', description: '', youtube_url: '', is_published: false, sort_order: 0 });
      setFile(null); setRemove(false);
      submittedForm?.querySelectorAll('input[type="file"]').forEach(input => { input.value = ''; });
      setBusy(false);
      onSaved(form.is_published ? 'Tutorial published on the portfolio.' : 'Tutorial saved as a draft.');
    } catch (err) { setError(err.message); setBusy(false); }
  }
  function selectFile(event) {
    const selected = event.target.files?.[0];
    setError('');
    if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 2 * 1024 * 1024)) {
      setError('Choose a JPG, PNG or WebP image up to 2 MB.');
      event.target.value = ''; setFile(null); return;
    }
    setFile(selected || null);
  }
  return <section className="office-panel office-tutorial-manager">
    <div className="office-tutorial-heading"><h2>{tutorial ? 'Edit tutorial' : 'Add tutorial'}</h2><button onClick={onClose} disabled={busy}><ArrowLeft size={16} /> Back to tutorials</button></div>
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="office-tutorial-fields">
        <label>Title<input required maxLength={200} value={form.title} onChange={e => change('title', e.target.value)} /></label>
        <label>YouTube link<input required type="url" maxLength={1000} placeholder="https://www.youtube.com/watch?v=…" value={form.youtube_url} onChange={e => change('youtube_url', e.target.value)} /><small>Use a video, Shorts or live-video link, not a channel or playlist link.</small></label>
        <label>Description<textarea required maxLength={5000} rows={5} value={form.description} onChange={e => change('description', e.target.value)} /><small>Explain what users will learn. Plain text, up to 5,000 characters.</small></label>
        <div className="office-tutorial-form-grid">
          <label>Thumbnail (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} /><small>JPG, PNG or WebP · up to 2 MB · recommended 16:9. Leave empty to use YouTube’s thumbnail.</small></label>
          <label>Display order<input required type="number" min={0} max={999999} step={1} value={form.sort_order} onChange={e => change('sort_order', e.target.value)} /><small>Lower numbers appear first. Newest appears first when equal.</small></label>
        </div>
        {tutorial?.has_thumbnail && <label className="office-tutorial-check"><input type="checkbox" checked={remove} onChange={e => setRemove(e.target.checked)} /> Remove saved thumbnail and use YouTube’s image</label>}
        {(file || (tutorial?.has_thumbnail && !remove)) && <Thumbnail key={file ? `${file.name}-${file.lastModified}` : tutorial.id} file={file} tutorial={tutorial} />}
        <label className="office-tutorial-check"><input type="checkbox" checked={form.is_published} onChange={e => change('is_published', e.target.checked)} /> Published — show on the public portfolio</label>
        <small>Uncheck to keep a draft or hide this tutorial. A custom upload replaces any saved thumbnail.</small>
      </fieldset>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <div className="office-tutorial-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="office-button-primary" disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save tutorial'}</button></div>
    </form>
  </section>;
}

export function TutorialsPage({ refreshToken = 0, filterOpen: controlledFilterOpen, onFilterOpen, onFilterClose }) {
  const [localFilterOpen, setLocalFilterOpen] = useState(false);
  const filterOpen = controlledFilterOpen ?? localFilterOpen;
  const closeFilters = onFilterClose || (() => setLocalFilterOpen(false));
  const active = useRetainedActivity();
  const [query, setQuery] = useState({ page: 1, per_page: 25, q: '', status: 'all' });
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ key: '', data: null, error: '' });
  const [editorRecords, setEditorRecords] = useState(() => new Map());
  const navigation = usePageNavigation('office-tutorials', { kind: 'list' }, () => location.href, { resumeHistory: false });
  const editor = navigation.view.kind === 'editor' ? navigation.view : null;
  const openEditor = (tutorial) => {
    const key = crypto.randomUUID();
    setEditorRecords((current) => new Map(current).set(key, tutorial));
    navigation.go({ kind: 'editor', id: tutorial?.id || null, key });
  };
  const closeEditor = () => navigation.back({ kind: 'list' });
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const queryKey = new URLSearchParams(query).toString();
  const requestKey = `${queryKey}&refresh=${refresh}&app_refresh=${refreshToken}`;
  const data = result.queryKey === queryKey ? result.data : null;
  const loading = !data && result.key !== requestKey;
  useEffect(() => {
    let current = true;
    api(`/office/tutorials?${requestKey}`).then(data => { if (current) setResult({ key: requestKey, queryKey, data, error: '' }); })
      .catch(err => { if (current) setResult(previous => ({ key: requestKey, queryKey, data: previous.queryKey === queryKey ? previous.data : null, error: err.message })); });
    return () => { current = false; };
  }, [requestKey, queryKey]);
  async function remove(tutorial) {
    if (busy !== null || !window.confirm(`Delete “${tutorial.title}”? This permanently removes the tutorial and its custom thumbnail from PwarMyar. The YouTube video is not deleted.`)) return;
    setBusy(tutorial.id); setError(''); setMessage('');
    try {
      await api(`/office/tutorials/${tutorial.id}`, { method: 'DELETE' });
      setMessage('Tutorial deleted.'); setRefresh(n => n + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }
  const renderContent = () => {
  if (editor) return <TutorialEditor tutorial={editorRecords.get(editor.key)} onClose={closeEditor} onSaved={text => { closeEditor(); setMessage(text); setError(''); setRefresh(n => n + 1); }} />;
  return <section className="office-panel office-tutorial-manager">
    <div className="office-tutorial-heading"><div><h2><Video size={20} /> Video tutorials</h2><p>Published tutorials appear on the portfolio. Drafts are visible only in Office.</p></div></div>
    {message && <p className="feedback" role="status">{message}</p>}
    {(error || (!loading && result.error)) && <p className="feedback error" role="alert">{error || result.error}</p>}
    {loading ? <OfficeTableLoading columns={["Tutorial", "Status", "Order"]} label="Loading tutorials..."/> : data && <>
      <p>{data.total} tutorial{data.total === 1 ? '' : 's'}</p>
      {data.items.length ? <div className="office-table-scroll"><table className="office-data-table office-tutorial-table"><thead><tr><th>Tutorial</th><th>Status</th><th>Order</th><OfficeActionHeader /></tr></thead><tbody>{data.items.map(tutorial => <tr key={tutorial.id}>
        <td><strong>{tutorial.title}</strong><small className="office-tutorial-description">{tutorial.description}</small><a href={tutorial.youtube_url} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a><small className="office-business-meta">{tutorial.has_thumbnail ? 'Custom thumbnail' : 'YouTube thumbnail'}</small></td>
        <td><span className={`office-status office-status-${tutorial.is_published ? 'active' : 'hidden'}`}>{tutorial.is_published ? 'Published' : 'Draft'}</span></td><td>{tutorial.sort_order}</td>
        <OfficeActionCell><RowActions label={tutorial.title} disabled={busy !== null}><button type="button" onClick={() => openEditor(tutorial)}><Pencil size={16} /> Edit</button><button type="button" className="danger-button" onClick={() => remove(tutorial)}><Trash2 size={16} /> Delete</button></RowActions></OfficeActionCell>
      </tr>)}</tbody></table></div> : <p>No tutorials found. Add your first video or change the search.</p>}
      <OfficeTablePagination label="Tutorial" total={data.total} page={data.page} perPage={query.per_page} lastPage={data.last_page} disabled={busy !== null} onPageChange={page => setQuery(current => ({ ...current, page }))} onPerPageChange={per_page => setQuery(current => ({ ...current, per_page, page: 1 }))} />
    </>}
  </section>;
  };
  return <>
    <OfficePageToolbar visible={!editor} searchLabel="Search tutorials" placeholder="Search tutorial title" search={search} onSearchChange={setSearch}
      onSearch={() => setQuery(current => ({ ...current, q: search.trim(), page: 1 }))}
      onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }}
      actionLabel="Add tutorial" onCreate={() => openEditor(null)} busy={busy !== null} filterOpen={filterOpen} filterCount={query.status === 'all' ? 0 : 1}
      onFilterOpen={onFilterOpen || (() => setLocalFilterOpen(true))} />
    <OfficeStatusFilterDrawer open={filterOpen && active && !editor} title="Tutorial filters" status={query.status}
      options={[["all", "All statuses"], ["published", "Published"], ["draft", "Draft"]]} busy={busy !== null} onClose={closeFilters}
      onApply={status => { setQuery(current => ({ ...current, status, page: 1 })); closeFilters(); }}
      onClear={() => { setQuery(current => ({ ...current, status: 'all', page: 1 })); closeFilters(); }} />
    <RetainedViews activeKey={editor?.key || 'list'}>{renderContent()}</RetainedViews>
  </>;
}
