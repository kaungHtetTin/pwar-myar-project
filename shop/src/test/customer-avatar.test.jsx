import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CustomerEditProfile, CustomerProvider } from '../CustomerAccount';
import { request } from '../api';

vi.mock('../api', () => ({ customerToken: () => 'test-token', setCustomerToken: vi.fn(), post: vi.fn(), request: vi.fn() }));
const customer = { id: 1, name: 'Buyer', email: 'buyer@example.test', avatar_url: null };
beforeEach(() => {
  request.mockReset().mockImplementation(async path => path === '/customer/me' ? { customer } : { items: [], has_more: false });
});
afterEach(cleanup);
async function open() {
  render(<CustomerProvider><CustomerEditProfile /></CustomerProvider>);
  await screen.findByRole('button', { name: 'Change profile photo' });
}
it('uploads, replaces and removes a picture while preserving the same profile draft and form', async () => {
  await open();
  const name = screen.getByLabelText('Full name');
  fireEvent.change(name, { target: { value: 'Unsaved name' } });
  const input = screen.getByLabelText('Choose profile picture');
  const picker = vi.spyOn(input, 'click');
  fireEvent.click(screen.getByRole('button', { name: 'Change profile photo' }));
  expect(picker).toHaveBeenCalledOnce();
  request.mockImplementation(async (path, options) => options?.method === 'DELETE' ? { customer } : { customer: { ...customer, avatar_url: '/avatar/new.jpg' } });
  fireEvent.change(input, { target: { files: [new File(['image'], 'photo.png', { type: 'image/png' })] } });
  await screen.findByRole('button', { name: 'Change profile photo' });
  for (const image of screen.getAllByAltText('Your profile')) expect(image).toHaveAttribute('src', '/avatar/new.jpg');
  expect(screen.getByLabelText('Full name')).toBe(name);
  expect(name).toHaveValue('Unsaved name');
  const upload = request.mock.calls.find(([path]) => path.endsWith('/avatar'));
  expect(upload[1].body).toBeInstanceOf(FormData);
  expect(upload[1].method).toBe('POST');
  fireEvent.click(screen.getByRole('button', { name: 'Change profile photo' }));
  expect(picker).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Remove picture' }));
  await screen.findByRole('button', { name: 'Change profile photo' });
  expect(request).toHaveBeenLastCalledWith('/customer/profile/avatar', { method: 'DELETE' });
  expect(name).toHaveValue('Unsaved name');
  expect(request.mock.calls.filter(([path]) => path === '/customer/profile')).toHaveLength(0);
});
it('rejects invalid files, disables concurrent controls, and allows retry without losing a draft', async () => {
  await open();
  const input = screen.getByLabelText('Choose profile picture');
  fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPG');
  expect(request.mock.calls.filter(([path]) => path.endsWith('/avatar'))).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Retained draft' } });
  let reject;
  request.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; }));
  const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByRole('button', { name: 'Change profile photo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  reject(new Error('Upload failed'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Upload failed'));
  expect(screen.getByLabelText('Full name')).toHaveValue('Retained draft');
  request.mockResolvedValueOnce({ customer: { ...customer, avatar_url: '/retry.jpg' } });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole('button', { name: 'Change profile photo' });
});
