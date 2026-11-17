import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn() } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { writeFile: vi.fn(), getUri: vi.fn() },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));

import { apiRequest } from '../api/client';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { csvDocument, exportFilteredCsv, requestAllPages } from './csvExport';

describe('mobile CSV export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Capacitor.isNativePlatform.mockReturnValue(false);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('keeps paging when the API caps a batch below the requested size', async () => {
    apiRequest
      .mockResolvedValueOnce({ items: [{ id: 1 }, { id: 2 }], total: 3 })
      .mockResolvedValueOnce({ items: [{ id: 3 }], total: 3 });
    await expect(requestAllPages('/expenses?q=rent')).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(apiRequest.mock.calls[1][0]).toContain('offset=2');
  });

  it('escapes unsafe spreadsheet cells', () => {
    expect(csvDocument([{ label: 'Value', value: (row) => row.value }], [{ value: '+1+1' }])).toContain("'+1+1");
  });

  it('writes ISO dates as spreadsheet text so Excel does not replace them with hashes', () => {
    expect(csvDocument([{ label: 'Date', value: (row) => row.date }], [{ date: '2026-09-17T08:30:00' }])).toContain("'2026-09-17 08:30:00");
  });

  it('writes and shares the full filtered export through native Android APIs', async () => {
    apiRequest.mockResolvedValue({ items: [{ id: 7 }], total: 1 });
    Capacitor.isNativePlatform.mockReturnValue(true);
    Filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/staff.csv' });
    Filesystem.getUri.mockResolvedValue({ uri: 'content://mkpos/cache/staff.csv' });
    Share.share.mockResolvedValue({ activityType: 'android.intent.action.SEND' });
    await expect(exportFilteredCsv({ path: '/staff', filename: 'staff.csv', columns: [{ label: 'ID', value: (row) => row.id }] })).resolves.toBe(1);
    expect(Filesystem.writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'exports/staff.csv', recursive: true }));
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ title: 'staff.csv', files: ['content://mkpos/cache/staff.csv'] }));
  });

  it('downloads directly in a browser instead of requesting share permission', async () => {
    apiRequest.mockResolvedValue({ items: [{ id: 8 }], total: 1 });
    const share = vi.fn();
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    await exportFilteredCsv({ path: '/products', filename: 'products.csv', columns: [{ label: 'ID', value: (row) => row.id }] });
    expect(share).not.toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });

  it('surfaces native share failures instead of silently pretending to download', async () => {
    apiRequest.mockResolvedValue({ items: [{ id: 9 }], total: 1 });
    Capacitor.isNativePlatform.mockReturnValue(true);
    Filesystem.writeFile.mockResolvedValue({ uri: 'file:///cache/products.csv' });
    Filesystem.getUri.mockResolvedValue({ uri: 'content://mkpos/cache/products.csv' });
    Share.share.mockRejectedValue(new Error('No share target is available.'));
    await expect(exportFilteredCsv({ path: '/products', filename: 'products.csv', columns: [{ label: 'ID', value: (row) => row.id }] })).rejects.toThrow('No share target');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
