import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MarketplaceCategoriesPage } from './MarketplaceCategoriesPage';
import { api } from './api';

vi.mock('./api', () => ({ api: vi.fn() }));
const food = { id: 1, name_en: 'Food', name_my: 'အစားအစာ', slug: 'food', parent_id: null, parent_name_en: null, sort_order: 0, is_active: true, effective_active: true, children_count: 0, version: 1, path: 'Food' };
const listing = { items: [food], total: 1, page: 1, last_page: 1 };
beforeEach(() => {
  window.history.replaceState({}, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  api.mockReset();
  api.mockImplementation(path => Promise.resolve(path.includes('/options') ? { items: [], has_more: false } : listing));
});
afterEach(() => vi.restoreAllMocks());

it('starts a clean create form through Forward after saving and never edits the previous category', async () => {
  const writes = [];
  api.mockImplementation(async (path, options = {}) => {
    if (options.method === 'POST') { writes.push(path); return { ...food, id: 2, name_en: 'Vegetables', slug: 'vegetables' }; }
    return path.includes('/options') ? { items: [], has_more: false } : listing;
  });
  render(<MarketplaceCategoriesPage />);
  await screen.findByRole('button', { name: 'Actions for Food' });
  fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
  fireEvent.change(screen.getByLabelText('English name'), { target: { value: 'Vegetables' } });
  fireEvent.change(screen.getByLabelText('Find parent category'), { target: { value: 'Old parent search' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save category' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  act(() => window.history.forward());
  const form = await screen.findByRole('dialog', { name: 'Add marketplace category' });
  expect(within(form).getByLabelText('English name')).toHaveValue('');
  expect(within(form).getByLabelText('Find parent category')).toHaveValue('');
  fireEvent.change(within(form).getByLabelText('English name'), { target: { value: 'Drinks' } });
  fireEvent.click(within(form).getByRole('button', { name: 'Save category' }));
  await waitFor(() => expect(writes).toEqual(['/office/marketplace-categories', '/office/marketplace-categories']));
});
async function edit() {
  await screen.findByText('အစားအစာ');
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Food' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  await screen.findByLabelText('English name');
}
it('retains the list and unsaved draft through Back and Forward without refetching the list', async () => {
  render(<MarketplaceCategoriesPage />);
  await screen.findByRole('table');
  const table = screen.getByRole('table');
  await edit();
  expect(screen.getByRole('dialog', { name: 'Edit marketplace category' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toBe(table);
  const reads = () => api.mock.calls.filter(([path]) => !path.includes('/options')).length;
  const before = reads();
  fireEvent.change(screen.getByLabelText('English name'), { target: { value: 'Draft food' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('table')).toBe(table);
  expect(reads()).toBe(before);
  await act(async () => { window.history.forward(); });
  await screen.findByRole('heading', { name: 'Edit marketplace category' });
  await waitFor(() => expect(screen.getByLabelText('English name')).toHaveValue('Draft food'));
  expect(reads()).toBe(before);
});
it('preserves failed save fields, sends a version, blocks duplicates and reconciles the saved row', async () => {
  let saves = 0, finish;
  api.mockImplementation((path, options) => {
    if (options?.method === 'PUT') {
      saves++;
      if (saves === 1) return Promise.reject(new Error('Temporary failure'));
      return new Promise(resolve => { finish = resolve; });
    }
    if (path.includes('/options')) return Promise.resolve({ items: [], has_more: false });
    if (saves > 1) return new Promise(() => {});
    return Promise.resolve(listing);
  });
  render(<MarketplaceCategoriesPage />);
  await edit();
  fireEvent.change(screen.getByLabelText('English name'), { target: { value: 'Groceries' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save category' }));
  await screen.findByText('Temporary failure');
  expect(screen.getByLabelText('English name')).toHaveValue('Groceries');
  fireEvent.click(screen.getByRole('button', { name: 'Save category' }));
  fireEvent.submit(screen.getByLabelText('English name').closest('form'));
  expect(saves).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: 'Close category form' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  const [, options] = api.mock.calls.find(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(options.body)).toMatchObject({ version: 1, name_en: 'Groceries', slug: 'food' });
  await act(async () => finish({ ...food, name_en: 'Groceries', path: 'Groceries', version: 2 }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getAllByText('Groceries').length).toBeGreaterThan(0);
  expect(screen.queryByText('Loading categories…')).not.toBeInTheDocument();
});
it('opens the create form in a modal and dismisses it without saving or reloading the list', async () => {
  render(<MarketplaceCategoriesPage />);
  await screen.findByRole('table');
  const table = screen.getByRole('table');
  for (const dismiss of ['close', 'escape', 'backdrop']) {
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    const dialog = screen.getByRole('dialog', { name: 'Add marketplace category' });
    fireEvent.change(within(dialog).getByLabelText('English name'), { target: { value: 'Unsaved category' } });
    if (dismiss === 'close') fireEvent.click(within(dialog).getByRole('button', { name: 'Close category form' }));
    if (dismiss === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
    if (dismiss === 'backdrop') fireEvent.mouseDown(dialog.parentElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('table')).toBe(table);
  }
  expect(api.mock.calls.filter(([path]) => !path.includes('/options'))).toHaveLength(1);
  expect(api.mock.calls.some(([, options]) => options?.method)).toBe(false);
});
it('applies and clears drawer filters while retaining search and page size', async () => {
  render(<MarketplaceCategoriesPage />);
  await screen.findByRole('table');
  fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '10' } });
  const search = screen.getByRole('searchbox', { name: 'Search marketplace categories' });
  fireEvent.change(search, { target: { value: 'Food' } }); fireEvent.submit(search.closest('form'));
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
  fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'child' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('status=inactive&level=child&page=1&per_page=10'));
  expect(api.mock.calls.at(-1)[0]).toContain('q=Food');
  fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(api.mock.calls.at(-1)[0]).toContain('q=Food&status=all&level=all&page=1&per_page=10'));
});
it('confirms deletion, retains a server error and allows a deliberate retry', async () => {
  let deletes = 0;
  api.mockImplementation((path, options) => {
    if (options?.method === 'DELETE') {
      deletes++;
      expect(JSON.parse(options.body)).toEqual({ version: 1 });
      return deletes === 1 ? Promise.reject(new Error('Category changed. Refresh first.')) : Promise.resolve({ ok: true });
    }
    return Promise.resolve(deletes > 1 ? { ...listing, items: [], total: 0 } : listing);
  });
  render(<MarketplaceCategoriesPage />);
  await screen.findByRole('table');
  const openDelete = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Food' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  };
  openDelete(); fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
  expect(deletes).toBe(0);
  openDelete(); fireEvent.click(screen.getByRole('button', { name: 'Delete category', exact: true }));
  await screen.findByText('Category changed. Refresh first.');
  fireEvent.click(screen.getByRole('button', { name: 'Delete category', exact: true }));
  await screen.findByText('Category deleted.');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
