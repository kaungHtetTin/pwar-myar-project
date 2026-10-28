import React from 'react';

export function PaymentReceiptCheck({ validation, compact = false }) {
  const report = validation?.report;
  const completed = validation?.status === 'completed' && report;
  const label = completed ? ({ looks_consistent: 'Receipt checks passed', mismatch: 'Receipt mismatch', needs_review: 'Needs review', rejected_duplicate: 'Duplicate payment rejected' }[report.verdict] || 'Needs review')
    : ({ queued: 'Check queued', processing: 'Checking receipt', blocked: 'Check unavailable', failed: 'Check failed' }[validation?.status] || 'Not checked');

  if (compact) return <small>AI: {label}</small>;

  return <section className="office-sales-ai-validation" aria-label="AI receipt check">
    <strong>AI receipt check: {label}</strong>
    <p>Verify the actual funds before approving this payment.</p>
    {completed && <>
      <dl>{(report.checks || []).map((check, index) => <React.Fragment key={`${check.field}-${index}`}>
        <dt>{check.field.replaceAll('_', ' ')}</dt><dd>{check.status.replaceAll('_', ' ')}</dd>
      </React.Fragment>)}</dl>
      {report.observed?.notes && <p>{report.observed.notes}</p>}
    </>}
  </section>;
}
