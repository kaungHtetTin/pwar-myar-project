import { describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ requestAllPages: vi.fn() }));

import { requestAllPages } from './api';
import { csvDocument, exportFilteredCsv } from './csvExport';

describe('CSV export', () => {
  it('writes a UTF-8 BOM, escapes quotes and blocks spreadsheet formulas', () => {
    const csv = csvDocument([{ label: 'Name', value: (row) => row.name }], [
      { name: '=SUM(1,2)' },
      { name: 'A "quoted" name' },
    ]);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"A ""quoted"" name"');
  });

  it('writes ISO dates as spreadsheet text so Excel does not replace them with hashes', () => {
    const csv = csvDocument([{ label: 'Date', value: (row) => row.date }], [{ date: '2026-09-17 08:30:00' }]);
    expect(csv).toContain("'2026-09-17 08:30:00");
  });

  it('requests all matching rows from the filter-only path', async () => {
    requestAllPages.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await expect(exportFilteredCsv({
      path: '/products?q=apple', filename: 'products.csv', columns: [{ label: 'ID', value: (row) => row.id }],
    })).resolves.toBe(2);
    expect(requestAllPages).toHaveBeenCalledWith('/products?q=apple', { pageSize: 500 });
  });
});
