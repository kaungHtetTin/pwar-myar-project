import { LoadingSkeleton } from './LoadingSkeleton';
import React, { useEffect, useRef, useState } from 'react';
import { ImageOff, ImagePlus, X } from 'lucide-react';
import { requestChatImage } from './api';
import { useText } from './i18n';

const download = requestChatImage;

export function ShopChatImage({ message, path }) {
  const text = useText();
  const [now, setNow] = useState(Date.now), [url, setUrl] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const expires = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(message.image.expires_at) ? message.image.expires_at : `${message.image.expires_at.replace(' ', 'T')}Z`).getTime();
  const expired = message.image.status === 'expired' || now >= expires;
  useEffect(() => { if (!Number.isFinite(expires) || expires <= Date.now()) return; const timer = setTimeout(() => setNow(Date.now()), Math.min(expires - Date.now(), 2147483647)); return () => clearTimeout(timer); }, [expires]);
  useEffect(() => {
    let active = true, objectUrl;
    setUrl(''); setError('');
    if (!expired) download(path).then((result) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(result.blob); setUrl(objectUrl);
    }).catch((failure) => { if (active) setError(failure.status === 410 ? 'Image expired' : 'Unable to load image'); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, expired, retry]);
  return <div className="shop-chat-image">
    {expired || error === 'Image expired' ? <span className="shop-chat-image-placeholder"><ImageOff size={22} /><span>{text('Image expired')}</span><small>{text('Images are deleted after 14 days.')}</small></span>
      : url ? <a href={url} target="_blank" rel="noreferrer" aria-label={text('Open image')}><img src={url} alt={text('Chat image')} /></a>
        : error ? <span className="shop-chat-image-placeholder"><span>{text(error)}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>{text('Retry')}</button></span>
          : <LoadingSkeleton variant="image" message="Loading image…" />}
  </div>;
}

export function ChatImagePicker({ disabled, onSelect }) {
  const text = useText();
  const input = useRef(null);
  return <><input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label={text('Image file')} disabled={disabled} onChange={(event) => { onSelect(event.target.files?.[0] || null); event.target.value = ''; }} />
    <button type="button" className="shop-chat-attach" title={text('Attach image')} aria-label={text('Attach image')} disabled={disabled} onClick={() => input.current.click()}><ImagePlus size={20} /></button></>;
}

export function ChatImagePreview({ file, disabled, onRemove }) {
  const text = useText();
  const [url, setUrl] = useState('');
  useEffect(() => { const objectUrl = URL.createObjectURL(file); setUrl(objectUrl); return () => URL.revokeObjectURL(objectUrl); }, [file]);
  return <div className="shop-chat-image-selection"><img src={url} alt={text('Selected image')} /><div><strong>{file.name}</strong><small>{text('Up to 2 MB. Compressed to 500 KB. Deleted after 14 days.')}</small></div><button className="mkpos-dismiss-icon" type="button" aria-label={text('Remove image')} onClick={onRemove} disabled={disabled}><X size={16} /></button></div>;
}
