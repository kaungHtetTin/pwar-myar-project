import React, { useEffect, useRef, useState } from 'react';
import { apiDownload } from '../api/client';
import { productPhotos, observePhoto } from '../../../shared/network/productPhotos.js';

export function ProductPhoto({ path, alt = '', className = '', loading = 'lazy' }) {
  const [source, setSource] = useState('');
  const imageRef = useRef(null);
  useEffect(() => {
    let active = true, objectUrl = '';
    setSource('');
    if (!path) return () => { active = false; };
    const stop = observePhoto(imageRef.current, loading === 'eager', () => {
      productPhotos.get(path, () => apiDownload(path, { accept: 'image/jpeg,image/png,image/webp', timeoutMs: 15000 }).then(response => response.blob())).then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      }).catch(() => {});
    });
    return () => { active = false; stop(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, loading]);
  return <img ref={imageRef} src={source || undefined} alt={alt} className={className} loading={loading} style={source ? undefined : { visibility: 'hidden' }} />;
}
