import { PageAppBar } from '../navigation/PageAppBar';
import { AppBarMenu } from '../navigation/AppBarMenu';
import { Button, IconButton, Input, Radio, Select } from '../components/Controls';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Info, Printer, Smartphone } from 'lucide-react';
import { MobileField, MobileNotice } from '../components/MobilePrimitives';
import { usePageRefresh } from '../navigation/pageRefresh';
import { defaultPrinter, isAndroidPrinter, NativePrinter, validatePrinter } from '../utils/printerProfile';
import { printHtmlDocument } from '../utils/printing';
import { SettingsChoices, SettingsSection, SettingsToggle } from './SettingsParts';

export function PrinterSettingsPage({ onNavigate }) {
  const [config, setConfig] = useState(defaultPrinter);
  const [loading, setLoading] = useState(isAndroidPrinter);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(null);
  const [listing, setListing] = useState(false);
  const [listError, setListError] = useState('');
  const sentinel = useRef(null);
  const inFlight = useRef(false);
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async () => {
    if (!isAndroidPrinter()) return;
    const saved = await NativePrinter.getConfig();
    if (mounted.current) setConfig({ ...defaultPrinter(), ...saved });
  }, []);
  useEffect(() => { load().catch(error => setNotice({ type: 'error', text: error.message })).finally(() => setLoading(false)); }, [load]);
  usePageRefresh(busy ? null : load);
  const patch = (key, value) => { setConfig(current => ({ ...current, [key]: value, ...(key === 'connection' && value !== 'system' && current.paper === 'a4' ? { paper: '80mm' } : {}) })); setErrors(current => ({ ...current, [key]: undefined })); };
  async function list(reset = false) {
    if (inFlight.current) return;
    inFlight.current = true; setListing(true); setListError('');
    try {
      const result = await NativePrinter.listPaired({ offset: reset ? 0 : devices.length, limit: 10 });
      if (!mounted.current) return;
      setDevices(current => [...new Map([...(reset ? [] : current), ...result.items].map(item => [item.address, item])).values()]); setTotal(result.total);
    } catch (error) { if (mounted.current) setListError(error.message); }
    finally { inFlight.current = false; if (mounted.current) setListing(false); }
  }
  const more = total !== null && devices.length < total;
  useEffect(() => {
    if (!more || listing || listError || !sentinel.current || !window.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) list(); });
    observer.observe(sentinel.current); return () => observer.disconnect();
  });
  async function action(type) {
    if (operation.current) return;
    const validation = validatePrinter(config); setErrors(validation);
    if (Object.keys(validation).length) return;
    operation.current = true;
    setBusy(true); setNotice(null);
    try {
      const clean = { ...config, host: config.host.trim(), copies: Number(config.copies), port: Number(config.port) };
      if (type === 'check') {
        const result = await NativePrinter.checkConnection({ config: clean }); setNotice({ type: 'success', text: result.message });
      } else {
        setConfig(await NativePrinter.saveConfig({ config: clean }));
        if (type === 'test') {
          await printHtmlDocument({ title: 'PwarMyar Test Receipt', text: 'PwarMyar PRINT TEST\nမြန်မာစာ စမ်းသပ်ရန်\n--------------------\nSample item       1,000\nTotal             1,000\n--------------------\nEnd of test receipt', paperSize: clean.paper });
          setNotice({ type: 'success', text: clean.connection === 'system' ? 'Android reports the print job completed.' : 'Test data sent. Verify the text and receipt ending on your printer.' });
        } else setNotice({ type: 'success', text: 'Printer settings saved on this device only.' });
      }
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { operation.current = false; setBusy(false); }
  }
  const input = (key, label, type = 'text') => <MobileField id={`printer-${key}`} label={label} error={errors[key]}><Input id={`printer-${key}`} type={type} value={config[key]} aria-describedby={errors[key] ? `printer-${key}-error` : undefined} onChange={event => patch(key, event.target.value)} /></MobileField>;
  const toggle = (key, label) => <SettingsToggle label={label} checked={config[key]} onChange={event => patch(key, event.target.checked)} />;
  return <main className="settings-page settings-form-page mobile-printer-page">
    <PageAppBar as="section" className="settings-reference-header"><IconButton variant="ghost" type="button" className="icon-button" aria-label="Back to settings" onClick={() => onNavigate('/settings')}><ArrowLeft size={21} /></IconButton><div><span className="page-kicker">Settings</span><h1>Printer</h1><p>Connection and paper for this device.</p></div><AppBarMenu /></PageAppBar>
    <MobileNotice notice={notice} onClose={() => setNotice(null)} /><section className="settings-printer-context"><span className="settings-row-icon"><Smartphone size={20} /></span><span><strong>{isAndroidPrinter() ? 'Native Android' : 'Browser printing'}</strong><small>{isAndroidPrinter() ? 'Printer configuration is saved on this device.' : 'Printing uses your browser print dialog.'}</small></span></section>
    {!isAndroidPrinter() ? <section className="mobile-form-section"><h3>Print settings</h3><div className="settings-info-note settings-printer-info"><Info size={20} /><p>Choose your printer, copies and color in the browser print dialog. Direct Bluetooth and network printing require the PwarMyar Android app.</p></div><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => onNavigate('/settings/receipt')}>Receipt layout</Button><Button variant="primary" type="button" className="mobile-primary" disabled={busy} onClick={async () => { setBusy(true); setNotice(null); try { if (!await printHtmlDocument({ title: 'PwarMyar Test Receipt', text: 'PwarMyar PRINT TEST\nSample item       1,000\nTotal             1,000\nEnd of test receipt', paperSize: '80mm' })) setNotice({ type: 'error', text: 'Allow pop-ups to print.' }); } catch (error) { setNotice({ type: 'error', text: error.message }); } finally { setBusy(false); } }}><Printer size={17} />Test print</Button></section> : loading ? <p role="status">Loading printer settings…</p> : <form className="settings-mobile-form" onSubmit={event => { event.preventDefault(); action('save'); }} noValidate>
      <fieldset disabled={busy || listing} className="mobile-printer-fields"><SettingsSection title="Connection type">
        <p>Saved on this phone only. Printer settings are excluded from device backup and transfer. Technical options use standard defaults.</p>
        <SettingsChoices label="Connection" value={config.connection} onChange={value => patch('connection', value)} options={[{ value: 'system', label: 'Android print dialog / PDF', description: 'Select a printer in the Android system dialog.' }, { value: 'tcp', label: 'Network thermal / emulator', description: 'Connect over your local network.' }, { value: 'bluetooth', label: 'Bluetooth Classic thermal', description: 'Choose a paired Classic ESC/POS printer.' }]} />{errors.connection && <small role="alert">{errors.connection}</small>}
        </SettingsSection><SettingsSection title="Print settings"><MobileField id="printer-paper" label="Paper size" error={errors.paper}><Select id="printer-paper" value={config.paper} aria-describedby={errors.paper ? 'printer-paper-error' : undefined} onChange={event => patch('paper', event.target.value)}>{['50mm', '58mm', '80mm', '85mm', 'a4'].map(paper => <option key={paper} value={paper} disabled={paper === 'a4' && config.connection !== 'system'}>{paper === 'a4' ? 'A4' : `${paper} thermal`}</option>)}</Select></MobileField>
        {config.connection === 'system' && <><p>Select a compatible Canon/Epson printer or Save as PDF in Android’s dialog. Copies and final paper options are chosen there. A4 statements always use this dialog.</p>{toggle('color', 'Color output')}{toggle('landscape', 'Landscape for A4 documents')}</>}
        {config.connection === 'tcp' && <>{input('host', 'Printer IP / hostname')}{input('port', 'Port', 'number')}<p>Usually port 9100. Use a trusted local network. For an emulator on a PC, enter the PC’s LAN IP, not 127.0.0.1. The destination must support ESC/POS.</p></>}
        {config.connection === 'bluetooth' && <><MobileField id="printer-bluetooth-mode" label="Bluetooth print mode" error={errors.bluetooth_mode}><Select id="printer-bluetooth-mode" value={config.bluetooth_mode || 'standard'} onChange={event => patch('bluetooth_mode', event.target.value)}><option value="standard">Standard</option><option value="compatibility">Compatibility (slower)</option></Select></MobileField><p>Use Compatibility if repeated receipts are incomplete or garbled. It sends smaller blocks more slowly. Check the paper before retrying a failed print.</p><p>Pair in Android Settings, then refresh paired devices. Only Bluetooth Classic ESC/POS printers are supported; BLE-only devices are not.</p><div className="mobile-form-actions"><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => NativePrinter.openBluetoothSettings().catch(error => setNotice({ type: 'error', text: error.message }))}>Open pairing</Button><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => list(true)}>Refresh paired devices</Button></div><p>Selected: {devices.find(d => d.address === config.address)?.name || config.address || 'None'}</p>
          <div role="radiogroup" aria-label="Paired printers" aria-describedby={errors.address ? 'printer-address-error' : undefined}>{devices.map(device => <label className="settings-check" key={device.address}><Radio type="radio" name="paired-printer" value={device.address} checked={config.address === device.address} onChange={() => patch('address', device.address)} /><span><strong>{device.name}</strong><small>{device.address}</small></span></label>)}</div>
          {errors.address && <small id="printer-address-error" className="mobile-field-error" role="alert">{errors.address}</small>}
        </>}
        {config.connection !== 'system' && <>{input('copies', 'Copies', 'number')}{toggle('cut', 'Cut paper automatically')}<p>Enable cutting only if the printer has a cutter. Myanmar text is rendered as an image.</p></>}
      </SettingsSection><SettingsSection title="Connection & test"><div className="settings-printer-test-actions"><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy || listing} onClick={() => action('check')}>Check connection</Button><Button variant="secondary" type="button" className="mobile-secondary" disabled={busy || listing} onClick={() => action('test')}><Printer size={17} />Test print</Button></div></SettingsSection></fieldset>
      {config.connection === 'bluetooth' && <div ref={sentinel}>{listing && <p role="status">Loading paired devices…</p>}{listError && <p role="alert">{listError}</p>}{total === 0 && <p>No paired Classic devices found. Pair your printer in Android Settings.</p>}{(more || listError) && <Button variant="secondary" className="mobile-secondary" type="button" disabled={listing || busy} onClick={() => list(total === null)}>Load more / retry</Button>}</div>}
      <div className="mobile-form-actions"><Button variant="primary" type="submit" className="mobile-primary" disabled={busy || listing}>Save</Button></div>
      <p>{busy ? 'Working… Please finish or cancel the Android print dialog.' : 'Test Print saves this setup and prints a local sample. A successful connection check is not proof of printed output.'}</p>
    </form>}
  </main>;
}
