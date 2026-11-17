import { Capacitor, registerPlugin } from '@capacitor/core';
export const NativePrinter = registerPlugin('MkposPrinter');
export const isAndroidPrinter = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export const defaultPrinter = () => ({ connection: 'system', paper: '80mm', host: '', port: 9100, address: '', copies: 1, cut: false, color: true, landscape: false, bluetooth_mode: 'standard' });
export function validatePrinter(config) {
  const errors = {};
  if (!['system', 'tcp', 'bluetooth'].includes(config.connection)) errors.connection = 'Choose a connection.';
  if (!['standard', 'compatibility'].includes(config.bluetooth_mode ?? 'standard')) errors.bluetooth_mode = 'Choose a Bluetooth print mode.';
  if (!['50mm', '58mm', '80mm', '85mm', 'a4'].includes(config.paper) || (config.connection !== 'system' && config.paper === 'a4')) errors.paper = 'Choose thermal paper for direct printing.';
  if (config.connection === 'tcp' && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,252}$/.test(config.host.trim())) errors.host = 'Enter an IP address or hostname, without a URL or path.';
  if (!Number.isInteger(Number(config.port)) || Number(config.port) < 1 || Number(config.port) > 65535) errors.port = 'Port must be 1–65535.';
  if (!Number.isInteger(Number(config.copies)) || Number(config.copies) < 1 || Number(config.copies) > 10) errors.copies = 'Copies must be 1–10.';
  if (config.connection === 'bluetooth' && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(config.address)) errors.address = 'Select a paired printer.';
  return errors;
}
export function sharedMobileSettings(payload) {
  const shared = { ...payload };
  delete shared.printer_name;
  // Android paper selection is authoritative on this device, never on the server.
  if (isAndroidPrinter()) delete shared.receipt_paper_size;
  return shared;
}
