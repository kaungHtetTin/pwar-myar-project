import React, { useEffect, useState } from 'react';
import { MobileNotice } from './MobilePrimitives';
export function PrintStatusNotice() {
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    const listener = event => setNotice({ type: 'success', text: event.detail.message || 'Print job submitted. Check output on your printer.' });
    window.addEventListener('mkpos:print-status', listener);
    return () => window.removeEventListener('mkpos:print-status', listener);
  }, []);
  return <MobileNotice notice={notice} onClose={() => setNotice(null)} />;
}
