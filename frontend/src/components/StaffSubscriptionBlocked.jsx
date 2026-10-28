import { BrandImage } from '../platformBranding';
import React, { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { request } from '../api';
import { BRAND_LOGO } from '../assets';
import { desktopBridge } from '../desktop';

export function StaffSubscriptionBlocked({ session, onLoggedOut }) {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await request('/auth/logout', { method: 'POST' });
      await desktopBridge()?.clearOfflineSession();
    } finally { onLoggedOut(); }
  }
  return (
    <main className="subscription-page">
      <header className="subscription-header"><div className="auth-brand"><BrandImage src={BRAND_LOGO} alt="" /><div><strong>PwarMyar</strong><span>{session.business.name}</span></div></div><button type="button" onClick={logout} disabled={busy}><LogOut size={17} /> Sign out</button></header>
      <section className="subscription-hero" role="alert"><span className="subscription-icon"><ShieldCheck size={28} /></span><h1>Business subscription required</h1><p>This business does not currently have active PwarMyar access. Please contact the business owner to renew the subscription.</p></section>
    </main>
  );
}
