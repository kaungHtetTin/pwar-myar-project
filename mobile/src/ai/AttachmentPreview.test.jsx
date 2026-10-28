import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiDownload } from '../api/client';
import { AttachmentPreview } from './AttachmentPreview';

vi.mock('../api/client', () => ({ apiDownload: vi.fn() }));
beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:attachment-preview');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  apiDownload.mockReset();
});
afterEach(() => vi.restoreAllMocks());

it('shows image thumbnail, type and size, and releases the preview when removed', async () => {
  const remove = vi.fn();
  const view = render(<AttachmentPreview file={new File(['image'], 'receipt.jpg', { type: 'image/jpeg' })} onRemove={remove} />);
  expect(await screen.findByRole('img', { name: 'Preview of receipt.jpg' })).toHaveAttribute('src', 'blob:attachment-preview');
  expect(screen.getByText('JPEG image · 5 B')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove attachment' }));
  expect(remove).toHaveBeenCalledOnce();
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-preview');
});

it('shows a CSV document card and loads saved images through authenticated download', async () => {
  const view = render(<AttachmentPreview file={new File(['Name\nMug'], 'products.csv')} />);
  expect(screen.getByText('CSV document · 8 B')).toBeInTheDocument();
  apiDownload.mockResolvedValue({ blob: async () => new Blob(['image'], { type: 'image/png' }) });
  const path = '/ai-assistant/conversations/12345678-abcd/messages/2/image';
  view.rerender(<AttachmentPreview attachment={{ type: 'image', name: 'saved.png', size: 2048, preview_path: path }} />);
  expect(await screen.findByRole('img', { name: 'Preview of saved.png' })).toBeVisible();
  expect(screen.getByText('PNG image · 2 KB')).toBeInTheDocument();
  expect(apiDownload).toHaveBeenCalledWith(path, { accept: 'image/*' });
});
