import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthScreen } from '../src/app/AuthScreen';
import '../src/styles/index.css'; import '../src/styles/auth-reference.css';
function Fixture() { const [page,setPage] = useState('login'); return <AuthScreen page={page} onNavigate={setPage} onAuthenticated={() => {}} />; }
createRoot(document.getElementById('root')).render(<Fixture />);
