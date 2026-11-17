import React from 'react';
import { Clock3, Megaphone } from 'lucide-react';
import { useText } from './i18n';
export function ShopHours({ store }) {
  const text = useText(); const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return <div className="shop-operating-info">{store.announcement && <div className="shop-announcement"><Megaphone size={18} /><p>{store.announcement}</p></div>}{store.closed_until && <p className="notice">{text('Temporarily closed until {time}', { time: new Date(store.closed_until).toLocaleString(undefined, { timeZone: store.timezone }) })}</p>}{store.opening_hours?.length > 0 && <details className="feature-panel shop-hours"><summary><Clock3 size={17} /><strong>{text(store.open_now ? 'Open now' : 'Outside opening hours')}</strong><span>{text('Opening hours')}</span></summary><small>{text('Shop time')}: {store.timezone}</small><dl>{store.opening_hours.map((day, i) => <div key={i}><dt>{text(days[i])}</dt><dd>{day.closed ? text('Closed') : `${day.opens}–${day.closes}`}</dd></div>)}</dl><small>{text('Opening hours describe service availability. Ordering availability is shown separately.')}</small></details>}</div>;
}
