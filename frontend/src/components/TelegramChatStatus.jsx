import React from 'react';
import { Check, Clock3, CircleAlert, LoaderCircle } from 'lucide-react';

export function TelegramReceipt({ message, compact = false, onRetry, disabled = false }) {
  const delivery = message?.telegram_delivery;
  const status = delivery?.status || 'not_sent';
  const labels = {pending:'Queued for Telegram',sending:'Sending to Telegram',sent:'Sent to Telegram',failed:'Telegram send failed',
    suppressed:'Not sent to Telegram',not_sent:'Not sent to Telegram',delivery_unknown:'Telegram delivery unconfirmed'};
  const label = delivery?.partial ? 'Partly sent to Telegram' : labels[status] || labels.delivery_unknown;
  const Icon = status === 'sent' ? Check : status === 'pending' ? Clock3 : status === 'sending' ? LoaderCircle : CircleAlert;
  const title = status === 'sent' ? 'Telegram accepted this message. Read status is unavailable.' : status === 'delivery_unknown'
    ? 'Telegram may have received this message. It will not be resent automatically.' : label;
  return <span className={`shop-chat-telegram-receipt is-${status}`} title={title}>
    <span aria-label={label}><Icon size={14} aria-hidden="true" />{!compact && <span>{label}</span>}</span>
    {!compact && delivery?.can_retry && onRetry && <button type="button" className="shop-chat-telegram-retry" disabled={disabled} onClick={onRetry} aria-label={`Retry Telegram message ${message.id}`}>Retry delivery</button>}
  </span>;
}
