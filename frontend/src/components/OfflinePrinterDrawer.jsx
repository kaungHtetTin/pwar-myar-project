import React, { useEffect, useState } from 'react';
import { Modal } from './common';
import { PrinterSettings } from './PrinterSettings';
import { deviceLayout, simplePrinterConfig } from '../printerSettings';

export function OfflinePrinterDrawer({ settings, onClose }) {
  const [config, setConfig] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const bridge = window.mkposDesktop;
  useEffect(() => {
    let active = true;
    Promise.all([bridge.getPrinterConfig(), bridge.getPrinters()]).then(([local, names]) => {
      if (!active) return;
      setConfig({ ...local, receiptLayout: { ...deviceLayout(settings), ...local.receiptLayout, paper_size: local.receiptLayout?.paper_size || settings.receipt_paper_size || '80mm' } });
      setPrinters(names);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [bridge, settings]);
  async function save() {
    setSaving(true);
    try { setConfig(await bridge.savePrinterConfig(simplePrinterConfig(config))); }
    finally { setSaving(false); }
  }
  return <Modal open title="Printer settings" onClose={onClose} busy={saving} className="offline-printer-drawer">
    <div className="settings-screen offline-printer-settings"><div className="settings-form settings-printer-form">
      {error ? <div role="alert" className="printer-settings-error">{error}</div> : config ? <PrinterSettings
        config={config} onChange={setConfig} printers={printers}
        onRefresh={async () => setPrinters(await bridge.getPrinters())}
        paper={config.receiptLayout.paper_size}
        onPaperChange={paper_size => setConfig(current => ({ ...current, receiptLayout: { ...current.receiptLayout, paper_size } }))}
        onSave={save} busy={saving}
      /> : <div role="status">Loading device printer settings...</div>}
    </div></div>
  </Modal>;
}
