import { expensePresetRange, formatDateInput } from '../expenses/expenseUtils';

export function blankReportFilters(now = new Date()) {
  const today = formatDateInput(now);
  return { preset: 'today', start: today, end: today };
}

export function reportPreset(preset, now = new Date()) {
  if (preset === 'last-month') {
    return { preset, start: formatDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  const range = expensePresetRange(preset, now);
  return { preset, start: range.date_from, end: range.date_to };
}

export function reportPath(path, filters) {
  const params = new URLSearchParams();
  if (filters.preset === 'all') params.set('all_time', 'true');
  else { if (filters.start) params.set('start', filters.start); if (filters.end) params.set('end', filters.end); }
  return params.size ? `${path}?${params}` : path;
}

export function grossMargin(summary) {
  return Number(summary?.sales_total || 0) ? Math.round(Number(summary.profit_estimate || 0) / Number(summary.sales_total) * 100) : 0;
}

export function reportPeriodLabel(filters) {
  if (filters.preset === 'all') return 'All time';
  const start = filters.start ? new Date(`${filters.start}T12:00:00`) : null;
  const end = filters.end ? new Date(`${filters.end}T12:00:00`) : null;
  if (!start || !end || Number.isNaN(+start) || Number.isNaN(+end)) return 'Select dates';
  const full = value => value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  if (filters.start === filters.end) return full(start);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) return `${start.getDate()}–${full(end)}`;
  return `${full(start)} – ${full(end)}`;
}
