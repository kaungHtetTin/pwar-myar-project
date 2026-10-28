import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './api';
import { readProductCsv } from './productImportReview';

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Import paused.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

// Only retry explicit rate-limit rejections. An ambiguous timeout is resumed from
// the saved import; completed rows are never posted as new product requests.
export async function importRequest(path, options, onWait = () => {}) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await request(path, options); }
    catch (error) {
      if (error.status !== 429 || attempt >= 3 || options.signal.aborted) throw error;
      const delay = error.retryAfterMs || 60000;
      onWait(`Request limit reached. Continuing in ${Math.ceil(delay / 1000)} seconds…`);
      await wait(delay, options.signal);
    }
  }
}

export function useProductImport({ initialId, initialFile, onChanged, active = true } = {}) {
  const [summary, setSummary] = useState(null);
  const [review, setReview] = useState(() => initialFile ? { id: 0, filename: initialFile.name, file: initialFile, checking: true, rows: [], total: 0, invalid: 0, valid: 0, skipped: 0 } : null);
  const reviewVersion = useRef(0);
  const [busy, setBusy] = useState(Boolean(initialFile));
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const controller = useRef(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (!active) controller.current?.abort(); }, [active]);

  const perform = useCallback(async (action) => {
    if (controller.current && !controller.current.signal.aborted) return;
    const next = new AbortController();
    controller.current = next;
    setBusy(true); setError(''); setMessage('');
    try { await action(next.signal); }
    catch (failure) { if (!next.signal.aborted) setError(failure.message || 'Unable to continue import.'); }
    finally { if (controller.current === next) { controller.current = null; setBusy(false); setMessage(''); } }
  }, []);

  const open = useCallback((id) => perform(async signal => {
    setReview(null);
    setSummary(await importRequest(`/product-imports/${id}`, { signal }, setMessage));
  }), [perform]);

  useEffect(() => { if (initialId) open(initialId); }, [initialId, open]);

  const checkFile = useCallback((file) => perform(async signal => {
    setSummary(null);
    const id = ++reviewVersion.current;
    setReview({ id, filename: file.name, file, checking: true, rows: [], total: 0, invalid: 0, valid: 0, skipped: 0 });
    try {
      const result = await readProductCsv(file);
      if (!signal.aborted) setReview({ ...result, id, filename: file.name, file, checking: false, canUpload: result.invalid === 0 });
    } catch (failure) {
      if (!signal.aborted) setReview({ id, filename: file.name, file, checking: false, canUpload: false, rows: [], total: 0, invalid: 0, valid: 0, skipped: 0, error: failure.message });
    } finally {
      if (signal.aborted) setReview(current => current?.id === id ? { ...current, checking: false, canUpload: false, error: 'Client validation was cancelled. Select the file again.' } : current);
    }
  }), [perform]);

  useEffect(() => { if (initialFile) checkFile(initialFile); }, [initialFile, checkFile]);

  const processImport = async (initial, signal) => {
    if (initial.invalid > 0) throw new Error('Correct the issues below in your CSV, then select the corrected file.');
    let result = initial;
    let attempted = false;
    try {
      while (!signal.aborted && result.status !== 'completed') {
        attempted = true;
        result = await importRequest(`/product-imports/${initial.id}/process`, { method: 'POST', signal, timeoutMs: 120000 }, setMessage);
        if (!signal.aborted) setSummary(result);
      }
    } finally {
      // A timed-out request may already have committed. Reconcile the source
      // after every processing attempt; resuming reads the saved checkpoints.
      if (attempted) changed.current?.(result);
    }
  };

  const importReviewed = () => {
    if (!review?.canUpload || review.checking) return;
    return perform(async signal => {
      setSummary(null);
      const body = new FormData(); body.append('file', review.file);
      const result = await importRequest('/product-imports', { method: 'POST', body, signal, timeoutMs: 120000 }, setMessage);
      if (signal.aborted) return;
      setSummary(result);
      setReview(null);
      await processImport(result, signal);
    });
  };

  const run = () => perform(signal => processImport(summary, signal));

  return { summary, review, busy, error, message, open, checkFile, importReviewed, run, pause: () => controller.current?.abort(),
    reset: () => { if (!controller.current) { setSummary(null); setReview(null); setError(''); } } };
}
