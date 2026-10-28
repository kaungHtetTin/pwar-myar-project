import React from 'react';
import { CircleCheck } from 'lucide-react';

export function ProductImportRowHeading({ row }) {
  const valid = ['valid', 'ready', 'imported'].includes(row.status);
  return <div className="product-import-row-heading">
    <span className={`product-import-row-status${valid ? ' is-valid' : ''}`}>
      {valid && <CircleCheck size={16} aria-hidden="true" />}
      <span>Row {row.row_number} · {row.status}</span>
    </span>
    <strong className="product-import-row-name" data-no-localize>{row.name || 'Missing name'}</strong>
  </div>;
}
