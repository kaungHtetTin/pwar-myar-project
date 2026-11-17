import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthScreen } from '../src/components/AuthScreen';
import '../src/styles.css'; import '../src/styles/responsive.css'; import '../src/styles/auth.css'; import '../src/styles/desktop-design.css';
function Fixture() { const [page,setPage] = useState('login'); return <AuthScreen page={page} onNavigate={setPage} onAuthenticated={() => {}} />; }
createRoot(document.getElementById('root')).render(<Fixture />);
