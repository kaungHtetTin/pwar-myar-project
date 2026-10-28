import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BusinessesPage, initialBusinessQuery } from '../src/BusinessesPage';
import '../../frontend/src/styles.css';
import '../../frontend/src/styles/responsive.css';
import '../src/styles.css';
function Fixture() {
  const [query, setQuery] = useState(initialBusinessQuery);
  return <main style={{ padding: 16, minWidth: 0 }}><h2>Businesses</h2><BusinessesPage query={query} onQueryChange={setQuery} onOpen={() => {}} /></main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
