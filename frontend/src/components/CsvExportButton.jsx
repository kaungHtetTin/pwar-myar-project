import React, { useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';

export function CsvExportButton({ onExport, onError, onSuccess, className = '', label = 'Export CSV' }) {
  const [exporting, setExporting] = useState(false);

  async function run() {
    if (exporting) return;
    setExporting(true);
    try {
      const count = await onExport();
      onSuccess?.(`Exported ${count} matching record${count === 1 ? '' : 's'}.`);
    } catch (error) {
      onError?.(error.message);
    } finally {
      setExporting(false);
    }
  }

  return <button type="button" className={`csv-export-button ${className}`.trim()} disabled={exporting} onClick={run}>{exporting ? <LoaderCircle className="spin" size={16} /> : <Download size={16} />}{exporting ? 'Exporting…' : label}</button>;
}
