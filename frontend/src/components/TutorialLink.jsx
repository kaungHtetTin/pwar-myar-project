import React, { useState } from 'react';
import { Video } from 'lucide-react';
import { tutorialUrl } from '../tutorialUrl';

export function TutorialLink() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function open() {
    setError('');
    try {
      if (window.mkposDesktop?.openTutorials) {
        setBusy(true);
        await window.mkposDesktop.openTutorials();
      } else if (window.mkposDesktop?.getInfo) {
        setBusy(true);
        const info = await window.mkposDesktop.getInfo();
        window.open(tutorialUrl({ publicUrl: info.serverUrl }), '_blank', 'noopener,noreferrer');
      } else {
        window.open(tutorialUrl({ apiUrl: import.meta.env.VITE_API_URL || '/api', devOrigin: import.meta.env.DEV ? import.meta.env.VITE_DEV_API_ORIGIN || 'http://127.0.0.1:8000' : '', publicUrl: import.meta.env.VITE_PUBLIC_SITE_URL || '' }), '_blank', 'noopener,noreferrer');
      }
    } catch { setError('Unable to open tutorials. Check the website connection.'); }
    finally { setBusy(false); }
  }
  return <><button type="button" onClick={open} disabled={busy} title="Video tutorials · opens in your browser · internet required"><Video size={18} /><span>Tutorials</span></button>{error && <small role="alert">{error}</small>}</>;
}
