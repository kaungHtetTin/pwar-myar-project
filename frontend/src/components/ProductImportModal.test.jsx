import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api';
import { ProductImportModal } from './ProductImportModal';

vi.mock('../api', () => ({ request: vi.fn() }));
const preview = { id: 'import-1', filename: 'products.csv', status: 'preview', total_rows: 1, ready: 1, invalid: 0, imported: 0, skipped: 0, failed: 0 };
beforeEach(() => {
  request.mockReset();
  request.mockImplementation((path, options) => {
    if (path === '/product-imports' && options?.method === 'POST') return Promise.resolve(preview);
    if (path.endsWith('/process')) return Promise.resolve({ ...preview, status: 'completed', imported: 1, ready: 0 });
    if (path.includes('/rows?')) return Promise.resolve({ items: [{ id: 1, row_number: 2, name: 'Rice', status: 'ready', errors: [] }], total: 1 });
    return Promise.resolve({ items: [], total: 0 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('desktop product import', () => {
  it('reviews locally then uploads and imports with one click, without a server table', async () => {
    const onChanged = vi.fn(), onClose = vi.fn();
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={onChanged} onClose={onClose} />);
    await screen.findByText('Client validation passed.');
    expect(screen.queryByLabelText('Product CSV file')).not.toBeInTheDocument();
    expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await screen.findByText('Import complete.');
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
    expect(request.mock.calls.filter(([path, options]) => path === '/product-imports' && options?.method === 'POST')).toHaveLength(1);
    expect(request.mock.calls.filter(([path]) => path.endsWith('/process'))).toHaveLength(1);
    expect(request.mock.calls.some(([path]) => path.includes('/rows?'))).toBe(false);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Server validation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import 1 product' })).not.toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path === '/products')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks invalid local rows and never uploads the file', async () => {
    render(<ProductImportModal file={new File(['Name,Cost,Stock,Retail\nRice,bad,2,100\n,20,1,50'], 'products.csv')} onChanged={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Client validation found invalid rows.');
    expect(screen.getByText('Product name is required.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
    expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Saved imports' }));
    await screen.findByRole('heading', { name: 'Saved imports' });
  });

  it('loads a saved import and blocks invalid rows', async () => {
    request.mockImplementation(path => {
      if (path === '/product-imports/import-1') return Promise.resolve({ ...preview, ready: 0, invalid: 1 });
      if (path.includes('/rows?')) return Promise.resolve({ items: [{ id: 1, row_number: 2, name: '', status: 'invalid', errors: ['Product name is required.'] }], total: 1 });
      return Promise.resolve({ items: [preview], total: 1 });
    });
    render(<ProductImportModal onChanged={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'products.csv · preview · 1 rows' }));
    expect(await screen.findByText('Product name is required.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path.includes('issues_only=true'))).toBe(true);
    expect(request.mock.calls.some(([path]) => path.endsWith('/process'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Saved imports' }));
    await screen.findByRole('heading', { name: 'Saved imports' });
  });

  it('loads review rows on scroll and filters with horizontal radio controls without uploads', async () => {
    const observers = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
      observe(node) { this.node = node; }
      disconnect() {}
    });
    const csv = `Name,SKU,Cost,Stock,Retail\n${Array.from({ length: 45 }, (_, index) => `Preview ${index + 1},P${index + 1},100,2,200`).join('\n')}\nRepeated,P1,100,2,200\nBroken,BAD,wrong,2,200`;
    render(<ProductImportModal file={new File([csv], 'products.csv')} onChanged={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Preview 1');
    expect(screen.queryByText('Preview 21')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    const observer = observers.find(item => item.node?.textContent.includes('20 of 47 rows'));
    expect(observer.options.root.classList.contains('mkpos-modal-body')).toBe(true);
    act(() => { observer.callback([{ isIntersecting: true }]); observer.callback([{ isIntersecting: true }]); });
    await screen.findByText('Preview 40');
    expect(screen.queryByText('Preview 41')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Duplicate/ }));
    await screen.findByText('Repeated');
    expect(screen.queryByText('Preview 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Invalid/ }));
    await screen.findByText('Broken');
    fireEvent.click(screen.getByRole('radio', { name: /^All/ }));
    await screen.findByText('Preview 1');
    expect(screen.queryByText('Preview 21')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('continues all chunks automatically and resumes the same import after interruption', async () => {
    const onChanged = vi.fn();
    let processCalls = 0;
    request.mockImplementation((path, options) => {
      if (path === '/product-imports' && options?.method === 'POST') return Promise.resolve({ ...preview, total_rows: 101, ready: 101 });
      if (path.endsWith('/process')) {
        processCalls += 1;
        if (processCalls === 2) return Promise.reject(new Error('Connection interrupted.'));
        const imported = Math.min((processCalls > 2 ? processCalls - 1 : processCalls) * 50, 101);
        return Promise.resolve({ ...preview, total_rows: 101, ready: 101 - imported, imported, status: imported === 101 ? 'completed' : 'processing' });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={onChanged} onClose={vi.fn()} />);
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await screen.findByText(/Connection interrupted/);
    expect(screen.getByText('50 imported')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Import progress' })).toHaveAttribute('value', '50');
    fireEvent.click(screen.getByRole('button', { name: 'Resume import' }));
    await screen.findByText('Import complete.');
    expect(processCalls).toBe(4);
    expect(request.mock.calls.filter(([path, options]) => path === '/product-imports' && options?.method === 'POST')).toHaveLength(1);
    expect(request.mock.calls.filter(([path]) => path.endsWith('/process')).every(([path]) => path === '/product-imports/import-1/process')).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('guards repeated clicks while upload is pending', async () => {
    let finishUpload;
    request.mockImplementation((path, options) => {
      if (path === '/product-imports' && options?.method === 'POST') return new Promise(resolve => { finishUpload = resolve; });
      if (path.endsWith('/process')) return Promise.resolve({ ...preview, status: 'completed', imported: 1, ready: 0 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Client validation passed.');
    const button = screen.getByRole('button', { name: 'Import', exact: true });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    await act(async () => finishUpload(preview));
    await screen.findByText('Import complete.');
    expect(request.mock.calls.filter(([path]) => path.endsWith('/process'))).toHaveLength(1);
  });

  it('pauses processing and resumes saved progress without another upload', async () => {
    let processCalls = 0;
    const onChanged = vi.fn();
    request.mockImplementation((path, options) => {
      if (path === '/product-imports' && options?.method === 'POST') return Promise.resolve({ ...preview, total_rows: 51, ready: 51 });
      if (path.endsWith('/process')) {
        processCalls += 1;
        if (processCalls === 2) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Paused.')), { once: true }));
        return Promise.resolve({ ...preview, total_rows: 51, ready: processCalls === 1 ? 1 : 0, imported: processCalls === 1 ? 50 : 51, status: processCalls === 1 ? 'processing' : 'completed' });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={onChanged} onClose={vi.fn()} />);
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await waitFor(() => expect(processCalls).toBe(2));
    fireEvent.click(screen.getByRole('button', { name: 'Pause import' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Resume import' }));
    await screen.findByText('Import complete.');
    expect(request.mock.calls.filter(([path, options]) => path === '/product-imports' && options?.method === 'POST')).toHaveLength(1);
    expect(onChanged).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('retries rate-limited processing automatically without another confirmation', async () => {
    let processCalls = 0;
    const implementation = request.getMockImplementation();
    request.mockImplementation((path, options) => {
      if (path.endsWith('/process') && ++processCalls === 1) return Promise.reject(Object.assign(new Error('Too many attempts.'), { status: 429, retryAfterMs: 1 }));
      return implementation(path, options);
    });
    const onChanged = vi.fn();
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={onChanged} onClose={vi.fn()} />);
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await screen.findByText('Import complete.');
    expect(processCalls).toBe(2);
    expect(onChanged).toHaveBeenCalledOnce();
    expect(request.mock.calls.filter(([path, options]) => path === '/product-imports' && options?.method === 'POST')).toHaveLength(1);
  });

  it('keeps the local review when upload fails and retries with the same file', async () => {
    request.mockRejectedValueOnce(new Error('Upload failed.'));
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={vi.fn()} onClose={vi.fn()} />);
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await screen.findByText('Upload failed.');
    expect(screen.getByText('Rice')).toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path.endsWith('/process'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await screen.findByText('Import complete.');
  });

  it('shows actionable issues without processing when server checks reject locally valid data', async () => {
    const onChanged = vi.fn();
    request.mockImplementation((path, options) => {
      if (path === '/product-imports' && options?.method === 'POST') return Promise.resolve({ ...preview, ready: 0, invalid: 1 });
      if (path.includes('/rows?issues_only=true')) return Promise.resolve({ items: [{ id: 1, row_number: 2, name: 'Rice', status: 'invalid', errors: ['Member price must be a whole number.'] }], total: 1 });
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={onChanged} onClose={vi.fn()} />);
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await screen.findByText('Member price must be a whole number.');
    expect(screen.getByText('Row 2 (Rice):')).toBeInTheDocument();
    expect(request.mock.calls.some(([path]) => path.endsWith('/process'))).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Server validation')).not.toBeInTheDocument();
  });

  it('reopens an already completed file without processing again', async () => {
    const onChanged = vi.fn();
    request.mockResolvedValue({ ...preview, ready: 0, imported: 1, status: 'completed' });
    render(<ProductImportModal file={new File(['Name,Cost\nRice,100'], 'products.csv')} onChanged={onChanged} onClose={vi.fn()} />);
    await screen.findByText('Client validation passed.');
    fireEvent.click(screen.getByRole('button', { name: 'Import', exact: true }));
    await screen.findByText('Import complete.');
    expect(request).toHaveBeenCalledOnce();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('loads saved imports endlessly and preserves entries after a next-page failure', async () => {
    const observers = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe(node) { this.node = node; }
      disconnect() {}
    });
    let failed = false;
    request.mockImplementation(path => {
      if (path.startsWith('/product-imports?')) {
        const offset = Number(new URL(path, 'http://localhost').searchParams.get('offset'));
        if (offset === 20 && !failed) { failed = true; return Promise.reject(new Error('Connection interrupted.')); }
        return Promise.resolve({ total: 45, items: Array.from({ length: Math.min(20, 45 - offset) }, (_, index) => ({ ...preview, id: `saved-${offset + index + 1}`, filename: `Saved ${offset + index + 1}.csv` })) });
      }
      return Promise.resolve({ items: [], total: 0 });
    });
    render(<ProductImportModal onChanged={vi.fn()} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: /Saved 20.csv/ });
    act(() => observers.find(item => item.node?.textContent.includes('20 of 45 imports')).callback([{ isIntersecting: true }]));
    await screen.findByText('Connection interrupted.');
    expect(screen.getByRole('button', { name: /Saved 1.csv/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading imports' }));
    await screen.findByRole('button', { name: /Saved 40.csv/ });
    expect(screen.getByRole('button', { name: /Saved 1.csv/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load more/ })).not.toBeInTheDocument();
  });
});
