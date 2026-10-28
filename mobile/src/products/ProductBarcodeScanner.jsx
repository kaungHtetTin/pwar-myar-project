import { Button, Input } from '../components/Controls';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { MobileSheet } from '../components/MobilePrimitives';
import { barcodeScannerErrorMessage, startProductBarcodeScanner, stopProductBarcodeScanner } from '../utils/barcodeScanner';

export function ProductBarcodeScanner({
  open,
  onClose,
  onDetected,
  title = 'Scan product barcode',
  description = 'Point the rear camera at the barcode. The product search will run automatically.',
  onManualBarcode,
  manualLabel = 'Enter barcode manually',
  manualSubmitLabel = 'Search product',
}) {
  const scannerId = `product-barcode-scanner-${useId().replaceAll(':', '')}`;
  const scannerRef = useRef(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;
    detectedRef.current = false;
    setStarting(true);
    setError('');

    startProductBarcodeScanner(scannerId, (barcode) => {
      if (disposed || detectedRef.current) return;
      detectedRef.current = true;
      onDetectedRef.current(barcode);
    }).then((scanner) => {
      if (disposed) void stopProductBarcodeScanner(scanner);
      else scannerRef.current = scanner;
    }).catch((scannerError) => {
      if (!disposed) setError(barcodeScannerErrorMessage(scannerError));
    }).finally(() => {
      if (!disposed) setStarting(false);
    });

    return () => {
      disposed = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      void stopProductBarcodeScanner(scanner);
    };
  }, [attempt, open, scannerId]);

  return (
    <MobileSheet
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className="mobile-sheet--barcode-scanner"
    >
      <div className={`product-barcode-scanner${error && onManualBarcode ? ' has-manual-error' : ''}`}>
        <div id={scannerId} className="product-barcode-scanner-view" aria-label="Camera barcode scanner" />
        {starting && <p className="product-barcode-scanner-status" role="status"><RefreshCw className="spin" size={18} />Starting camera…</p>}
        {error && <div className="product-barcode-scanner-error" role="alert">{onManualBarcode ? <CameraOff size={28} /> : <Camera size={22} />}<p>{error}</p><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</Button></div>}
        {error && onManualBarcode && <form className="retail-scanner-manual" onSubmit={event=>{event.preventDefault();if(manualBarcode.trim()) onManualBarcode(manualBarcode.trim());}}><label>{manualLabel}<Input aria-label={manualLabel} value={manualBarcode} onChange={event=>setManualBarcode(event.target.value)} autoComplete="off" /></label><Button variant="primary" type="submit" className="mobile-primary" disabled={!manualBarcode.trim()}>{manualSubmitLabel}</Button></form>}
        {(!error || !onManualBarcode) && <p className="product-barcode-scanner-help">Keep the barcode inside the frame and hold the camera steady.</p>}
      </div>
    </MobileSheet>
  );
}
