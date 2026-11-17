import React from 'react';
import { createRoot } from 'react-dom/client';
import { Dashboard } from '../src/main';
const mount = document.createElement('div');
document.body.append(mount);
createRoot(mount).render(<Dashboard session={{ admin: { name: 'Office Admin', email: 'office@example.test' } }} onLogout={() => {}} onSessionChange={() => {}} />);
