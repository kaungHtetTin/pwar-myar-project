import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShopReviewsPage } from '../src/ShopReviewsPage';
import { RetainedViews } from '../src/RetainedViews';
import '../../frontend/src/styles.css';
import '../src/styles.css';
import '../src/desktop-parity.css';
function Fixture() {
 const [filterOpen, setFilterOpen] = useState(false), [tab, setTab] = useState('reviews');
 return <div className="office-shell" style={{ display: 'block' }}><main className="office-content" style={{ padding: 16 }}><div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><button onClick={() => setTab('reviews')}>Reviews section</button><button onClick={() => setTab('other')}>Other section</button></div><h1>Shop reviews</h1><RetainedViews activeKey={tab}>{tab === 'reviews' ? <ShopReviewsPage filterOpen={filterOpen} onFilterOpen={() => setFilterOpen(true)} onFilterClose={() => setFilterOpen(false)} /> : <p>Other Office section</p>}</RetainedViews></main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
