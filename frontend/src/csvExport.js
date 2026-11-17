import { requestAllPages } from './api';

export function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(text)) text = `'${text.replace('T', ' ')}`;
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvDocument(columns, rows) {
  const header = columns.map(({ label }) => csvCell(label)).join(',');
  const body = rows.map((row) => columns.map(({ value }) => csvCell(value(row))).join(','));
  return `\ufeff${[header, ...body].join('\r\n')}\r\n`;
}

export function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function exportFilteredCsv({ path, loadRows, filename, columns, emptyMessage = 'No matching records to export.' }) {
  const rows = loadRows ? await loadRows() : await requestAllPages(path, { pageSize: 500 });
  if (!rows.length) throw new Error(emptyMessage);
  downloadCsv(filename, csvDocument(columns, rows));
  return rows.length;
}

export function csvFilename(name) {
  return `mkpos-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
}
