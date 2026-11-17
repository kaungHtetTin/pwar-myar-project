import React, { useEffect, useRef, useState } from 'react';
import { Save, PlugZap } from 'lucide-react';
import { Field } from './common';
import { PrinterInput } from './PrinterInput';
import { simplePrinterConfig } from '../printerSettings';

export function PrinterSettings({ config, onChange, printers, onRefresh, paper, onPaperChange, onSave, busy }) {
  const [ports, setPorts] = useState([]);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const latest = useRef({ config, onChange });
  const discovery = useRef({ generation: 0 });
  latest.current = { config, onChange };
  async function refreshBluetooth() {
    const request = ++discovery.current.generation;
    const result = await window.mkposDesktop.listSerialPorts();
    if (request !== discovery.current.generation || latest.current.config.connection !== 'bluetooth') return;
    const items = result.items || [];
    setPorts(items);
    const candidates = items.filter(p => p.bluetooth && p.printerName && /^COM[1-9][0-9]{0,3}$/.test(p.port));
    const current = latest.current.config;
    if (!current.bluetooth.port && candidates.length === 1) {
      latest.current.onChange({ ...current, bluetooth: { ...current.bluetooth, port: candidates[0].port } });
      return { message: `Selected ${candidates[0].printerName} automatically (${candidates[0].port}). Save to remember this printer.` };
    }
    return { message: current.bluetooth.port ? `Selected port: ${current.bluetooth.port}.`
      : candidates.length > 1 ? 'Several Bluetooth printers found. Choose your printer below.'
      : !items.length ? 'No COM ports found. Pair a Bluetooth Classic SPP printer and enable its outgoing serial port in Windows.'
      : 'No printer port could be identified automatically. Select the outgoing COM port under Manual port selection.' };
  }
  useEffect(() => {
    const requests = discovery.current;
    if (config.connection === 'bluetooth' && window.mkposDesktop?.listSerialPorts) action(refreshBluetooth);
    return () => { requests.generation++; };
  }, [config.connection]);
  const disabled = busy || working;
  const windowsPrinters = printers.filter(name => !name.startsWith('escpos:'));
  const update = (group, key, value) => onChange({ ...config, [group]: { ...config[group], [key]: value } });
  async function action(callback) {
    setWorking(true); setError(''); setStatus('');
    try { const result = await callback(); if (result?.message) setStatus(result.message); }
    catch (err) { setError(String(err.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')); }
    finally { setWorking(false); }
  }
  const numeric = (group, key, label, min, max, step = 1) => <Field label={label}><input type="number" min={min} max={max} step={step} value={config[group][key]} onChange={e => update(group, key, e.target.value === '' ? '' : Number(e.target.value))} /></Field>;
  const check = (group, key, label) => <label><input type="checkbox" checked={config[group][key]} onChange={e => update(group, key, e.target.checked)} /> {label}</label>;
  const isPdf = /^(Microsoft Print to PDF|Adobe PDF)$/i.test(config.windows.printerName);
  return <>
    <div className="settings-receipt-section-heading"><strong>Printer Setup — this device only</strong><button type="button" disabled={disabled} onClick={() => action(onRefresh)}>Refresh Printers</button></div>
    <div className="info-box">Saved on this device only. Technical settings use standard defaults when you save.</div>
    <fieldset className="printer-settings-fields" disabled={disabled}>
      <div className="settings-form-grid">
        <Field label="Connection type"><select value={config.connection} onChange={e => onChange({ ...config, connection: e.target.value })}>
          <option value="windows">Installed printer — Canon / Epson / thermal / PDF</option>
          <option value="tcp">Network thermal printer / emulator</option>
          <option value="bluetooth">Bluetooth thermal printer</option>
        </select></Field>
        <Field label="Receipt Paper"><select value={paper} onChange={e => onPaperChange(e.target.value)}>
          <option value="50mm">50 mm Thermal</option><option value="58mm">58 mm Thermal</option><option value="80mm">80 mm Thermal</option><option value="85mm">85 mm Thermal</option><option value="a5" disabled={config.connection !== 'windows'}>A5 / Normal Printer</option><option value="a4" disabled={config.connection !== 'windows'}>A4 / Normal Printer</option>
        </select></Field>
      </div>
      {config.connection === 'windows' && <>
        <PrinterInput label="Printer Name" value={config.windows.printerName} printers={windowsPrinters} onRefresh={onRefresh} onChange={value => update('windows', 'printerName', value)} placeholder="Select a printer; blank uses Windows default" />
        <div className="printer-windows-options">
          {numeric('windows', 'copies', 'Copies', 1, 10)}
          <div className="field"><span>Color</span><div className="settings-check-grid">{check('windows', 'color', 'Color output')}</div></div>
          <div className="field"><span>Orientation</span><div className="settings-check-grid">{check('windows', 'landscape', 'Landscape orientation')}</div></div>
          <div className="field"><span>Print dialog</span><div className="settings-check-grid">{check('windows', 'silent', 'Print without showing the Windows dialog')}</div></div>
        </div>
        <div className="info-box">Install your printer in Windows first. Choose A4 or A5 for a normal office printer, or match the width of your receipt roll.</div>
        {isPdf && <div className="info-box">This printer saves a PDF file. Copies and the Windows print-dialog option do not apply.</div>}
        <button type="button" onClick={() => action(() => window.mkposDesktop.openPrinterSettings('printers'))}>Open Windows printer settings</button>
      </>}
      {config.connection === 'tcp' && <>
        <div className="settings-form-grid">
          <Field label="Printer host / IP address"><input value={config.tcp.host} placeholder="192.168.1.100" onChange={e => update('tcp', 'host', e.target.value)} /></Field>
          {numeric('tcp', 'port', 'TCP port', 1, 65535)}
        </div>
        <div className="info-box">Enter your thermal printer’s IP address. The port is usually 9100. For CrossEscPos on this computer, use 127.0.0.1. Use a trusted network.</div>
      </>}
      {config.connection === 'bluetooth' && <>
        <div className="info-box">Pair your printer in Windows. PwarMyar automatically selects a single identified Bluetooth printer. Bluetooth Classic printers are supported; BLE-only printers are not.</div>
        <div className="printer-settings-actions">
          <button type="button" onClick={() => action(() => window.mkposDesktop.openPrinterSettings('bluetooth'))}>Open Bluetooth pairing</button>
          <button type="button" onClick={() => action(refreshBluetooth)}>Refresh Bluetooth printers</button>
        </div>
        <Field label="Bluetooth printer"><select value={config.bluetooth.port} onChange={e => update('bluetooth', 'port', e.target.value)}>
          <option value="">Select a Bluetooth printer</option>
          {config.bluetooth.port && !ports.some(p => p.bluetooth && p.printerName && p.port === config.bluetooth.port) && <option value={config.bluetooth.port}>Saved / manual port ({config.bluetooth.port})</option>}
          {ports.filter(p => p.bluetooth && p.printerName).map(p => <option key={p.port} value={p.port}>{p.printerName} ({p.port})</option>)}
        </select></Field>
        <details><summary>Manual port selection</summary>
          <PrinterInput label="Outgoing Bluetooth COM port" value={config.bluetooth.port} onChange={value => update('bluetooth', 'port', value.toUpperCase())} printers={ports.map(p => p.port)} placeholder="COM5" />
          {!!ports.length && <ul className="printer-port-list">{ports.map(p => <li key={p.port}>{p.port} — {p.name}{p.bluetooth ? ' (Bluetooth)' : ''}</li>)}</ul>}
        </details>
      </>}
      {config.connection !== 'windows' && <>
        {['a4', 'a5'].includes(paper) && <div className="info-box" role="alert">Select a thermal paper width before saving this connection.</div>}
        <div className="settings-form-grid printer-output-row">
          {numeric('thermal', 'copies', 'Receipt copies', 1, 10)}
          <div className="field"><span>Paper cutter</span><div className="settings-check-grid"><label><input type="checkbox" checked={config.thermal.cut !== 'none'} onChange={e => update('thermal', 'cut', e.target.checked ? 'full' : 'none')} /> Cut paper automatically</label></div></div>
        </div>
        <div className="info-box">Choose automatic cutting only if your printer has a cutter. Myanmar text and print quality are handled automatically.</div>
      </>}
      <details><summary>A4 statements and barcode lists</summary>
        <PrinterInput label="A4 document printer" value={config.documentPrinterName} printers={windowsPrinters} onRefresh={onRefresh} onChange={value => onChange({ ...config, documentPrinterName: value })} placeholder="Blank uses Windows default printer" />
        <p>Choose a separate printer for A4 documents, or leave this blank to use the Windows default printer.</p>
      </details>
    </fieldset>
    <div className="printer-settings-actions printer-settings-save-actions" role="group" aria-label="Save and check printer">
      <button className="primary" type="button" disabled={disabled} onClick={() => action(async () => { await onSave(); return { message: 'Printer settings saved on this device only.' }; })}><Save size={16} aria-hidden="true" />Save printer settings on this device</button>
      <button className="printer-check-button" type="button" disabled={disabled} onClick={() => action(() => window.mkposDesktop.checkPrinter(simplePrinterConfig(config, paper)))}><PlugZap size={16} aria-hidden="true" />Check connection (no printing)</button>
    </div>
    {working && <div role="status">Working…</div>}
    {status && <div className="info-box" role="status">{status}</div>}
    {error && <div className="printer-settings-error" role="alert">{error}</div>}
  </>;
}
