import { Button } from '../components/Controls';
import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { MobileSheet } from '../components/MobilePrimitives';

function cameraErrorMessage(error) {
  const message = String(error?.name || error?.message || error || '').toLowerCase();
  if (message.includes('notallowed') || message.includes('permission') || message.includes('denied')) {
    return 'Camera permission was denied. Allow camera access in your device or browser settings, then try again.';
  }
  if (message.includes('notfound') || message.includes('devicesnotfound')) return 'No camera was found on this device.';
  if (message.includes('notreadable') || message.includes('trackstarterror')) return 'The camera is busy. Close other camera apps and try again.';
  return 'The camera could not be opened. Check camera access and try again.';
}

export function ProductPhotoCamera({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;
    setStarting(true);
    setReady(false);
    setError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setStarting(false);
      setError('Camera access is not supported by this browser. Use Choose photo instead.');
      return undefined;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false,
    }).then(async (stream) => {
      if (disposed) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!disposed) setReady(true);
    }).catch((cameraError) => {
      if (!disposed) setError(cameraErrorMessage(cameraError));
    }).finally(() => {
      if (!disposed) setStarting(false);
    });

    return () => {
      disposed = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [attempt, open]);

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Photo capture is not supported on this device.');
      return;
    }
    context.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, size, size);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('The photo could not be captured. Please try again.');
        return;
      }
      onCapture(new File([blob], 'camera-photo.jpg', { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.92);
  }

  return (
    <MobileSheet open={open} title="Take product photo" description="Center the product in the square frame, then capture the photo." onClose={onClose} className="mobile-sheet--photo-camera">
      <div className="product-photo-camera">
        <div className="product-photo-camera-view"><video ref={videoRef} muted playsInline aria-label="Product camera preview" /></div>
        {starting && <p className="product-photo-camera-status" role="status"><RefreshCw className="spin" size={18} />Starting camera…</p>}
        {error && <div className="product-photo-camera-error" role="alert"><Camera size={21} /><p>{error}</p><Button variant="secondary" type="button" className="mobile-secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</Button></div>}
        <Button variant="primary" type="button" className="mobile-primary product-photo-camera-capture" disabled={!ready || Boolean(error)} onClick={capture}><Camera size={19} />Capture photo</Button>
      </div>
    </MobileSheet>
  );
}
