import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ShopCoverSettings } from './ShopCoverSettings';
vi.mock('../api', () => ({ request: vi.fn() }));
beforeEach(() => request.mockReset());

it('uploads a separate cover and leaves other storefront fields under the parent’s control', async () => {
  request.mockResolvedValue({ cover_data_url: 'data:image/png;base64,new' });
  const onChange = vi.fn(), file = new File(['image'], 'cover.png', { type: 'image/png' });
  render(<ShopCoverSettings onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Shop cover photo file'), { target: { files: [file] } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('data:image/png;base64,new'));
  expect(request.mock.calls[0][0]).toBe('/shop-admin/cover');
  expect(request.mock.calls[0][1].body.get('cover')).toBe(file);
  expect(screen.getByRole('status')).toHaveTextContent('updated');
});
it('retains the current cover after an upload error and allows retry', async () => {
  request.mockRejectedValueOnce(new Error('Invalid image')).mockResolvedValue({ cover_data_url: 'new' });
  const onChange = vi.fn(), file = new File(['image'], 'cover.png', { type: 'image/png' });
  render(<ShopCoverSettings cover="old" onChange={onChange} />);
  const input = screen.getByLabelText('Shop cover photo file');
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid image');
  expect(screen.getByAltText('Current shop cover photo')).toHaveAttribute('src', 'old');
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onChange).toHaveBeenCalledWith('new'));
});
it('rejects invalid files and opens the file picker through the edit icon', () => {
  render(<ShopCoverSettings cover="old" onChange={vi.fn()} />);
  const input = screen.getByLabelText('Shop cover photo file');
  const picker = vi.spyOn(input, 'click');
  fireEvent.click(screen.getByRole('button', { name: 'Edit shop cover photo' }));
  expect(picker).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { files: [new File(['invalid'], 'file.txt', { type: 'text/plain' })] } });
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a PNG, JPG, or WebP image up to 2 MB.');
  expect(screen.queryByRole('button', { name: 'Remove cover photo' })).not.toBeInTheDocument();
});
