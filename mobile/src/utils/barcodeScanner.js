const PRODUCT_FORMAT_NAMES = [
  'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'CODE_93',
  'CODABAR', 'ITF', 'DATA_MATRIX', 'QR_CODE',
];

export async function startProductBarcodeScanner(elementId, onDetected) {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
  const formatsToSupport = PRODUCT_FORMAT_NAMES.map((name) => Html5QrcodeSupportedFormats[name]);
  const scanner = new Html5Qrcode(elementId, { formatsToSupport, verbose: false });

  await scanner.start(
    { facingMode: 'environment' },
    {
      fps: 10,
      aspectRatio: 1.777778,
      qrbox: (width, height) => ({
        width: Math.max(180, Math.floor(width * 0.84)),
        height: Math.max(90, Math.min(150, Math.floor(height * 0.38))),
      }),
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    },
    (decodedText) => {
      const barcode = String(decodedText || '').trim();
      if (barcode) onDetected(barcode);
    },
    () => {},
  );

  return scanner;
}

export async function stopProductBarcodeScanner(scanner) {
  if (!scanner) return;
  if (scanner.isScanning) await scanner.stop();
  scanner.clear();
}

export function barcodeScannerErrorMessage(error) {
  const message = String(error?.message || error || '').trim();
  const normalized = message.toLowerCase();

  if (normalized.includes('dynamically imported module') || normalized.includes('importing a module script')) {
    return 'The barcode scanner did not finish loading. Refresh the app and try again.';
  }
  if (normalized.includes('permission') || normalized.includes('notallowederror') || normalized.includes('denied')) {
    return 'Camera permission was denied. Allow camera access in your device or browser settings, then try again.';
  }
  if (normalized.includes('secure') || normalized.includes('https') || normalized.includes('getusermedia')) {
    return 'Camera scanning requires HTTPS or localhost in a supported browser.';
  }
  if (normalized.includes('camera') || normalized.includes('notfounderror') || normalized.includes('notreadableerror')) {
    return 'The camera is unavailable. Close other camera apps and try again.';
  }

  return message ? `Cannot scan this barcode. ${message}` : 'Cannot scan this barcode. Please try again.';
}
