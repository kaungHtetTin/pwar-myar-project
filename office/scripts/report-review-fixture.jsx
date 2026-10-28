import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShopReportsPage, initialReportQuery } from '../src/ShopReportsPage';
import '../../frontend/src/styles.css';
import '../../frontend/src/styles/responsive.css';
import '../src/styles.css';
import '../src/desktop-parity.css';
import '../src/shop-reports.css';
function Fixture() {
  const [query, setQuery] = useState(initialReportQuery);
  return <div className="office-shell" style={{ display: 'block' }}><main className="office-content" style={{ padding: 16 }}><h1>Shop reports</h1><ShopReportsPage query={query} onQueryChange={setQuery} onOpenBusiness={() => {}} /></main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
