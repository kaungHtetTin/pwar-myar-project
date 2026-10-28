import React, { useContext, useEffect, useState } from 'react';
import { LocaleContext, useText } from './i18n';

export function ChatLastSeen({ active, known, value }) {
  const text = useText(), language = useContext(LocaleContext);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const date = value ? new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`) : null;
  let label = text(known ? 'Offline' : 'Presence unavailable');
  if (date && !Number.isNaN(date.getTime())) {
    const seconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
    const [unit, divisor] = seconds < 3600 ? ['minute', 60] : seconds < 86400 ? ['hour', 3600] : seconds < 604800 ? ['day', 86400] : seconds < 2592000 ? ['week', 604800] : seconds < 31536000 ? ['month', 2592000] : ['year', 31536000];
    label = seconds < 60 ? text('Last seen just now') : text('Last seen {time}', { time: new Intl.RelativeTimeFormat(language, { numeric: 'always' }).format(-Math.floor(seconds / divisor), unit) });
  }
  return <span title={active ? undefined : date?.toLocaleString()}>{active ? text('Active now') : label}</span>;
}
