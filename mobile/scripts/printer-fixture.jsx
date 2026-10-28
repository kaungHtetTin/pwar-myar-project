// Isolated visual fixture; never imported by the application build.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PrinterSettingsPage } from '../src/settings/PrinterSettingsPage';
import { ReceiptPreview } from '../src/settings/ReceiptPreview';
import '../src/styles/index.css';
import '../src/styles/navigation.css';
import '../src/styles/products.css';
import '../src/styles/settings.css';
import '../src/styles/app-bar-overrides.css';
const root = createRoot(document.getElementById('root'));
window.renderPrinter = mode => {
  window.printerFixtureMode = mode;
  if (mode.startsWith('preview-')) {
    const paper = mode.slice(8);
    root.render(<main className="settings-page settings-form-page"><form className="settings-mobile-form"><section className="mobile-form-section"><ReceiptPreview settings={{ receipt_paper_size: paper }} preview={{ html: `<div class="receipt-document"><header class="receipt-shop-header"><div class="shop-name">PwarMyar Shop</div><div class="shop-address">မြန်မာစာ စမ်းသပ်ရန်</div></header><div class="receipt-rule"></div>${Array.from({ length: 15 }, (_, i) => `<div class="receipt-item"><div class="receipt-item-name">Sample product ${i + 1} with a long name</div><div class="receipt-row"><span>Quantity / total</span><strong>1,000,000,000 Ks</strong></div></div>`).join('')}<div class="receipt-footer">Thank you — End of receipt</div></div>` }} /></section></form></main>);
    return;
  }
  root.render(<PrinterSettingsPage key={mode} onNavigate={() => {}} />);
};
window.renderPrinter('system');
