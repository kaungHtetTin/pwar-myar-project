import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BillingHistoryTable } from '../src/BillingHistoryTable';
import '../../frontend/src/styles.css';
import '../src/styles.css';
import '../src/desktop-parity.css';
const initial = [{ id: 7, plan_name: 'Professional business subscription', note: 'Assigned after payment approval', access_type: 'paid', status: 'active', starts_at: '2026-10-01T03:30:00Z', ends_at: '2026-10-31T03:30:00Z', created_at: '2026-10-01T03:30:00Z', price_paid: 45000, currency: 'Ks', created_by_name: 'Office administrator', duration_days: 30 }];
function Fixture() {
  const [history, setHistory] = useState(initial);
  return <div className="office-shell" style={{ display: 'block' }}><main className="office-content" style={{ padding: 16 }}><section className="office-panel office-table-panel office-billing-history" style={{ maxWidth: 900 }}><div className="office-panel-header"><div><h2>Billing history</h2><p>Every subscription period assigned to this business.</p></div></div><BillingHistoryTable businessId={11} history={history} currency="Ks" onSaved={detail => setHistory(detail.billing_history)} /></section></main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
