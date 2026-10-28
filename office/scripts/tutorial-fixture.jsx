import React from 'react';
import { createRoot } from 'react-dom/client';
import { TutorialsPage } from '../src/TutorialsPage';
import '../../frontend/src/styles.css';
import '../../frontend/src/styles/responsive.css';
import '../src/styles.css';
import '../src/tutorials.css';
createRoot(document.getElementById('root')).render(<div className="office-shell" style={{ display: 'block' }}><main style={{ padding: 16 }}><TutorialsPage /></main></div>);
