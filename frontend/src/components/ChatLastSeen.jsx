import { getBusinessTimezone } from '../timezone';
import React, { useEffect, useState } from 'react';
import { chatDate, lastSeenLabel } from '../shopChatPresentation';

export function ChatLastSeen({ active, known, value }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  return <span title={active ? undefined : chatDate(value)?.toLocaleString(undefined, { timeZone: getBusinessTimezone() })}>{active ? 'Active now' : lastSeenLabel(value, now) || (known ? 'Offline' : 'Presence unavailable')}</span>;
}
