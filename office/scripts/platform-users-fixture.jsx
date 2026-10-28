import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlatformUsersPage } from '../src/PlatformUsersPage';
import { OfficeAppBarContext } from '../src/OfficePageToolbar';
import '../../frontend/src/styles.css';
import '../src/styles.css';
import '../src/desktop-parity.css';
function Fixture() {
  const [search, setSearch] = useState(null), [actions, setActions] = useState(null);
  return <OfficeAppBarContext.Provider value={{ search, actions }}><div className="office-shell" style={{ display: 'block' }}><main className="office-main" style={{ minHeight: '100vh' }}>
    <header className="topbar office-topbar"><div className="office-appbar-slot" ref={setSearch} /><div className="office-topbar-actions"><div className="office-appbar-slot" ref={setActions} /></div></header>
    <div className="office-content"><div className="office-page-heading"><h1>Platform users</h1></div><PlatformUsersPage scope="fixture" /></div>
  </main></div></OfficeAppBarContext.Provider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
