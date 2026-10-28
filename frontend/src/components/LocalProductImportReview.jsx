import React, { useId, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { ImportEndlessFooter } from './ImportEndlessFooter';
import { ProductImportStatus } from './ProductImportStatus';

export function LocalProductImportReview({ review }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(20);
  const groupName = useId();
  const rows = review.rows.filter(row => filter === 'all' || row.status === filter);
  return <section className="product-local-import-review" aria-label="Client-side CSV review">
    <h3>Product status</h3>
    <p role="status"><ProductImportStatus status={review.checking ? 'checking' : review.error || review.invalid ? 'invalid' : 'valid'} label={review.checking ? 'Checking CSV on this device…' : review.error ? 'Client validation failed.' : review.invalid ? 'Client validation found invalid rows.' : 'Client validation passed.'} /></p>
    {!review.checking && <>
      <p role="status" className="product-import-counts"><span>{review.total} rows</span><span className="product-import-valid-count"><CircleCheck size={16} aria-hidden="true" />{review.valid} valid</span><span>{review.invalid} invalid</span><span>{review.skipped} duplicate rows</span></p>
      <p>The file stays on this device until you choose Import. Existing SKU or barcode matches will be skipped.</p>
      {review.error && <p id="product-local-review-error" role="alert">{review.error}</p>}
      {review.invalid > 0 && <p id="product-local-review-error" role="alert">Fix invalid rows in the CSV and select the corrected file before uploading.</p>}
      {review.rows.length > 0 && <>
        <fieldset className="product-import-filters"><legend className="visually-hidden">Review rows</legend>{[['all', 'All', review.total], ['invalid', 'Invalid', review.invalid], ['skipped', 'Duplicate', review.skipped]].map(([value, label, count]) => <label key={value} className={filter === value ? 'is-selected' : ''}>
          <input type="radio" name={groupName} value={value} checked={filter === value} onChange={() => { setFilter(value); setLimit(20); }} /><span>{label}</span><span className="product-import-filter-count">{count}</span>
        </label>)}</fieldset>
        <table><thead><tr><th>Row</th><th>Product</th><th>Cost</th><th>Stock</th><th>Prices</th><th>Status</th><th>Details</th></tr></thead><tbody>{rows.slice(0, limit).map(row => <tr key={row.id}><td>{row.row_number}</td><td>{row.name || 'Missing name'}{(row.sku || row.barcode) && <small className="product-local-review-codes">{row.sku} / {row.barcode}</small>}</td><td>{Number.isFinite(row.cost) ? row.cost : 'Invalid'}</td><td>{Number.isFinite(row.stock) ? row.stock : 'Invalid'}</td><td>{row.prices.map(price => `${price.name}: ${Number.isFinite(price.price) ? price.price : 'Invalid'}`).join(', ') || '0'}</td><td><ProductImportStatus status={row.status} /></td><td>{row.errors.join(' ')}</td></tr>)}</tbody></table>
        {!rows.length && <p>No rows match this filter.</p>}
        <ImportEndlessFooter count={Math.min(limit, rows.length)} total={rows.length} onLoad={() => setLimit(current => current + 20)} />
      </>}
    </>}
  </section>;
}
