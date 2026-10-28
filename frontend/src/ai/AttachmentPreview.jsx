import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, Image as ImageIcon, X } from 'lucide-react';
import { requestDownload } from '../api';
import './attachment-preview.css';

export function AttachmentPreview({ file, attachment, onRemove, disabled = false }) {
  const localFile = file || attachment?.file;
  const name = localFile?.name || attachment?.name || 'Attachment';
  const image = /\.(jpe?g|png|webp)$/i.test(name) || attachment?.type === 'image';
  const [preview, setPreview] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const path = attachment?.preview_path;
  useEffect(() => {
    let active = true, url;
    setPreview(''); setUnavailable(false);
    if (localFile && image) { url = URL.createObjectURL(localFile); setPreview(url); }
    else if (image && path && /^\/ai-assistant\/conversations\/[a-f0-9-]+\/messages\/\d+\/image$/i.test(path)) {
      requestDownload(path, { accept: 'image/*' }).then(({ blob }) => {
        if (!active) return;
        url = URL.createObjectURL(blob); setPreview(url);
      }).catch(() => { if (active) setUnavailable(true); });
    }
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [localFile, image, path]);
  const size = localFile?.size ?? attachment?.size;
  const sizeText = Number.isFinite(size) ? size < 1024 ? `${size} B` : size < 1048576 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB` : '';
  const kind = image ? `${/\.jpe?g$/i.test(name) ? 'JPEG' : /\.webp$/i.test(name) ? 'WebP' : 'PNG'} image` : 'CSV document';
  return <div className="ai-attachment-preview" aria-label="Attached file">
    <span className={`ai-attachment-thumbnail${image ? ' is-image' : ''}`}>{preview ? <img src={preview} alt={`Preview of ${name}`} /> : image ? <ImageIcon size={25} aria-hidden="true" /> : <FileSpreadsheet size={25} aria-hidden="true" />}</span>
    <span className="ai-attachment-copy"><strong title={name} data-no-localize>{name}</strong><small>{kind}{sizeText && ` · ${sizeText}`}{unavailable && ' · Preview unavailable'}</small></span>
    {onRemove && <button type="button" className="ai-attachment-remove" aria-label="Remove attachment" disabled={disabled} onClick={onRemove}><X size={18} /></button>}
  </div>;
}
