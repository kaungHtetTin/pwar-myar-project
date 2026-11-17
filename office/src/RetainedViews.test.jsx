import React, { useEffect, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RetainedViews } from './RetainedViews';

afterEach(() => vi.restoreAllMocks());

it('restores each page scroll in the shared Office content container', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const view = key => <main data-testid="office-content"><RetainedViews activeKey={key}>{key === 'book' ? <p>Financial book</p> : <p>Founder settings</p>}</RetainedViews></main>;
  const { rerender } = render(view('book'));
  const scroller = screen.getByTestId('office-content');
  scroller.scrollTo = vi.fn((left, top) => { scroller.scrollLeft = left; scroller.scrollTop = top; });
  scroller.scrollTop = 180; fireEvent.scroll(scroller);
  rerender(view('founders'));
  scroller.scrollTop = 0; fireEvent.scroll(scroller);
  rerender(view('book'));
  await waitFor(() => expect(scroller.scrollTop).toBe(180));
  rerender(view('founders'));
  await waitFor(() => expect(scroller.scrollTop).toBe(0));
});

it('restores the same source, filter and internal scroll without restarting it', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const load = vi.fn();
  function Source() {
    const [filter, setFilter] = useState('');
    useEffect(() => { load(); }, []);
    return <div data-testid="source-scroll"><input aria-label="Source filter" value={filter} onChange={event => setFilter(event.target.value)} /></div>;
  }
  const source = <Source />;
  const { rerender } = render(<RetainedViews activeKey="source">{source}</RetainedViews>);
  const filter = screen.getByRole('textbox', { name: 'Source filter' });
  const scroller = screen.getByTestId('source-scroll');
  scroller.scrollTo = vi.fn((left, top) => { scroller.scrollLeft = left; scroller.scrollTop = top; });
  fireEvent.change(filter, { target: { value: 'Retained query' } });
  scroller.scrollTop = 360;
  fireEvent.scroll(scroller);
  rerender(<RetainedViews activeKey="detail"><p>Detail</p></RetainedViews>);
  scroller.scrollTop = 0;
  rerender(<RetainedViews activeKey="source">{source}</RetainedViews>);
  await waitFor(() => expect(scroller.scrollTop).toBe(360));
  expect(screen.getByRole('textbox', { name: 'Source filter' })).toBe(filter);
  expect(filter).toHaveValue('Retained query');
  expect(load).toHaveBeenCalledTimes(1);
});
