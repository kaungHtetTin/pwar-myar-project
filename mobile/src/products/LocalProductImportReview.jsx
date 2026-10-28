import React, { useCallback, useState } from 'react';
import { Button, Select } from '../components/Controls';
import { useEndlessList } from '../hooks/useEndlessList';
import { ProductImportRowHeading } from './ProductImportRowHeading';

export function LocalProductImportReview({ review }) {
  const [filter, setFilter] = useState('all');
  const loadPage = useCallback(({ limit, offset }) => {
    const rows = review.rows.filter(row => filter === 'all' || row.status === filter);
    return Promise.resolve({ items: rows.slice(offset, offset + limit), total: rows.length });
  }, [filter, review.rows]);
  const list = useEndlessList({ loadPage, queryKey: `${review.id}:${filter}`, enabled: !review.checking });
  return <section className="product-import-section" aria-label="Client-side CSV review">
    <h2 data-no-localize>{review.filename}</h2>
    <p role="status">{review.checking ? 'Checking CSV on this device…' : review.error ? 'Client validation failed.' : review.invalid ? 'Client validation found invalid rows.' : 'Client validation passed.'}</p>
    {!review.checking && <>
      <div className="product-import-summary" role="status">{[['Total rows', review.total], ['Valid', review.valid], ['Invalid', review.invalid], ['Duplicate rows', review.skipped]].map(([label, count]) => <span key={label}><strong>{count}</strong>{label}</span>)}</div>
      <p>The file stays on this device until you choose Upload CSV. Existing products and business rules are checked on the server afterward.</p>
      {review.error && <p id="product-local-review-error" role="alert">{review.error}</p>}
      {review.invalid > 0 && <p id="product-local-review-error" role="alert">Fix invalid rows in the CSV and select the corrected file before uploading.</p>}
      {review.rows.length > 0 && <>
        <label htmlFor="local-import-filter">Review rows</label><Select id="local-import-filter" aria-label="Client review filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All rows</option><option value="invalid">Invalid rows</option><option value="skipped">Duplicate rows</option></Select>
        <div className="product-import-rows">{list.items.map(row => <article className="product-import-result" key={row.id}>
          <ProductImportRowHeading row={row} />
          {(row.sku || row.barcode) && <small data-no-localize>{row.sku} / {row.barcode}</small>}
          <div className="product-import-row-details"><small>Cost: {Number.isFinite(row.cost) ? row.cost : 'Invalid'} · Stock: {Number.isFinite(row.stock) ? row.stock : 'Invalid'}</small><small data-no-localize>{row.prices.map(price => `${price.name}: ${Number.isFinite(price.price) ? price.price : 'Invalid'}`).join(', ') || '0'}</small></div>
          {row.errors.map((message, index) => <small className={row.status === 'invalid' ? 'product-import-row-error' : undefined} key={index}>{message}</small>)}
        </article>)}</div>
        <div className="endless-list-footer" ref={list.sentinelRef}>
          {(list.initialLoading || list.loadingMore) && <p role="status">Loading preview rows…</p>}
          {list.hasMore && !list.initialLoading && !list.loadingMore && !list.observerSupported && <Button variant="secondary" type="button" onClick={list.loadMore}>Load more preview rows</Button>}
          {!list.hasMore && list.items.length > 0 && <p>All rows loaded.</p>}
          {!list.initialLoading && list.total === 0 && <p>No rows match this filter.</p>}
        </div>
      </>}
    </>}
  </section>;
}
