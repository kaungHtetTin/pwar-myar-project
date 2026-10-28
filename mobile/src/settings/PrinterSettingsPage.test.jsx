import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../utils/printerProfile', async importOriginal => ({ ...await importOriginal(), isAndroidPrinter: () => true, NativePrinter: { getConfig: vi.fn(), saveConfig: vi.fn(), checkConnection: vi.fn(), listPaired: vi.fn(), openBluetoothSettings: vi.fn() } }));
vi.mock('../utils/printing', () => ({ printHtmlDocument: vi.fn() }));
vi.mock('../api/client', () => ({ apiRequest: vi.fn(), apiDownload: vi.fn() }));
import { NativePrinter, defaultPrinter } from '../utils/printerProfile';
import { printHtmlDocument } from '../utils/printing';
import { apiRequest } from '../api/client';
import { SettingsScreen } from './SettingsScreen';

describe('local Printer settings full page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    NativePrinter.getConfig.mockResolvedValue(defaultPrinter());
    NativePrinter.saveConfig.mockImplementation(async ({ config }) => config);
    NativePrinter.checkConnection.mockResolvedValue({ message: 'Connected, no receipt sent.' });
    NativePrinter.openBluetoothSettings.mockResolvedValue(undefined);
    printHtmlDocument.mockResolvedValue(true);
  });
  const open = () => render(<SettingsScreen pathname="/settings/printer" onNavigate={vi.fn()} />);
  it('opens Android pairing and reports a pairing-settings failure without submitting', async () => {
    NativePrinter.openBluetoothSettings.mockRejectedValueOnce(new Error('Open Bluetooth pairing from Android Settings.'));
    open(); fireEvent.click(await screen.findByRole('radio', { name: 'Bluetooth Classic thermal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open pairing' }));
    await screen.findByText('Open Bluetooth pairing from Android Settings.');
    fireEvent.click(screen.getByRole('button', { name: 'Open pairing' }));
    await waitFor(() => expect(NativePrinter.openBluetoothSettings).toHaveBeenCalledTimes(2));
    expect(NativePrinter.saveConfig).not.toHaveBeenCalled();
  });
  it('defaults old device profiles to Standard and saves Compatibility locally for test prints', async () => {
    const legacy = { ...defaultPrinter(), connection: 'bluetooth', address: '00:11:22:33:44:55' };
    delete legacy.bluetooth_mode;
    NativePrinter.getConfig.mockResolvedValue(legacy);
    open();
    const mode = await screen.findByLabelText('Bluetooth print mode');
    expect(mode).toHaveValue('standard');
    fireEvent.change(mode, { target: { value: 'compatibility' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    await screen.findByText('Connected, no receipt sent.');
    expect(NativePrinter.checkConnection).toHaveBeenCalledWith({ config: expect.objectContaining({ bluetooth_mode: 'compatibility' }) });
    expect(NativePrinter.saveConfig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Test print' }));
    await screen.findByText('Test data sent. Verify the text and receipt ending on your printer.');
    expect(NativePrinter.saveConfig).toHaveBeenCalledWith({ config: expect.objectContaining({ bluetooth_mode: 'compatibility', connection: 'bluetooth' }) });
    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(mode).toHaveValue('compatibility');
  });
  it('prevents duplicate jobs, retains the selected mode on failure, and allows an explicit retry', async () => {
    NativePrinter.getConfig.mockResolvedValue({ ...defaultPrinter(), connection: 'bluetooth', address: '00:11:22:33:44:55' });
    let failPrint;
    printHtmlDocument.mockImplementationOnce(() => new Promise((resolve, reject) => { failPrint = reject; }));
    open();
    fireEvent.change(await screen.findByLabelText('Bluetooth print mode'), { target: { value: 'compatibility' } });
    const test = screen.getByRole('button', { name: 'Test print' });
    fireEvent.click(test); fireEvent.click(test);
    await waitFor(() => expect(printHtmlDocument).toHaveBeenCalledTimes(1));
    expect(test).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    failPrint(new Error('Output may be partial.'));
    await screen.findByText('Output may be partial.');
    expect(screen.getByLabelText('Bluetooth print mode')).toHaveValue('compatibility');
    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    fireEvent.click(test);
    await waitFor(() => expect(printHtmlDocument).toHaveBeenCalledTimes(2));
  });
  it('leaves the printer page through Back without saving an unsaved mode', async () => {
    NativePrinter.getConfig.mockResolvedValue({ ...defaultPrinter(), connection: 'bluetooth', address: '00:11:22:33:44:55' });
    const navigate = vi.fn();
    render(<SettingsScreen pathname="/settings/printer" onNavigate={navigate} />);
    fireEvent.change(await screen.findByLabelText('Bluetooth print mode'), { target: { value: 'compatibility' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to settings' }));
    expect(navigate).toHaveBeenCalledWith('/settings');
    expect(NativePrinter.saveConfig).not.toHaveBeenCalled();
  });
  it('loads without server requests and validates before saving', async () => {
    open(); fireEvent.click(await screen.findByRole('radio', { name: 'Network thermal / emulator' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    expect(await screen.findByText('Enter an IP address or hostname, without a URL or path.')).toBeInTheDocument();
    expect(NativePrinter.saveConfig).not.toHaveBeenCalled(); expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Printer IP / hostname'), { target: { value: '192.168.1.7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
    await screen.findByText('Printer settings saved on this device only.');
    expect(NativePrinter.saveConfig).toHaveBeenCalledWith({ config: expect.objectContaining({ connection: 'tcp', host: '192.168.1.7', port: 9100 }) });
  });
  it('checks unsaved settings without printing or saving', async () => {
    open(); await screen.findByRole('radio', { name: 'Android print dialog / PDF' });
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    await screen.findByText('Connected, no receipt sent.');
    expect(NativePrinter.saveConfig).not.toHaveBeenCalled(); expect(printHtmlDocument).not.toHaveBeenCalled();
  });
  it('test prints a local Myanmar sample after saving, with no API', async () => {
    open(); await screen.findByRole('radio', { name: 'Android print dialog / PDF' });
    fireEvent.click(screen.getByRole('button', { name: 'Test print' }));
    await waitFor(() => expect(printHtmlDocument).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('မြန်မာစာ') })));
    expect(NativePrinter.saveConfig).toHaveBeenCalledTimes(1); expect(apiRequest).not.toHaveBeenCalled();
  });
  it('paginates paired devices and keeps a retry path after permission failure', async () => {
    NativePrinter.listPaired.mockRejectedValueOnce(new Error('Allow Nearby devices permission')).mockResolvedValueOnce({ items: [{ address: '00:11:22:33:44:55', name: 'Thermal One' }], total: 2 }).mockResolvedValueOnce({ items: [{ address: '00:11:22:33:44:66', name: 'Thermal Two' }], total: 2 });
    open(); fireEvent.click(await screen.findByRole('radio', { name: 'Bluetooth Classic thermal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh paired devices' }));
    await screen.findByText('Allow Nearby devices permission');
    fireEvent.click(screen.getByRole('button', { name: 'Load more / retry' }));
    await screen.findByRole('radio', { name: /Thermal One/ });
    fireEvent.click(screen.getByRole('button', { name: 'Load more / retry' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Thermal Two/ }));
    expect(NativePrinter.listPaired).toHaveBeenLastCalledWith({ offset: 1, limit: 10 });
    expect(screen.queryByRole('button', { name: 'Load more / retry' })).not.toBeInTheDocument();
  });
});
