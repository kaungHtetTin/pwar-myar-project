import React, { useId, useRef, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { api } from './api';
import { OfficeModal } from './OfficeModal';
import './platform-user-email.css';

export function PlatformUserEmail({ customer, onClose, onSent, endpoint, owner = false, businessName }) {
  const id = useId(), sending = useRef(false), attempt = useRef(null);
  const [subject, setSubject] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [unconfirmed, setUnconfirmed] = useState(false);
  async function submit(event) {
    event.preventDefault(); if (sending.current || unconfirmed) return;
    const payload = { recipient_email: customer.email, subject: subject.trim(), message: message.trim() };
    const fingerprint = JSON.stringify(payload);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    sending.current = true; setBusy(true); setError('');
    try {
      const result = await api(endpoint || `/office/platform-users/${customer.id}/email`, { method: 'POST', body: JSON.stringify({ ...payload, idempotency_key: attempt.current.key }) });
      onSent(result.message || `Email sent to ${customer.email}.`);
    } catch (e) {
      setError(e.message);
      if (e.payload?.code === 'email_delivery_unconfirmed') setUnconfirmed(true);
    } finally { sending.current = false; setBusy(false); }
  }
  return <OfficeModal title="Send email" description={owner ? "Send a message to this business owner's registered email address." : "Send a message to this customer's registered email address."} closeLabel="Close email composer" onClose={onClose} busy={busy} className="office-platform-email-modal" footer={<><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" form={id} className="office-button-primary" disabled={busy || unconfirmed}><Send size={15} />{busy ? 'Sending...' : 'Send email'}</button></>}>
    <form id={id} onSubmit={submit} className="office-platform-email-form"><fieldset disabled={busy}>
      <div className="office-platform-email-recipient"><Mail size={21} aria-hidden="true" /><div><small>To</small><strong>{customer.name}</strong><span>{customer.email}</span>{businessName && <small>{businessName}</small>}</div></div>
      <label>Subject<input required maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Email subject" /></label>
      <label>Message<textarea required rows={9} maxLength={10000} value={message} onChange={event => setMessage(event.target.value)} placeholder={owner ? 'Write your message to the business owner...' : 'Write your message to the customer...'} /></label>
      <small className="office-platform-email-help">Your message will use the PwarMyar email template. Text and line breaks are preserved.</small>
      {error && <p className="feedback error" role="alert">{error}</p>}
    </fieldset></form>
  </OfficeModal>;
}
