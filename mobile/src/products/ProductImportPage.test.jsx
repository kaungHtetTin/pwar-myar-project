import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../api/client';
import { ProductImportPage } from './ProductImportPage';
import { importRequest } from './useProductImport';

vi.mock('../api/client', () => ({ apiRequest: vi.fn() }));
const preview = { id: 'import-1', filename: 'products.csv', status: 'preview', total_rows: 2, ready: 2, invalid: 0, imported: 0, skipped: 0, failed: 0 };
const results = { items: [{ id: 1, row_number: 2, name: 'Rice', status: 'ready', errors: [] }], total: 1 };

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path, options = {}) => {
    if (path === '/product-imports' && options.method === 'POST') return Promise.resolve(preview);
    if (path === '/product-imports/import-1/process') return Promise.resolve({ ...preview, status: 'completed', ready: 0, imported: 2 });
    if (path === '/product-imports/import-1') return Promise.resolve(preview);
    if (path.includes('/rows?')) return Promise.resolve(results);
    return Promise.resolve({ items: [], total: 0 });
  });
});
afterEach(() => vi.useRealTimers());

describe('server-side mobile product imports', () => {
  it('uploads once, requires confirmation, and creates products through the bulk endpoint', async () => {
    const onBack = vi.fn();
    render(<ProductImportPage onBack={onBack} />);
    fireEvent.change(screen.getByLabelText('Product CSV file'), { target: { files: [new File(['Name,Cost\nRice,100'], 'products.csv', { type: 'text/csv' })] } });
    await screen.findByText('Client validation passed.');
    const actions = screen.getByRole('group', { name: 'Import actions' });
    expect(actions.closest('.product-import-review')).toBeNull();
    expect(within(actions).getAllByRole('button')).toHaveLength(2);
    expect(within(actions).getByRole('button', { name: 'Change file' })).toBeEnabled();
    // The app-bar back arrow is the single return control during review.
    expect(screen.getAllByRole('button', { name: 'Back to products' })).toHaveLength(1);
    expect(within(actions).queryByRole('button', { name: 'Back to products' })).not.toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    fireEvent.click(within(actions).getByRole('button', { name: 'Upload CSV' }));
    await screen.findByRole('button', { name: 'Import 2 products' });
    expect(apiRequest.mock.calls.some(([path]) => path.endsWith('/process'))).toBe(false);
    const upload = apiRequest.mock.calls.find(([path, options]) => path === '/product-imports' && options?.method === 'POST');
    expect(upload[1].body).toBeInstanceOf(FormData);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 products' }));
    await screen.findByText('Import complete.');
    expect(apiRequest.mock.calls.filter(([path]) => path.endsWith('/process'))).toHaveLength(1);
    expect(apiRequest.mock.calls.some(([path]) => path === '/products')).toBe(false);
    fireEvent.click(within(actions).getByRole('button', { name: 'Done' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows server row validation and blocks confirmation', async () => {
    apiRequest.mockImplementation((path, options) => {
      if (options?.method === 'POST') return Promise.resolve({ ...preview, ready: 1, invalid: 1 });
      if (path.includes('/rows?')) return Promise.resolve({ items: [{ id: 1, row_number: 2, name: 'Rice', status: 'invalid', errors: ['The cost field must be an integer.'] }], total: 1 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<ProductImportPage onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Product CSV file'), { target: { files: [new File(['Name,Cost\nRice,100'], 'products.csv')] } });
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Upload CSV' }));
    expect(await screen.findByRole('button', { name: 'Import 1 product' })).toBeDisabled();
    expect(await screen.findByText('The cost field must be an integer.')).toBeInTheDocument();
    expect(apiRequest.mock.calls.some(([path]) => path.endsWith('/process'))).toBe(false);
  });

  it('reviews local validation errors and blocks upload without posting file content', async () => {
    render(<ProductImportPage onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Product CSV file'), { target: { files: [new File(['Name,Cost,Stock,Retail\nRice,wrong,2,200\n,100,1,200'], 'products.csv')] } });
    await screen.findByText('Client validation found invalid rows.');
    await screen.findByText('Product name is required.');
    expect(screen.getByRole('button', { name: 'Upload CSV' })).toBeDisabled();
    expect(apiRequest.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    fireEvent.change(screen.getByLabelText('Client review filter'), { target: { value: 'invalid' } });
    expect(screen.getByLabelText('Client review filter')).toHaveValue('invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Change file' }));
    await screen.findByRole('heading', { name: 'Saved imports' });
  });

  it('paginates and filters local preview rows without transmitting the CSV', async () => {
    render(<ProductImportPage onBack={vi.fn()} />);
    await screen.findByText('No saved imports.');
    apiRequest.mockClear();
    const csv = `Name,Cost,Stock,Retail\n${Array.from({ length: 45 }, (_, index) => `Preview ${index + 1},100,2,200`).join('\n')}\nBroken,wrong,2,200`;
    fireEvent.change(screen.getByLabelText('Product CSV file'), { target: { files: [new File([csv], 'products.csv')] } });
    await screen.findByText('Preview 1');
    expect(screen.queryByText('Preview 21')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more preview rows' }));
    await screen.findByText('Preview 21');
    expect(screen.getByText('Preview 1')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Client review filter'), { target: { value: 'invalid' } });
    await screen.findByText('Broken');
    expect(screen.queryByText('Preview 1')).not.toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('resumes the same saved import after an uncertain request failure', async () => {
    let calls = 0;
    apiRequest.mockImplementation(path => {
      if (path.endsWith('/process')) {
        calls++;
        if (calls === 1) return Promise.resolve({ ...preview, status: 'processing', imported: 1, ready: 1 });
        if (calls === 2) return Promise.reject(new Error('Request timed out.'));
        return Promise.resolve({ ...preview, status: 'completed', imported: 2, ready: 0 });
      }
      if (path === '/product-imports/import-1') return Promise.resolve(preview);
      return Promise.resolve(path.includes('/rows?') ? results : { items: [], total: 0 });
    });
    render(<ProductImportPage initialId="import-1" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 products' }));
    await screen.findByText(/Request timed out/);
    fireEvent.click(await screen.findByRole('button', { name: 'Resume import' }));
    await screen.findByText('Import complete.');
    expect(apiRequest.mock.calls.filter(([path]) => path.endsWith('/process')).map(([path]) => path)).toEqual(Array(3).fill('/product-imports/import-1/process'));
  });

  it('keeps pause and resume in the action footer while a request is in progress', async () => {
    let processing = 0;
    apiRequest.mockImplementation((path, options) => {
      if (path.endsWith('/process')) {
        processing += 1;
        if (processing === 1) return Promise.resolve({ ...preview, status: 'processing', imported: 1, ready: 1 });
        if (processing === 2) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Paused.')), { once: true }));
        return Promise.resolve({ ...preview, status: 'completed', imported: 2, ready: 0 });
      }
      return Promise.resolve(path === '/product-imports/import-1' ? preview : path.includes('/rows?') ? results : { items: [], total: 0 });
    });
    render(<ProductImportPage initialId="import-1" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 products' }));
    await waitFor(() => expect(processing).toBe(2));
    const actions = screen.getByRole('group', { name: 'Import actions' });
    expect(within(actions).getAllByRole('button')).toHaveLength(1);
    fireEvent.click(within(actions).getByRole('button', { name: 'Pause import' }));
    fireEvent.click(await within(actions).findByRole('button', { name: 'Resume import' }));
    await screen.findByText('Import complete.');
    expect(within(actions).getByRole('button', { name: 'Done' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('appends saved imports without losing existing entries', async () => {
    let failed = false;
    apiRequest.mockImplementation(path => {
      if (path.includes('offset=0')) return Promise.resolve({ items: [{ id: 'a', filename: 'First.csv', status: 'preview', total_rows: 1 }], total: 2 });
      if (!failed) { failed = true; return Promise.reject(new Error('Connection lost.')); }
      return Promise.resolve({ items: [{ id: 'b', filename: 'Second.csv', status: 'completed', total_rows: 2 }], total: 2 });
    });
    render(<ProductImportPage onBack={vi.fn()} />);
    await screen.findByText('First.csv');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Connection lost.');
    expect(screen.getByText('First.csv')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
    await screen.findByText('Second.csv');
    expect(screen.getByText('First.csv')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('waits for Retry-After on 429 and retries only the rejected bulk request', async () => {
    vi.useFakeTimers();
    apiRequest.mockRejectedValueOnce(Object.assign(new Error('Too Many Attempts.'), { status: 429, retryAfterMs: 2000 })).mockResolvedValueOnce(preview);
    const onWait = vi.fn();
    const controller = new AbortController();
    const pending = importRequest('/product-imports/import-1/process', { method: 'POST', signal: controller.signal }, onWait);
    await act(async () => { await Promise.resolve(); });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual(preview);
    expect(onWait).toHaveBeenCalledWith(expect.stringContaining('2 seconds'));
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('keeps controls usable after a rejected upload', async () => {
    apiRequest.mockImplementation((path, options) => options?.method === 'POST' ? Promise.reject(new Error('The CSV must contain a Name column.')) : Promise.resolve({ items: [], total: 0 }));
    render(<ProductImportPage onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Product CSV file'), { target: { files: [new File(['Name,Cost\nRice,100'], 'products.csv')] } });
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Upload CSV' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Name column'));
    expect(screen.getByLabelText('Product CSV file')).toBeEnabled();
  });
});
