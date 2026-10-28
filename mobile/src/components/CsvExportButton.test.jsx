import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { CsvExportButton } from './CsvExportButton';

it('keeps an accessible icon-only action busy and prevents duplicate exports', async () => {
  let finish;
  const onExport = vi.fn(() => new Promise(resolve => { finish = resolve; })), onNotice = vi.fn();
  render(<CsvExportButton onExport={onExport} onNotice={onNotice} />);
  const button = screen.getByRole('button', { name: 'Export CSV' });
  expect(button.textContent).toBe('');
  fireEvent.click(button);
  fireEvent.click(button);
  expect(onExport).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  await act(async () => { finish(2); });
  expect(onNotice).toHaveBeenCalledWith({ type: 'success', text: 'Exported 2 matching records.' });
  expect(button).toBeEnabled();
});

it('reports export failure and allows retry', async () => {
  const onExport = vi.fn().mockRejectedValueOnce(new Error('Download unavailable')).mockResolvedValueOnce(1), onNotice = vi.fn();
  render(<CsvExportButton onExport={onExport} onNotice={onNotice} />);
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => expect(onNotice).toHaveBeenCalledWith({ type: 'error', text: 'Download unavailable' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  await waitFor(() => expect(onNotice).toHaveBeenCalledWith({ type: 'success', text: 'Exported 1 matching record.' }));
});
