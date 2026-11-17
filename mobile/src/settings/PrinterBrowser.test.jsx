import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrinterSettingsPage } from './PrinterSettingsPage';
import { printHtmlDocument } from '../utils/printing';
vi.mock('../utils/printerProfile', async original => ({ ...await original(), isAndroidPrinter: () => false }));
vi.mock('../utils/printing', () => ({ printHtmlDocument: vi.fn() }));
describe('browser printer fallback', () => {
  it('reports blocked print windows and allows retry without server configuration', async () => {
    printHtmlDocument.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<PrinterSettingsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test print' }));
    expect(await screen.findByText('Allow pop-ups to print.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Test print' }));
    await waitFor(() => expect(printHtmlDocument).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Test print' })).toBeEnabled());
    expect(screen.queryByLabelText('Connection')).not.toBeInTheDocument();
  });
});
