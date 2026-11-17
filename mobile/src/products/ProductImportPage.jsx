import React, { useCallback, useContext, useLayoutEffect, useRef } from 'react';
import { Button, Input } from '../components/Controls';
import { apiRequest } from '../api/client';
import { useEndlessList } from '../hooks/useEndlessList';
import { PageActivityContext, usePageRefresh } from '../navigation/pageRefresh';
import { publishDataChange } from '../navigation/dataChanges';
import { ProductReferenceHeader } from './ProductReferenceParts';
import { useProductImport } from './useProductImport';
import { LocalProductImportReview } from './LocalProductImportReview';
import { ProductImportRowHeading } from './ProductImportRowHeading';

function More({ list, noun = 'rows' }) {
  return <div className="endless-list-footer" ref={list.sentinelRef}>
    {(list.initialLoading || list.loadingMore) && <p role="status">Loading…</p>}
    {list.error && <div role="alert"><p>{list.error}</p><Button variant="secondary" type="button" onClick={list.retry}>Retry loading</Button></div>}
    {list.hasMore && !list.initialLoading && !list.loadingMore && !list.error && !list.observerSupported && <Button variant="secondary" type="button" onClick={list.loadMore}>Load more</Button>}
    {!list.hasMore && !list.initialLoading && list.items.length > 0 && <p>{noun === 'rows' ? 'All rows loaded.' : 'All imports loaded.'}</p>}
  </div>;
}

export function ProductImportPage({ onBack, initialId }) {
  const active = useContext(PageActivityContext);
  const flow = useProductImport({ initialId, active, onChanged: () => publishDataChange('/products', 'POST') });
  const summary = flow.summary;
  const actionsRef = useRef(null);
  const hasActions = Boolean(flow.review || summary);
  useLayoutEffect(() => {
    const actions = actionsRef.current;
    if (!actions) return undefined;
    const page = actions.closest('.product-import-page');
    const measure = () => {
      const height = actions.getBoundingClientRect().height;
      if (height > 0) page.style.setProperty('--product-import-actions-height', `${height}px`);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(actions);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); page.style.removeProperty('--product-import-actions-height'); };
  }, [hasActions]);
  const loadHistory = useCallback(({ limit, offset, signal }) => apiRequest(`/product-imports?with_total=true&limit=${limit}&offset=${offset}`, { signal }), []);
  const history = useEndlessList({ loadPage: loadHistory, queryKey: 'product-imports', enabled: !summary && !flow.review && !flow.busy });
  const loadRows = useCallback(({ limit, offset, signal }) => apiRequest(`/product-imports/${summary?.id}/rows?with_total=true&limit=${limit}&offset=${offset}`, { signal }), [summary?.id]);
  const rows = useEndlessList({ loadPage: loadRows,
    queryKey: `${summary?.id}:${summary?.imported}:${summary?.failed}:${summary?.skipped}`, enabled: Boolean(summary) && !flow.busy });
  usePageRefresh(() => {
    if (flow.busy) return Promise.resolve();
    if (summary) return flow.open(summary.id);
    return history.reload();
  }, { dataPath: '/products/import' });

  return <main className={`sale-retail-page product-reference-page product-import-page${hasActions ? ' has-import-actions' : ''}`}>
    <ProductReferenceHeader title="Import products" onBack={() => { flow.pause(); onBack(); }} />
    <div className="product-import-review">
      <section className="product-import-section">
        <h2>Choose CSV</h2>
        <p>Choose a CSV to validate and review on this device before uploading. Existing SKU or barcode matches are checked on the server. Names alone are never used to match products.</p>
        <label htmlFor="product-import-file">Product CSV file</label>
        <Input id="product-import-file" type="file" accept=".csv,text/csv" disabled={flow.busy} aria-invalid={Boolean(flow.review?.error || flow.review?.invalid || (!summary && flow.error))} aria-describedby={`product-import-file-help${flow.error ? ' product-import-error' : ''}${flow.review?.error || flow.review?.invalid ? ' product-local-review-error' : ''}`} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) flow.checkFile(file); }} />
        <small id="product-import-file-help">UTF-8 CSV · Up to 5,000 products / 5 MB. The same file reopens its saved import.</small>
      </section>
      {flow.error && <div id="product-import-error" className="mobile-notice mobile-notice--error" role="alert">{flow.error} Your saved progress is kept.</div>}
      {flow.message && <p role="status">{flow.message}</p>}
      {flow.busy && !flow.review?.checking && <p role="status">{summary ? 'Importing products…' : flow.review ? 'Uploading for server validation…' : 'Loading import…'}</p>}
      {flow.review ? <LocalProductImportReview key={flow.review.id} review={flow.review} /> : summary ? <>
        <section className="product-import-section">
          <h2 data-no-localize>{summary.filename}</h2>
          <div className="product-import-summary" role="status">{[['Total rows', summary.total_rows], ['Ready', summary.ready], ['Imported', summary.imported], ['Skipped', summary.skipped], ['Invalid', summary.invalid], ['Failed', summary.failed]].map(([label, count]) => <span key={label}><strong>{count}</strong>{label}</span>)}</div>
          <progress aria-label="Import progress" max={summary.total_rows} value={summary.imported + summary.skipped + summary.failed} />
          {summary.invalid > 0 && <p role="alert">Correct invalid rows in your CSV and upload the corrected file before importing.</p>}
          {summary.status === 'completed' && <p role="status">Import complete.</p>}
        </section>
        {!flow.busy && <section className="product-import-section"><h2>Rows</h2><div className="product-import-rows">{rows.items.map(row => <article className="product-import-result" key={row.id}>
          <ProductImportRowHeading row={row} />{row.errors.map((message, index) => <small className={['invalid', 'failed'].includes(row.status) ? 'product-import-row-error' : undefined} key={index}>{message}</small>)}
        </article>)}</div><More list={rows} /></section>}
      </> : <section className="product-import-section"><h2>Saved imports</h2>{history.items.map(item => <Button variant="secondary" type="button" key={item.id} disabled={flow.busy} onClick={() => flow.open(item.id)}><span data-no-localize>{item.filename}</span><small>{item.status} · {item.total_rows} rows</small></Button>)}{!history.initialLoading && !history.error && !history.items.length && <p>No saved imports.</p>}<More list={history} noun="imports" /></section>}
    </div>
    {hasActions && <div ref={actionsRef} className="product-reference-actions product-import-actions" role="group" aria-label="Import actions">
      {flow.review ? <>
        <Button variant="secondary" disabled={flow.busy} onClick={flow.reset}>Change file</Button>
        <Button variant="primary" disabled={flow.busy || !flow.review.canUpload} busy={flow.busy} onClick={flow.uploadReviewed}>Upload CSV</Button>
      </> : flow.busy ? <Button variant="secondary" onClick={flow.pause}>Pause import</Button> : <>
        <Button variant="secondary" onClick={flow.reset}>Change file</Button>
        {summary.status === 'completed' ? <Button variant="primary" onClick={onBack}>Done</Button>
          : <Button variant="primary" disabled={summary.invalid > 0} onClick={flow.run}>{summary.status === 'preview' ? `Import ${summary.ready} ${summary.ready === 1 ? 'product' : 'products'}` : 'Resume import'}</Button>}
      </>}
    </div>}
  </main>;
}
