import React from 'react';
import { CircleCheck, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react';

export function ProductImportStatus({ status, label }) {
  const valid = ['valid', 'ready', 'imported', 'completed'].includes(status);
  const invalid = ['invalid', 'failed'].includes(status);
  const Icon = status === 'checking' ? LoaderCircle : valid ? CircleCheck : invalid ? CircleX : TriangleAlert;
  const text = label || ({ valid: 'Valid', ready: 'Ready', imported: 'Imported', completed: 'Completed', invalid: 'Invalid', failed: 'Failed', skipped: 'Duplicate', checking: 'Checking' }[status] || status);
  return <span className={`product-import-status ${valid ? 'is-valid' : invalid ? 'is-invalid' : status === 'checking' ? 'is-checking' : 'is-duplicate'}`}>
    <Icon size={16} aria-hidden="true" className={status === 'checking' ? 'spin' : undefined} /><span>{text}</span>
  </span>;
}
