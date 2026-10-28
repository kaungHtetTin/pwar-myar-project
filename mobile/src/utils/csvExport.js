import { apiRequest } from '../api/client';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

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

export async function requestAllPages(path, { pageSize = 500, maxItems = 50000 } = {}) {
  const items = [];
  let offset = 0;
  let knownTotal = null;
  while (items.length < maxItems) {
    const separator = path.includes('?') ? '&' : '?';
    const payload = await apiRequest(`${path}${separator}with_total=true&limit=${pageSize}&offset=${offset}`, { timeoutMs: 30000 });
    const pageItems = Array.isArray(payload) ? payload : payload.items || [];
    items.push(...pageItems);
    knownTotal = Array.isArray(payload) ? pageItems.length : Number(payload.total || 0);
    if (!pageItems.length || items.length >= knownTotal) break;
    offset += pageItems.length;
  }
  if (knownTotal !== null && knownTotal > items.length) throw new Error(`Export is limited to ${maxItems.toLocaleString()} records.`);
  return items;
}

function base64Text(content) {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function saveCsvFile(filename, content) {
  if (Capacitor.isNativePlatform()) {
    const path = `exports/${filename}`;
    await Filesystem.writeFile({
      path,
      data: base64Text(content),
      directory: Directory.Cache,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
    await Share.share({
      title: filename,
      dialogTitle: 'Save or share CSV',
      files: [uri],
    });
    return;
  }

  const file = new File([content], filename, { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportFilteredCsv({ path, loadRows, filename, columns, emptyMessage = 'No matching records to export.' }) {
  const rows = loadRows ? await loadRows() : await requestAllPages(path);
  if (!rows.length) throw new Error(emptyMessage);
  await saveCsvFile(filename, csvDocument(columns, rows));
  return rows.length;
}

export function csvFilename(name) {
  return `mkpos-${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
}
