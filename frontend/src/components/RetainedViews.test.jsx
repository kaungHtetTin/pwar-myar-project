import React, { useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RetainedViews } from './RetainedViews';
import { usePageNavigation } from '../usePageNavigation';

afterEach(() => vi.restoreAllMocks());
function Source({ onLoad, go }) {
  const [value, setValue] = useState('');
  useEffect(() => { onLoad(); }, [onLoad]);
  return <div data-testid="source-scroller"><input aria-label="Source filter" value={value} onChange={(event) => setValue(event.target.value)} /><button onClick={go}>Open detail</button></div>;
}
function Flow({ onLoad, module }) {
  const { view, go, back } = usePageNavigation('test', { page: 'source' }, (next) => `/?page=${next.page}`, { module });
  return <><button onClick={() => back({ page: 'source' })}>Back</button><RetainedViews activeKey={view.page}>{view.page === 'source' ? <Source onLoad={onLoad} go={() => go({ page: 'detail' })} /> : <div>Detail content<button onClick={() => go({ page: 'nested' })}>Open nested</button></div>}</RetainedViews></>;
}
it('retains the mounted source, filters and history metadata through nested Back and Forward', async () => {
  window.history.replaceState({ otherMetadata: 'keep' }, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const onLoad = vi.fn(); render(<Flow onLoad={onLoad} />);
  const original = screen.getByLabelText('Source filter');
  const scroller = screen.getByTestId('source-scroller');
  scroller.scrollTo = vi.fn((left, top) => { scroller.scrollLeft = left; scroller.scrollTop = top; });
  scroller.scrollTop = 360;
  fireEvent.scroll(scroller);
  fireEvent.change(original, { target: { value: 'tea' } });
  fireEvent.click(screen.getByText('Open detail'));
  fireEvent.click(screen.getByText('Open nested'));
  scroller.scrollTop = 0;
  fireEvent.click(screen.getByText('Back'));
  await waitFor(() => expect(window.location.search).toBe('?page=detail'));
  fireEvent.click(screen.getByText('Back'));
  await waitFor(() => expect(window.location.search).toBe(''));
  expect(screen.getByLabelText('Source filter')).toBe(original);
  expect(original).toHaveValue('tea'); expect(onLoad).toHaveBeenCalledTimes(1);
  expect(scroller.scrollTop).toBe(360);
  expect(window.history.state.otherMetadata).toBe('keep');
  act(() => window.history.forward());
  await waitFor(() => expect(window.location.search).toBe('?page=detail'));
  act(() => window.history.back());
  await waitFor(() => expect(original.closest('[data-retained-view]')).not.toHaveAttribute('hidden'));
  expect(onLoad).toHaveBeenCalledTimes(1);
});
it('uses an in-app replacement fallback for a direct entry', () => {
  window.history.replaceState({}, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const back = vi.spyOn(window.history, 'back');
  render(<Flow onLoad={vi.fn()} />);
  fireEvent.click(screen.getByText('Back'));
  expect(back).not.toHaveBeenCalled(); expect(window.location.search).toBe('?page=source');
});
it('restores the retained source for an older module entry without page metadata', async () => {
  window.history.replaceState({ mkposDesktopNavigation: { module: 'products', index: 0 }, otherMetadata: 'keep' }, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const onLoad = vi.fn();
  render(<Flow onLoad={onLoad} module="products" />);
  const source = screen.getByLabelText('Source filter');
  fireEvent.change(source, { target: { value: 'Preserved filter' } });
  // Earlier module entries can predate the page navigation owner's mount.
  window.history.replaceState({ mkposDesktopNavigation: { module: 'products', index: 0 }, otherMetadata: 'keep' }, '', '/');
  fireEvent.click(screen.getByText('Open detail'));
  fireEvent.click(screen.getByText('Back'));
  await waitFor(() => expect(source.closest('[data-retained-view]')).not.toHaveAttribute('hidden'));
  expect(source).toHaveValue('Preserved filter');
  expect(onLoad).toHaveBeenCalledOnce();
  expect(window.history.state.otherMetadata).toBe('keep');
  expect(window.history.state.mkposPageNavigation.view).toEqual({ page: 'source' });
  act(() => window.history.forward());
  await waitFor(() => expect(screen.getByText('Detail content')).toBeVisible());
});
