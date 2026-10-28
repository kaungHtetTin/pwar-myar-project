import { Select } from '../components/Controls';
import React from 'react';
import { ShopField } from './ShopPrimitives';

export function ShopDatePresets({ timezone = 'Asia/Rangoon', onChange }) {
  function choose(value) {
    if (!value) return;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(p => [p.type, p.value]));
    const today = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
    let start = new Date(today), end = new Date(today);
    if (value === 'yesterday') { start.setUTCDate(start.getUTCDate() - 1); end = new Date(start); }
    if (value === 'last7') start.setUTCDate(start.getUTCDate() - 6);
    if (value === 'last30') start.setUTCDate(start.getUTCDate() - 29);
    if (value === 'thisweek') start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
    if (value === 'thisyear') { start.setUTCMonth(0); start.setUTCDate(1); }
    if (value === 'thismonth') start.setUTCDate(1);
    if (value === 'lastmonth') { end.setUTCDate(0); start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)); }
    onChange({ date_from: start.toISOString().slice(0, 10), date_to: end.toISOString().slice(0, 10) });
  }
  return <ShopField name="date-preset" label="Date range"><Select value="" onChange={e => choose(e.target.value)}><option value="">Custom dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option><option value="thisweek">This week</option><option value="thismonth">This month</option><option value="lastmonth">Last month</option><option value="thisyear">This year</option></Select></ShopField>;
}
