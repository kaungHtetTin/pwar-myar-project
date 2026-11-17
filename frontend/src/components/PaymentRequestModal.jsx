import React, { useId, useState } from 'react';
import { Check, ImageUp, Landmark, Send } from 'lucide-react';
import { Modal } from './common';

export function PaymentRequestModal({ plan, paymentMethods, busy, onClose, onSubmit, error = '', onClearError = () => {} }) {
  const errorId = useId();
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ? String(paymentMethods[0].id) : '');
  const [screenshot, setScreenshot] = useState(null);
  const [message, setMessage] = useState('');

  function submit(event) {
    event.preventDefault();
    if (busy || !paymentMethodId || !screenshot) return;
    onSubmit({ paymentMethodId: Number(paymentMethodId), screenshot, message });
  }

  return (
    <Modal open title={`Pay for ${plan.name}`} subtitle={`${Number(plan.price || 0).toLocaleString()} ${plan.currency || 'Ks'} · Transfer to an account below and attach the payment proof.`} onClose={onClose} busy={busy} focusFirstField={false} className="subscription-payment-modal" size="medium" footer={<><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" form="subscription-payment-form" className="primary" disabled={busy || !paymentMethodId || !screenshot}><Send size={16} /> {busy ? 'Checking payment proof...' : 'Submit payment request'}</button></>}>
      <form id="subscription-payment-form" className="subscription-payment-form" onSubmit={submit} noValidate>
        <div className="subscription-payment-fields">
          <fieldset className="subscription-payment-method-fieldset">
            <legend><Landmark size={16} /><strong>Payment account</strong></legend>
            <div className="subscription-payment-methods">
              {paymentMethods.map((method) => (
                <label className={paymentMethodId === String(method.id) ? 'selected' : ''} key={method.id}>
                  <input required disabled={busy} type="radio" name="payment_method_id" value={method.id} checked={paymentMethodId === String(method.id)} onChange={(event) => { setPaymentMethodId(event.target.value); onClearError(); }} />
                  <span className="subscription-payment-method-copy"><strong>{method.bank}</strong><small>{method.account_name}</small><b>{method.account_no}</b></span>
                  <span className="subscription-payment-method-check" aria-hidden="true"><Check size={13} /></span>
                </label>
              ))}
              {!paymentMethods.length && <p className="subscription-payment-method-empty">No payment accounts are available. Please contact the PwarMyar office.</p>}
            </div>
          </fieldset>

          <label className="subscription-proof-field">
            <input required disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => { setScreenshot(event.target.files?.[0] || null); onClearError(); }} />
            <span className="subscription-proof-icon"><ImageUp size={20} /></span>
            <span className="subscription-proof-copy">
              <strong>{screenshot ? 'Payment screenshot ready' : 'Payment screenshot'}</strong>
              <small>{screenshot ? screenshot.name : 'JPG, PNG, or WebP · maximum 5 MB'}</small>
            </span>
            <span className="subscription-proof-action">{screenshot ? 'Replace file' : 'Choose file'}</span>
          </label>
          {busy && <p role="status">Checking the amount, recipient account and transaction ID before submitting. Office approval is still required.</p>}
          {error && <p id={errorId} className="subscription-feedback error" role="alert">{error}</p>}

          <label className="subscription-payment-message"><span>Message to office <small>Optional</small></span><textarea disabled={busy} rows="2" maxLength="1000" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add a transfer reference or note for the reviewer" /></label>
        </div>
      </form>
    </Modal>
  );
}
