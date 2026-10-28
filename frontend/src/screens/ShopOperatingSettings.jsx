import React from 'react';
import { Clock3 } from 'lucide-react';
import { Field } from '../components/common';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const defaults = () => days.map(() => ({ closed: false, opens: '09:00', closes: '18:00' }));
function shopDate(value, timezone) {
  if (!value) return '';
  if (!value.includes('Z') && !/[+-]\d\d:\d\d$/.test(value)) return value.replace(' ', 'T').slice(0, 16);
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
  const get = key => parts.find(p => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function ShopOperatingSettings({ form, change }) {
  const hours = form.opening_hours || [];
  return <section className="panel shop-operating-settings"><h2><Clock3 size={18} />Hours and announcements</h2><p>Opening hours describe service availability. Accept new orders controls ordering; a temporary closure pauses checkout until the selected time.</p><Field label="Customer announcement"><textarea maxLength={1000} value={form.announcement || ''} placeholder="Delivery updates, holiday notices or collection instructions" onChange={e => change('announcement', e.target.value)} /></Field><Field label={`Temporary closure ends (${form.timezone || 'Asia/Yangon'})`}><input type="datetime-local" value={shopDate(form.closed_until, form.timezone || 'Asia/Yangon')} onChange={e => change('closed_until', e.target.value || null)} /></Field><label className="shop-hours-enable"><input type="checkbox" checked={hours.length === 7} onChange={e => change('opening_hours', e.target.checked ? defaults() : [])} />Show weekly opening hours</label>{hours.length === 7 && <div className="table-wrap"><table className="shop-data-table shop-hours-table"><thead><tr><th>Day</th><th>Closed</th><th>Opens</th><th>Closes</th></tr></thead><tbody>{hours.map((day, i) => <tr key={i}><th scope="row">{days[i]}</th><td><input aria-label={`${days[i]} closed`} type="checkbox" checked={day.closed} onChange={e => change('opening_hours', hours.map((row, n) => n === i ? { ...row, closed: e.target.checked } : row))} /></td>{['opens', 'closes'].map(field => <td key={field}><input type="time" aria-label={`${days[i]} ${field}`} required disabled={day.closed} value={day[field]} onChange={e => change('opening_hours', hours.map((row, n) => n === i ? { ...row, [field]: e.target.value } : row))} /></td>)}</tr>)}</tbody></table></div>}</section>;
}
