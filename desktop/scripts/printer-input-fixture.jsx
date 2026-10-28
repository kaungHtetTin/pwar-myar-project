import React, { useState } from '../../frontend/node_modules/react/index.js';
import { createRoot } from '../../frontend/node_modules/react-dom/client.js';
import { flushSync } from '../../frontend/node_modules/react-dom/index.js';
import { PrinterInput } from '../../frontend/src/components/PrinterInput.jsx';
import { PrinterSettings } from '../../frontend/src/components/PrinterSettings.jsx';
import baseCss from '../../frontend/src/styles.css?inline';
import responsiveCss from '../../frontend/src/styles/responsive.css?inline';
import settingsCss from '../../frontend/src/styles/settings.css?inline';

export function mountPrinterInput() {
  const style = document.createElement('style');
  style.textContent = baseCss + responsiveCss + settingsCss;
  document.head.append(style);
  const root = document.createElement('div');
  document.body.append(root);
  function Fixture() {
    const [value, setValue] = useState('Microsoft Print to PDF');
    return <main style={{ padding: 32 }}><section className="settings-receipt-section">
      <h2>Printer Setup</h2>
      <div className="settings-form-grid"><PrinterInput label="Printer Name" value={value} onChange={setValue}
        printers={['Microsoft Print to PDF', 'Adobe PDF', 'AY-D5811(BT)', 'XP-58C', 'Xprinter XP-365B', 'escpos://127.0.0.1:9100']} />
        <label className="field"><span>Receipt Paper</span><select defaultValue="80mm"><option>80mm</option></select></label></div>
      <div className="info-box">PDF selections save a file. Select escpos://127.0.0.1:9100 for the local emulator.</div>
    </section></main>;
  }
  flushSync(() => createRoot(root).render(<Fixture />));
}

export function mountPrinterSettings(initialConfig) {
  const style = document.createElement('style');
  style.textContent = baseCss + responsiveCss + settingsCss;
  document.head.append(style);
  const root = document.createElement('div');
  document.body.append(root);
  function Fixture() {
    const [config, setConfig] = useState(initialConfig);
    const [paper, setPaper] = useState('58mm');
    return <main style={{ padding: 20, height: '100vh' }}><section className="settings-screen" style={{ height: '100%' }}><div className="settings-workspace">
      <nav className="settings-side-tabs"><button>Receipt</button><button className="selected">Printer</button></nav>
      <div className="settings-panel"><div className="settings-panel-heading">Printer settings</div><div className="settings-panel-content"><form className="settings-form settings-printer-form"><section className="settings-receipt-section">
      <PrinterSettings config={config} onChange={setConfig} paper={paper} onPaperChange={setPaper}
        printers={['Microsoft Print to PDF', 'Canon Office', 'Epson Receipt']} onRefresh={async () => {}} onSave={async () => {}} />
    </section></form></div></div></div></section></main>;
  }
  flushSync(() => createRoot(root).render(<Fixture />));
}
