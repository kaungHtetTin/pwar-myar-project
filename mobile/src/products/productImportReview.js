export const PRODUCT_IMPORT_MAX_ROWS = 5000;
export const PRODUCT_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

// Parse records, not lines: quoted names can contain commas, quotes and newlines.
function csvRecords(text) {
  const records = [];
  let cells = [], value = '', quoted = false, closedQuote = false, recordNumber = 0;
  const cell = () => { cells.push(value.trim()); value = ''; closedQuote = false; };
  const record = () => {
    cell(); cells.rowNumber = ++recordNumber;
    if (recordNumber === 1 || cells.some(Boolean)) records.push(cells);
    cells = [];
    if (records.length > PRODUCT_IMPORT_MAX_ROWS + 1) throw new Error('Import at most 5,000 products per file.');
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (character === '"') { quoted = false; closedQuote = true; }
      else value += character;
    } else if (character === ',') cell();
    else if (character === '\n' || character === '\r') {
      record();
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else if (character === '"' && !value && !closedQuote) quoted = true;
    else if (character === '"' || (closedQuote && character.trim())) throw new Error(`Invalid CSV quoting near row ${recordNumber + 1}.`);
    else if (!closedQuote) value += character;
  }
  if (quoted) throw new Error(`Unclosed quoted field near row ${recordNumber + 1}.`);
  if (value || cells.length || closedQuote) record();
  return records;
}

export function reviewProductCsv(text) {
  if (!String(text).trim()) throw new Error('Import file is empty.');
  const records = csvRecords(String(text).replace(/^\ufeff/, ''));
  if (!records.length) throw new Error('Import file is empty.');
  const headers = records[0].map(value => value.toLowerCase());
  if (!headers.includes('name')) throw new Error('The CSV must contain a Name column.');
  if (headers.some(value => !value) || new Set(headers).size !== headers.length) throw new Error('Column headings must be non-empty and unique.');
  const seen = { sku: new Map(), barcode: new Map() };
  const rows = [];
  for (const values of records.slice(1)) {
    if (!values.some(Boolean)) continue;
    const row = Object.fromEntries(headers.map((key, column) => [key, values[column] || '']));
    const errors = [];
    if (values.length !== headers.length) errors.push('The number of values does not match the column headings.');
    const get = (...keys) => keys.map(key => row[key]).find(value => value) || '';
    const length = value => Array.from(value).length;
    if (!row.name) errors.push('Product name is required.');
    for (const field of ['name', 'sku', 'barcode', 'category']) {
      if (length(row[field] || '') > 255) errors.push(`${field} must be at most 255 characters.`);
    }
    const number = (label, keys, { integer = false, min, max, fallback = 0 } = {}) => {
      let raw = get(...keys);
      if (!raw) return fallback;
      if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) raw = raw.replace(/,/g, '');
      const value = Number(raw);
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) || !Number.isFinite(value)
        || (integer && !Number.isInteger(value)) || (min !== undefined && value < min) || (max !== undefined && value > max)) {
        errors.push(`${label} must be ${integer ? 'a whole number' : 'a number'}${min !== undefined ? ` of at least ${min}` : ''}${max !== undefined ? ` and at most ${max}` : ''}.`);
      }
      return value;
    };
    const cost = number('Cost', ['cost'], { integer: true, min: 0 });
    const stock = number('Stock', ['stock']);
    number('Low stock alert', ['low stock alert', 'low_stock_alert', 'low_stock_threshold'], { min: 0 });
    const base = get('base unit', 'base_unit') || 'Unit';
    const purchase = get('purchase unit', 'purchase_unit');
    const conversion = number('Purchase conversion', ['units per purchase unit', 'purchase_conversion_factor'], { min: 1, max: 1000000, fallback: 1 });
    if (length(base) > 50 || length(purchase) > 50) errors.push('Unit names must be at most 50 characters.');
    if (purchase && base.toLowerCase() === purchase.toLowerCase()) errors.push('Purchase unit must be different from the base unit.');
    if (purchase && conversion <= 1) errors.push('Purchase conversion must be greater than one.');
    const prices = headers.filter(key => ['retail', 'wholesale', 'credit', 'price'].includes(key) || key.endsWith(' price'))
      .map(key => ({ name: key, price: number(key, [key], { integer: true, min: 0 }) }));
    let status = errors.length ? 'invalid' : 'valid';
    const messages = [...errors];
    if (!errors.length) {
      for (const field of ['sku', 'barcode']) {
        const value = (row[field] || '').toLowerCase();
        if (value && seen[field].has(value)) { status = 'skipped'; messages.push(`The ${field} repeats row ${seen[field].get(value)}.`); }
      }
      if (status === 'valid') for (const field of ['sku', 'barcode']) {
        const value = (row[field] || '').toLowerCase();
        if (value) seen[field].set(value, values.rowNumber);
      }
    }
    rows.push({ id: values.rowNumber, row_number: values.rowNumber, name: row.name, sku: row.sku || '', barcode: row.barcode || '', cost, stock, prices, status, errors: messages });
  }
  if (!rows.length) throw new Error('Import file has no product rows.');
  return { rows, total: rows.length, valid: rows.filter(row => row.status === 'valid').length,
    invalid: rows.filter(row => row.status === 'invalid').length, skipped: rows.filter(row => row.status === 'skipped').length };
}

export async function readProductCsv(file) {
  if (!/\.csv$/i.test(file.name || '')) throw new Error('Choose a CSV file.');
  if (file.size > PRODUCT_IMPORT_MAX_BYTES) throw new Error('The CSV must be no larger than 5 MB.');
  const bytes = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read the CSV file.'));
    reader.readAsArrayBuffer(file);
  });
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); }
  catch { throw new Error('Save the CSV using UTF-8 encoding.'); }
  return reviewProductCsv(text);
}
