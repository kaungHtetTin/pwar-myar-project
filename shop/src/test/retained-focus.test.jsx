import React, { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RetainedViews } from '../RetainedViews';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('makes the source inert without aria-hidden focus conflicts and restores its draft and focus on Back', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const mount = vi.fn();
  function Source({ open }) {
    const [search, setSearch] = useState('');
    useEffect(() => { mount(); }, []);
    return <><input aria-label="Product search" value={search} onChange={event => setSearch(event.target.value)} /><button onClick={open}>Open product</button></>;
  }
  function Flow() {
    const [page, setPage] = useState('source');
    return <RetainedViews activeKey={page}>{page === 'source'
      ? <Source open={() => setPage('detail')} />
      : <button onClick={() => setPage('source')}>Back to products</button>}</RetainedViews>;
  }
  render(<Flow />);
  const input = screen.getByLabelText('Product search');
  fireEvent.change(input, { target: { value: 'Rice' } });
  const launcher = screen.getByRole('button', { name: 'Open product' });
  launcher.focus();
  fireEvent.click(launcher);
  const source = launcher.closest('[data-retained-view]');
  expect(source).toHaveAttribute('hidden');
  expect(source).toHaveAttribute('inert');
  expect(source).not.toHaveAttribute('aria-hidden');
  const back = screen.getByRole('button', { name: 'Back to products' });
  back.focus();
  fireEvent.click(back);
  expect(input).toHaveValue('Rice');
  expect(launcher).toHaveFocus();
  expect(source).not.toHaveAttribute('inert');
  expect(source).not.toHaveAttribute('hidden');
  expect(mount).toHaveBeenCalledTimes(1);
});
