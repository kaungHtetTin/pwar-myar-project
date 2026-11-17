import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./printerProfile', () => ({ isAndroidPrinter: () => true, NativePrinter: { getConfig: vi.fn(), print: vi.fn() } }));
import { NativePrinter } from './printerProfile';
import { printHtmlDocument, printDocumentHtml } from './printing';
describe('Android native print routing', () => {
  beforeEach(() => { vi.clearAllMocks(); NativePrinter.getConfig.mockResolvedValue({ paper: '58mm' }); NativePrinter.print.mockResolvedValue({ status: 'sent' }); });
  it('uses device paper ahead of server receipt metadata and embeds fonts once', async () => {
    await printHtmlDocument({ text: 'မြန်မာစာ', paperSize: 'a4', layout: { paper_size: '80mm' } });
    const call = NativePrinter.print.mock.calls[0][0];
    expect(call.kind).toBe('receipt'); expect(call.html).toContain('@page { size: auto; margin: 0; }');
    expect(call.html).toContain('width: 58mm');
    expect(call.html.match(/unicode-range:U\+1000/g)).toHaveLength(2);
    expect(call.html).toContain('font-weight:700');
    expect(call.html).not.toContain('window.print()');
  });
  it('routes statements separately and reports native status', async () => {
    const listener = vi.fn(); window.addEventListener('mkpos:print-status', listener);
    await printDocumentHtml({ documentHtml: '<html><head></head><body>Statement</body></html>' });
    expect(NativePrinter.print).toHaveBeenCalledWith(expect.objectContaining({ kind: 'document', html: expect.stringContaining('MKPOSReceipt') }));
    expect(listener.mock.calls[0][0].detail.status).toBe('sent');
    window.removeEventListener('mkpos:print-status', listener);
  });
  it('does not print with an unreadable device profile', async () => {
    NativePrinter.getConfig.mockRejectedValueOnce(new Error('Profile unreadable'));
    await expect(printHtmlDocument({ text: 'Test' })).rejects.toThrow('Profile unreadable');
    expect(NativePrinter.print).not.toHaveBeenCalled();
  });
  it('propagates cancellation without retry', async () => {
    NativePrinter.print.mockRejectedValueOnce(new Error('Printing cancelled'));
    await expect(printHtmlDocument({ text: 'Test' })).rejects.toThrow('Printing cancelled');
    expect(NativePrinter.print).toHaveBeenCalledTimes(1);
  });
});
