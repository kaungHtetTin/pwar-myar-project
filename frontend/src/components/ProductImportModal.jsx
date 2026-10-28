import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { request } from '../api';
import { useProductImport } from '../useProductImport';
import { Modal } from './common';
import { LocalProductImportReview } from './LocalProductImportReview';
import { ImportEndlessFooter } from './ImportEndlessFooter';
import { ProductImportStatus } from './ProductImportStatus';

export function ProductImportModal({ file, onClose, onChanged }) {
  const flow = useProductImport({ initialFile: file, onChanged });
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const listGeneration = useRef(0);
  const listLoading = useRef(false);
  const summary = flow.summary;
  const selectedFilename = flow.review?.filename || summary?.filename;
  const fileSize = flow.review?.file?.size;
  const fileSizeLabel = fileSize == null ? '' : fileSize < 1024 ? `${fileSize} B` : `${(fileSize / 1024).toFixed(1)} KB`;
  const issueCount = (summary?.invalid || 0) + (summary?.failed || 0);
  // Successful imports need only counts. Fetch individual rows only to explain
  // issues, never as another review/confirmation step.
  const listPath = flow.busy || flow.review ? null : summary
    ? issueCount > 0 ? `/product-imports/${summary.id}/rows?issues_only=true&` : null
    : '/product-imports?';

  useEffect(() => {
    const generation = ++listGeneration.current;
    listLoading.current = false;
    setEntries([]); setTotal(0); setLoading(false); setListError('');
    if (!listPath) return undefined;
    const controller = new AbortController();
    listLoading.current = true;
    setLoading(true);
    request(`${listPath}with_total=true&limit=20&offset=0`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setEntries(result.items); setTotal(result.total);
    }).catch(error => { if (!controller.signal.aborted) setListError(error.message); })
      .finally(() => { if (!controller.signal.aborted && generation === listGeneration.current) { listLoading.current = false; setLoading(false); } });
    return () => { controller.abort(); listGeneration.current += 1; };
  }, [listPath]);

  async function loadMore() {
    if (!listPath || loading || listLoading.current) return;
    listLoading.current = true;
    const generation = listGeneration.current;
    setLoading(true); setListError('');
    try {
      const result = await request(`${listPath}with_total=true&limit=20&offset=${entries.length}`);
      if (generation !== listGeneration.current) return;
      setEntries(current => [...current, ...result.items]); setTotal(result.total);
    } catch (error) { if (generation === listGeneration.current) setListError(error.message); }
    finally { if (generation === listGeneration.current) { listLoading.current = false; setLoading(false); } }
  }

  return <Modal open title="Import products" onClose={onClose} busy={flow.busy} size="large" footer={<>
    <button type="button" disabled={flow.busy} onClick={onClose}>Close</button>
    {(summary || flow.review) && !flow.busy && <button type="button" onClick={flow.reset}>Saved imports</button>}
    {flow.review && <button type="button" className="primary" disabled={flow.busy || !flow.review.canUpload} onClick={flow.importReviewed}>Import</button>}
    {flow.busy && summary && <button type="button" onClick={flow.pause}>Pause import</button>}
    {summary && !flow.busy && summary.status !== 'completed' && summary.invalid === 0 && <button type="button" className="primary" onClick={flow.run}>{summary.status === 'preview' ? `Import ${summary.ready} ${summary.ready === 1 ? 'product' : 'products'}` : 'Resume import'}</button>}
  </>}>
    <div className="product-bulk-import">
      {selectedFilename && <div className="product-import-file-summary"><FileSpreadsheet size={23} aria-hidden="true" /><span><strong>{selectedFilename}</strong><small>{[fileSizeLabel, 'CSV file'].filter(Boolean).join(' · ')}</small></span></div>}
      <p>{flow.review ? 'Review your products, then choose Import. Existing SKU or barcode matches are skipped. Names alone are never used to match products.' : !summary ? 'Open a saved import to see its progress or resume importing.' : 'Existing SKU or barcode matches are skipped. Names alone are never used to match products.'}</p>
      <p id="product-import-help">Up to 5,000 products / 5 MB per file. The same file resumes saved progress. Deleted products can be imported again.</p>
      {flow.error && <p id="product-import-error" role="alert" className="error-message">{flow.error}{summary && !summary.invalid ? ' Your saved progress is kept.' : ''}</p>}
      {flow.message && <p role="status">{flow.message}</p>}
      {flow.busy && !flow.review?.checking && <p role="status">{summary ? 'Importing products…' : flow.review ? 'Uploading products…' : 'Loading import…'}</p>}
      {flow.review ? <LocalProductImportReview key={flow.review.id} review={flow.review} /> : summary ? <>
        <h3>{summary.status === 'completed' ? 'Import results' : 'Import progress'}</h3>
        <p role="status" className="product-import-counts"><span>{summary.total_rows} rows</span><ProductImportStatus status="imported" label={`${summary.imported} imported`} /><span>{summary.skipped} skipped · {summary.failed} failed</span></p>
        <progress aria-label="Import progress" max={summary.total_rows} value={summary.imported + summary.skipped + summary.failed} />
        {summary.invalid > 0 && <p role="alert">{summary.invalid} {summary.invalid === 1 ? 'row could' : 'rows could'} not be imported. Correct the CSV and select the corrected file.</p>}
        {summary.status === 'completed' && <p role="status"><ProductImportStatus status={summary.failed ? 'failed' : 'completed'} label={summary.failed ? 'Import finished with errors.' : 'Import complete.'} /></p>}
        {!flow.busy && issueCount > 0 && <section aria-label="Import issues"><h4>Issues to fix</h4><ul>{entries.map(row => <li key={row.id}><strong>Row {row.row_number}{row.name ? ` (${row.name})` : ''}:</strong> {row.errors.join(' ') || 'This product could not be imported.'}</li>)}</ul></section>}
      </> : <><h3>Saved imports</h3>{entries.map(item => <button type="button" disabled={flow.busy} key={item.id} onClick={() => flow.open(item.id)}>{item.filename} · {item.status} · {item.total_rows} rows</button>)}{!loading && !entries.length && !listError && <p>No saved imports.</p>}</>}
      {listPath && <ImportEndlessFooter count={entries.length} total={total} loading={loading} error={listError} onLoad={loadMore} noun={summary ? 'issues' : 'imports'} />}
    </div>
  </Modal>;
}
