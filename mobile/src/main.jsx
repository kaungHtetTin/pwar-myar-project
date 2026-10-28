import { AdminAuthorizationDialog } from './components/AdminAuthorizationDialog';
import { startBranding } from './platformBranding';
import React from 'react';
import './styles/cascade.css';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { AppVariantRecommendation } from './components/AppVariantRecommendation';
import { LocaleProvider } from './localization/LocaleProvider';
import '@fontsource/noto-sans-myanmar/400.css';
import '@fontsource/noto-sans-myanmar/500.css';
import '@fontsource/noto-sans-myanmar/600.css';
import '@fontsource/noto-sans-myanmar/700.css';
import { registerPwa } from './pwa/registerPwa';
import { AccountDeletionPage } from './settings/AccountDeletion';
import { routePathFromLocation } from './navigation/routeBase';

registerPwa();

startBranding((import.meta.env.VITE_API_URL || '/api'));

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider>{routePathFromLocation(window.location.pathname) === '/account-deletion' ? <AccountDeletionPage /> : <><App /><AppVariantRecommendation /><AdminAuthorizationDialog /></>}</LocaleProvider>
  </React.StrictMode>,
);













