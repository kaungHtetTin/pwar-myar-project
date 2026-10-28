import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/main';
window.location.hash = '/account/login?next=%2Fchats';
createRoot(document.getElementById('fixture-root')).render(<App />);
