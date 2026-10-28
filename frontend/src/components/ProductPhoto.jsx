import React, { useEffect, useState } from 'react';
import { requestDownload } from '../api';

export function ProductPhoto({ path, alt = '', className = '', loading = 'lazy' }) {
  const [source, setSource] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSource('');
    if (!path) return () => { active = false; };
    requestDownload(path, { accept: 'image/jpeg,image/png,image/webp', timeoutMs: 15000 }).then(({ blob }) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return source ? <img src={source} alt={alt} className={className} loading={loading} /> : null;
}
