import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BusinessStorefront, ShopGpsPosition } from '../src/BusinessStorefront';
import '../../frontend/src/styles.css';
import '../src/styles.css';
import '../src/desktop-parity.css';
function Fixture() {
  const [storefront, setStorefront] = useState({ display_name: 'Demo Shop 01', slug: 'demo-shop-01', storefront_enabled: true, marketplace_enabled: true, marketplace_suspended: false });
  return <div className="office-shell" style={{ display: 'block' }}><main className="office-content" style={{ padding: 16 }}><div className="office-detail-grid"><div className="office-detail-main"><ShopGpsPosition location={{ latitude: 16.8409, longitude: 96.1735, accuracy: 15, captured_at: '2026-10-15T12:00:00Z' }} /></div><aside className="office-detail-sidebar"><BusinessStorefront businessId={11} storefront={storefront} onSaved={setStorefront} /></aside></div></main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
