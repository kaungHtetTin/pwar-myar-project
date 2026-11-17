import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductPhotoCamera } from './ProductPhotoCamera';

const stop = vi.fn();
const getUserMedia = vi.fn();

beforeEach(() => {
  stop.mockReset();
  getUserMedia.mockReset();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('product photo camera', () => {
  it('requests the rear camera and stops it when the sheet closes', async () => {
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
    const { rerender } = render(<ProductPhotoCamera open onClose={vi.fn()} onCapture={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Take product photo' })).toBeInTheDocument();
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      video: expect.objectContaining({ facingMode: { ideal: 'environment' } }),
      audio: false,
    })));

    rerender(<ProductPhotoCamera open={false} onClose={vi.fn()} onCapture={vi.fn()} />);
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });

  it('shows a retry action when camera permission is denied', async () => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('Denied'), { name: 'NotAllowedError' }));
    render(<ProductPhotoCamera open onClose={vi.fn()} onCapture={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Camera permission was denied');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});

