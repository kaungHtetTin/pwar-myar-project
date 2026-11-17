import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ native: true }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native, getPlatform: () => 'android' }, registerPlugin: () => ({}) }));
import { defaultPrinter, sharedMobileSettings, validatePrinter } from './printerProfile';

describe('device printer profile', () => {
  beforeEach(() => { platform.native = true; });
  it('defaults to the Android print dialog and never enables a cutter by default', () => {
    expect(validatePrinter(defaultPrinter())).toEqual({});
    expect(defaultPrinter()).toMatchObject({ connection: 'system', cut: false });
    expect(defaultPrinter().bluetooth_mode).toBe('standard');
  });
  it('accepts legacy profiles and validates the device Bluetooth mode', () => {
    const legacy = { ...defaultPrinter() }; delete legacy.bluetooth_mode;
    expect(validatePrinter(legacy)).toEqual({});
    expect(validatePrinter({ ...legacy, bluetooth_mode: 'compatibility' })).toEqual({});
    expect(validatePrinter({ ...legacy, bluetooth_mode: 'fast' }).bluetooth_mode).toBeTruthy();
  });
  it('keeps native paper and printer out of shared server settings', () => {
    expect(sharedMobileSettings({ printer_name: 'Other phone', receipt_paper_size: '58mm', receipt_footer: 'Thank you' })).toEqual({ receipt_footer: 'Thank you' });
  });
  it('preserves browser receipt paper', () => {
    platform.native = false;
    expect(sharedMobileSettings({ receipt_paper_size: '58mm' })).toEqual({ receipt_paper_size: '58mm' });
  });
  it('validates endpoints and whole-number settings', () => {
    expect(validatePrinter({ ...defaultPrinter(), connection: 'tcp', host: 'https://printer/path', port: '0', copies: '1.5', paper: 'a4' })).toEqual(expect.objectContaining({ host: expect.any(String), port: expect.any(String), copies: expect.any(String), paper: expect.any(String) }));
    expect(validatePrinter({ ...defaultPrinter(), connection: 'tcp', host: '192.168.1.25' })).toEqual({});
    expect(validatePrinter({ ...defaultPrinter(), connection: 'bluetooth' }).address).toBeTruthy();
  });
});
