import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requestDownload } from '../api';
import { ShopChatImage } from './ShopChatImages';

vi.mock('../api', () => ({ requestDownload: vi.fn() }));
const OriginalURL = URL;
const create = vi.fn(() => 'blob:chat-image'), revoke = vi.fn();
beforeEach(() => {
  create.mockClear(); revoke.mockClear(); requestDownload.mockReset();
  vi.stubGlobal('URL', class extends OriginalURL { static createObjectURL = create; static revokeObjectURL = revoke; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('shows an expired placeholder without requesting the file', () => {
  render(<ShopChatImage message={{ image: { status: 'expired', expires_at: '2026-01-01 00:00:00' } }} path="/private/image" />);
  expect(screen.getByText('Image expired')).toBeInTheDocument();
  expect(requestDownload).not.toHaveBeenCalled();
});

it('loads a private image and revokes the blob when the fourteen-day expiry is reached', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
  requestDownload.mockResolvedValue({ blob: new Blob(['image'], { type: 'image/webp' }) });
  render(<ShopChatImage message={{ image: { status: 'available', expires_at: '2026-10-06T12:00:01Z' } }} path="/private/image" />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole('img', { name: 'Chat image' })).toHaveAttribute('src', 'blob:chat-image');
  expect(requestDownload).toHaveBeenCalledWith('/private/image', { accept: 'image/*', timeoutMs: 30000 });
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByText('Image expired')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(revoke).toHaveBeenCalledWith('blob:chat-image');
});
