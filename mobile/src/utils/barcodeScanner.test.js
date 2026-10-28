import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Html5Qrcode } from 'html5-qrcode';
import { barcodeScannerErrorMessage, startProductBarcodeScanner, stopProductBarcodeScanner } from './barcodeScanner';

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn(),
  Html5QrcodeSupportedFormats: {
    EAN_13: 9, EAN_8: 10, UPC_A: 14, UPC_E: 15, CODE_128: 5, CODE_39: 3,
    CODE_93: 4, CODABAR: 2, ITF: 8, DATA_MATRIX: 6, QR_CODE: 0,
  },
}));

const scanner = { start: vi.fn(), stop: vi.fn(), clear: vi.fn(), isScanning: true };

beforeEach(() => {
  scanner.start.mockReset().mockResolvedValue(undefined);
  scanner.stop.mockReset().mockResolvedValue(undefined);
  scanner.clear.mockReset();
  scanner.isScanning = true;
  Html5Qrcode.mockReset().mockImplementation(function Html5QrcodeMock() { return scanner; });
});

describe('barcode scanner', () => {
  it('uses the rear camera and returns a trimmed scan value', async () => {
    const onDetected = vi.fn();
    await startProductBarcodeScanner('reader', onDetected);
    const success = scanner.start.mock.calls[0][2];
    success(' 8851001 ');

    expect(Html5Qrcode).toHaveBeenCalledWith('reader', expect.objectContaining({ verbose: false }));
    expect(scanner.start).toHaveBeenCalledWith(
      { facingMode: 'environment' },
      expect.objectContaining({ fps: 10, experimentalFeatures: { useBarCodeDetectorIfSupported: true } }),
      expect.any(Function),
      expect.any(Function),
    );
    expect(onDetected).toHaveBeenCalledWith('8851001');
  });

  it('stops the camera and clears its preview', async () => {
    await stopProductBarcodeScanner(scanner);
    expect(scanner.stop).toHaveBeenCalledTimes(1);
    expect(scanner.clear).toHaveBeenCalledTimes(1);
  });

  it('turns common camera failures into actionable messages', () => {
    expect(barcodeScannerErrorMessage(new Error('error loading dynamically imported module'))).toMatch(/Refresh the app/);
    expect(barcodeScannerErrorMessage(new Error('Permission denied'))).toMatch(/Allow camera access/);
    expect(barcodeScannerErrorMessage(new Error('getUserMedia requires secure context'))).toMatch(/HTTPS or localhost/);
    expect(barcodeScannerErrorMessage(new Error('Camera NotReadableError'))).toMatch(/camera is unavailable/i);
  });
});
