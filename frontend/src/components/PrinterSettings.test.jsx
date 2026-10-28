import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrinterSettings } from './PrinterSettings';

const config = {
  connection: 'windows', documentPrinterName: '',
  windows: { printerName: 'Canon', silent: false, copies: 1, color: true, landscape: false, duplex: 'simplex', media: 'document', scale: 100, margins: 'none', dpi: 0 },
  tcp: { host: '127.0.0.1', port: 9100 },
  bluetooth: { port: '', baudRate: 9600, dataBits: 8, stopBits: 'One', parity: 'None', handshake: 'None', dtr: false, rts: false },
  thermal: { widthDots: 0, threshold: 180, imageMode: 'raster', feedLines: 3, cut: 'none', copies: 1, timeoutMs: 30000, chunkSize: 512, chunkDelayMs: 10 },
};
function Fixture({ onSave = vi.fn(), initial = config }) {
  const [current, setCurrent] = useState(initial);
  const [paper, setPaper] = useState('58mm');
  return <PrinterSettings config={current} onChange={setCurrent} paper={paper} onPaperChange={setPaper} printers={['Canon', 'Epson', 'escpos://127.0.0.1:9100']} onRefresh={vi.fn()} onSave={() => onSave(current)} />;
}
afterEach(() => { delete window.mkposDesktop; });
describe('PrinterSettings', () => {
  it('only exposes familiar options, with technical controls removed in every mode', () => {
    render(<Fixture />);
    expect(screen.getByRole('group', { name: 'Save and check printer' })).toHaveClass('printer-settings-save-actions');
    expect(screen.getByRole('button', { name: 'Save printer settings on this device' })).toHaveClass('primary');
    expect(screen.getByRole('button', { name: 'Check connection (no printing)' })).toHaveClass('printer-check-button');
    expect(screen.getByRole('option', { name: 'A5 / Normal Printer' })).toBeEnabled();
    expect(screen.getByLabelText('Copies')).toBeInTheDocument();
    expect(screen.queryByLabelText(/DPI|Print scale|Paper handling|Two-sided/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Connection type'), { target: { value: 'tcp' } });
    expect(screen.getByRole('option', { name: 'A5 / Normal Printer' })).toBeDisabled();
    expect(screen.getByLabelText('TCP port')).toHaveValue(9100);
    expect(screen.queryByLabelText(/Printable width|image command|threshold|timeout|chunk/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Connection type'), { target: { value: 'bluetooth' } });
    expect(screen.queryByLabelText(/Baud|Data bits|Parity|Flow control|DTR|RTS/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Manual port selection'));
    expect(screen.getByRole('combobox', { name: 'Outgoing Bluetooth COM port' })).toBeInTheDocument();
  });
  it('shows mode-specific fields, retains each destination, and saves locally', async () => {
    const onSave = vi.fn(); render(<Fixture onSave={onSave} />);
    expect(screen.getByRole('combobox', { name: 'Printer Name' })).toHaveValue('Canon');
    fireEvent.change(screen.getByLabelText('Connection type'), { target: { value: 'tcp' } });
    expect(screen.queryByRole('combobox', { name: 'Printer Name' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Printer host / IP address'), { target: { value: '192.168.1.50' } });
    fireEvent.change(screen.getByLabelText('TCP port'), { target: { value: '9200' } });
    fireEvent.change(screen.getByLabelText('Connection type'), { target: { value: 'bluetooth' } });
    expect(screen.queryByLabelText('Printer host / IP address')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Manual port selection'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Outgoing Bluetooth COM port' }), { target: { value: 'COM5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save printer settings on this device' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ connection: 'bluetooth', bluetooth: expect.objectContaining({ port: 'COM5' }), tcp: { host: '192.168.1.50', port: 9200 }, windows: expect.objectContaining({ printerName: 'Canon' }) })));
  });
  it('checks the current destination without saving or printing, and reports failures', async () => {
    window.mkposDesktop = { checkPrinter: vi.fn().mockRejectedValue(new Error("Error invoking remote method 'desktop:check-printer': Error: Connection refused")) };
    const save = vi.fn(); render(<Fixture onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Check connection (no printing)' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection refused');
    expect(screen.getByRole('alert')).not.toHaveTextContent('remote method');
    expect(save).not.toHaveBeenCalled();
  });
  it('lists paired COM ports and explains when no serial devices are available', async () => {
    window.mkposDesktop = { listSerialPorts: vi.fn().mockResolvedValue({ items: [] }) };
    render(<Fixture />);
    fireEvent.change(screen.getByLabelText('Connection type'), { target: { value: 'bluetooth' } });
    expect(await screen.findByText(/No COM ports found/)).toBeInTheDocument();
    expect(screen.getByText(/BLE-only printers/)).toBeInTheDocument();
  });

  it('discovers on entry and automatically selects a single identified Bluetooth printer', async () => {
    window.mkposDesktop = { listSerialPorts: vi.fn().mockResolvedValue({ items: [
      { port: 'COM1', bluetooth: false, printerName: '' },
      { port: 'COM4', bluetooth: true, printerName: 'Xprinter XP-80' },
      { port: 'COM5', bluetooth: true, printerName: '' },
    ] }) };
    const save = vi.fn();
    render(<Fixture onSave={save} initial={{ ...config, connection: 'bluetooth' }} />);
    await waitFor(() => expect(screen.getByLabelText('Bluetooth printer')).toHaveValue('COM4'));
    expect(screen.getByText(/Selected Xprinter XP-80 automatically/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save printer settings on this device' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ bluetooth: expect.objectContaining({ port: 'COM4' }) })));
  });

  it('requires a printer choice when multiple printers are identified and keeps that choice on refresh', async () => {
    window.mkposDesktop = { listSerialPorts: vi.fn().mockResolvedValue({ items: [
      { port: 'COM4', bluetooth: true, printerName: 'Till one' },
      { port: 'COM6', bluetooth: true, printerName: 'Till two' },
    ] }) };
    render(<Fixture initial={{ ...config, connection: 'bluetooth' }} />);
    await screen.findByText(/Several Bluetooth printers found/);
    expect(screen.getByLabelText('Bluetooth printer')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Bluetooth printer'), { target: { value: 'COM6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Bluetooth printers' }));
    await screen.findByText('Selected port: COM6.');
    expect(screen.getByLabelText('Bluetooth printer')).toHaveValue('COM6');
  });

  it('does not guess from an unidentified Bluetooth port or replace a saved port', async () => {
    window.mkposDesktop = { listSerialPorts: vi.fn().mockResolvedValue({ items: [{ port: 'COM4', bluetooth: true, printerName: '' }] }) };
    const view = render(<Fixture initial={{ ...config, connection: 'bluetooth' }} />);
    await screen.findByText(/No printer port could be identified automatically/);
    expect(screen.getByLabelText('Bluetooth printer')).toHaveValue('');
    view.unmount();
    window.mkposDesktop.listSerialPorts.mockResolvedValue({ items: [{ port: 'COM4', bluetooth: true, printerName: 'Other printer' }] });
    render(<Fixture initial={{ ...config, connection: 'bluetooth', bluetooth: { ...config.bluetooth, port: 'COM6' } }} />);
    await screen.findByText('Selected port: COM6.');
    expect(screen.getByLabelText('Bluetooth printer')).toHaveValue('COM6');
  });
});
