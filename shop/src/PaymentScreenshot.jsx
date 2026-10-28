import React, { useEffect, useRef, useState } from "react";
import { useText } from "./i18n";
import { ImagePlus, Trash2 } from 'lucide-react';

export function PaymentScreenshot({ file, onChange }) {
  const text = useText();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const input = useRef(null);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="payment-screenshot">
    <label>
      <span className="payment-file-label"><ImagePlus size={18} aria-hidden="true" />{text("Payment screenshot (optional)")}</span>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => {
        const selected = event.target.files?.[0];
        setError("");
        if (!selected) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 2 * 1024 * 1024) {
          setError(text("Choose a JPG, PNG or WebP image up to 2 MB."));
          event.target.value = "";
          onChange(null);
          return;
        }
        onChange(selected);
      }} />
    </label>
    <small>{text("You can attach a payment receipt now or upload it after placing your order. The shop will check it before approving payment.")}</small>
    {error && <p role="alert">{error}</p>}
    {file && <div className="payment-screenshot-preview">
      {preview && <img src={preview} alt={text("Selected payment screenshot")} />}
      <span>{file.name}</span>
      <button type="button" onClick={() => { if (input.current) input.current.value = ""; onChange(null); setError(""); }}><Trash2 size={15} aria-hidden="true" />{text("Remove screenshot")}</button>
    </div>}
  </div>;
}
