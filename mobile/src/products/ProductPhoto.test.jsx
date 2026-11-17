import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductPhoto } from './ProductPhoto.jsx';
import { apiDownload } from '../api/client';
import { productPhotos } from '../../../shared/network/productPhotos.js';
vi.mock('../api/client', () => ({ apiDownload: vi.fn() }));
afterEach(() => { productPhotos.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('defers authenticated downloads until near the viewport and shares duplicate images', async () => {
  const observers = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() {}
  });
  const create = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
  const revoke = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
  apiDownload.mockReset(); apiDownload.mockResolvedValue({ blob: async () => new Blob(["photo"]) });
  const view = render(<><ProductPhoto path="/products/1/photo?v=first" alt="First" /><ProductPhoto path="/products/1/photo?v=first" alt="Duplicate" /></>);
  expect(apiDownload).not.toHaveBeenCalled();
  await act(async () => { for (const observer of observers) observer.callback([{ isIntersecting: true }]); });
  await waitFor(() => expect(screen.getByAltText('First')).toHaveAttribute('src', 'blob:first'));
  expect(apiDownload).toHaveBeenCalledOnce(); expect(screen.getByAltText('Duplicate')).toHaveAttribute('src', 'blob:second');
  view.unmount(); expect(revoke).toHaveBeenCalledWith('blob:first'); expect(revoke).toHaveBeenCalledWith('blob:second');
});

it('loads eager previews without an observer and uses a new read after replacement', async () => {
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
  apiDownload.mockReset(); apiDownload.mockResolvedValue({ blob: async () => new Blob(["photo"]) });
  const view = render(<ProductPhoto path="/products/1/photo?v=first" alt="Preview" loading="eager" />);
  await waitFor(() => expect(screen.getByAltText('Preview')).toHaveAttribute('src', 'blob:preview'));
  view.rerender(<ProductPhoto path="/products/1/photo?v=replaced" alt="Preview" loading="eager" />);
  await waitFor(() => expect(apiDownload).toHaveBeenCalledTimes(2));
});
