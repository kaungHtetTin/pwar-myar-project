import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
import { OfflinePrinterDrawer } from './OfflinePrinterDrawer';

afterEach(() => { delete window.mkposDesktop; });
it('loads and saves device settings without a server and supports closing', async () => {
  const local = { connection: 'windows', windows: { printerName: 'Canon', copies: 1, color: true, silent: false, landscape: false }, receiptLayout: { paper_size: '58mm' } };
  window.mkposDesktop = { getPrinterConfig: vi.fn().mockResolvedValue(local), getPrinters: vi.fn().mockResolvedValue(['Canon']), savePrinterConfig: vi.fn().mockImplementation(async value => value) };
  const close = vi.fn();
  render(<OfflinePrinterDrawer settings={{ receipt_paper_size: '80mm' }} onClose={close} />);
  expect(await screen.findByLabelText('Receipt Paper')).toHaveValue('58mm');
  fireEvent.change(screen.getByLabelText('Copies'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save printer settings on this device' }));
  await waitFor(() => expect(window.mkposDesktop.savePrinterConfig).toHaveBeenCalledWith(expect.objectContaining({ windows: expect.objectContaining({ copies: 2 }), receiptLayout: expect.objectContaining({ paper_size: '58mm' }) })));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Close Printer settings' })).not.toBeDisabled());
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalledOnce();
});
