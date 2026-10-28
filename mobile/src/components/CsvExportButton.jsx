import { IconButton } from './Controls';
import React, { useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';

export function CsvExportButton({ onExport, onNotice, className = '', label = 'Export CSV', compact = false, icon: ExportIcon = Download }) {
  const [exporting, setExporting] = useState(false);
  const working = useRef(false);
  async function run() {
    if (working.current) return;
    working.current = true;
    setExporting(true);
    try {
      const count = await onExport();
      onNotice?.({ type: 'success', text: `Exported ${count} matching record${count === 1 ? '' : 's'}.` });
    } catch (error) {
      if (error?.name !== 'AbortError') onNotice?.({ type: 'error', text: error.message });
    } finally {
      working.current = false;
      setExporting(false);
    }
  }
  return <IconButton variant="ghost" type="button" className={`mobile-export-button app-bar-export${compact ? ' is-compact' : ''} ${className}`.trim()} busy={exporting} onClick={run} aria-label={label} title={label}>{exporting ? <RefreshCw className="spin" size={20} aria-hidden="true" /> : <ExportIcon size={20} aria-hidden="true" />}</IconButton>;
}
