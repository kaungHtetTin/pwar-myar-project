import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductBarcodeScanner } from './ProductBarcodeScanner';
import { barcodeScannerErrorMessage, startProductBarcodeScanner, stopProductBarcodeScanner } from '../utils/barcodeScanner';

vi.mock('../utils/barcodeScanner', () => ({
  startProductBarcodeScanner: vi.fn(),
  stopProductBarcodeScanner: vi.fn(() => Promise.resolve()),
  barcodeScannerErrorMessage: vi.fn(() => 'Camera permission was denied. Allow camera access in your device or browser settings, then try again.'),
}));

beforeEach(() => {
  startProductBarcodeScanner.mockReset();
  stopProductBarcodeScanner.mockClear();
  barcodeScannerErrorMessage.mockClear();
});

describe('product barcode scanner sheet', () => {
  it('offers trimmed manual entry after permission failure when enabled by the caller', async () => {
    startProductBarcodeScanner.mockRejectedValue(new Error('Permission denied'));
    const onManualBarcode=vi.fn();
    render(<ProductBarcodeScanner open onClose={vi.fn()} onDetected={vi.fn()} onManualBarcode={onManualBarcode} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button',{name:'Search product'})).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Enter barcode manually'),{target:{value:' 8851001 '}});
    fireEvent.click(screen.getByRole('button',{name:'Search product'}));
    expect(onManualBarcode).toHaveBeenCalledExactlyOnceWith('8851001');
  });
  it('opens the camera and returns the first decoded barcode', async () => {
    const scanner = { isScanning: true };
    let detect;
    startProductBarcodeScanner.mockImplementation(async (_elementId, onDetected) => {
      detect = onDetected;
      return scanner;
    });
    const onDetected = vi.fn();
    const { rerender } = render(<ProductBarcodeScanner open onClose={vi.fn()} onDetected={onDetected} />);

    expect(screen.getByRole('dialog', { name: 'Scan product barcode' })).toBeInTheDocument();
    await waitFor(() => expect(startProductBarcodeScanner).toHaveBeenCalledWith(expect.stringMatching(/^product-barcode-scanner-/), expect.any(Function)));
    detect('8851001');
    detect('8851002');
    expect(onDetected).toHaveBeenCalledTimes(1);
    expect(onDetected).toHaveBeenCalledWith('8851001');

    rerender(<ProductBarcodeScanner open={false} onClose={vi.fn()} onDetected={onDetected} />);
    await waitFor(() => expect(stopProductBarcodeScanner).toHaveBeenCalledWith(scanner));
  });

  it('shows a retry action when camera permission fails', async () => {
    startProductBarcodeScanner.mockRejectedValue(new Error('Permission denied'));
    render(<ProductBarcodeScanner open onClose={vi.fn()} onDetected={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Camera permission was denied');
    expect(barcodeScannerErrorMessage).toHaveBeenCalledWith(expect.any(Error));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(startProductBarcodeScanner).toHaveBeenCalledTimes(2));
  });

  it('supports form-specific scanner instructions', () => {
    startProductBarcodeScanner.mockImplementation(() => new Promise(() => {}));
    render(<ProductBarcodeScanner open title="Scan barcode" description="Fill the Barcode field." onClose={vi.fn()} onDetected={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Scan barcode' })).toBeInTheDocument();
    expect(screen.getByText('Fill the Barcode field.')).toBeInTheDocument();
  });
});
