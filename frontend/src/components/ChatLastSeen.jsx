import { subscribeDisplayClock } from '../../../shared/network/displayClock.js';
import { getBusinessTimezone } from '../timezone';
import React, { useEffect, useRef, useState } from 'react';
import { chatDate, lastSeenLabel } from '../shopChatPresentation';

export function ChatLastSeen({ active, known, value }) {
  const label = useRef(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => subscribeDisplayClock(setNow, () => !label.current?.closest('[hidden]')), []);
  return <span ref={label} title={active ? undefined : chatDate(value)?.toLocaleString(undefined, { timeZone: getBusinessTimezone() })}>{active ? 'Active now' : lastSeenLabel(value, now) || (known ? 'Offline' : 'Presence unavailable')}</span>;
}
