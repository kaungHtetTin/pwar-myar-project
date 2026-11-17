import { calendarRange } from './timezone';

export function presetDateRange(preset, now = new Date()) {
  return calendarRange(preset, now);
}

export function presetDateFromTo(preset, now = new Date()) {
  const range = presetDateRange(preset, now);
  return { date_from: range.start, date_to: range.end };
}

export function dateRangeError(start, end) {
  if (start && end && start > end) {
    return 'From date cannot be later than To date.';
  }
  return '';
}

export function reportPath(path, filters) {
  const params = new URLSearchParams();
  if (filters.preset === 'all') {
    params.set('all_time', 'true');
  } else {
    if (filters.start) params.set('start', filters.start);
    if (filters.end) params.set('end', filters.end);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
