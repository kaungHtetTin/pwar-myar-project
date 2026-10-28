import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FilterDrawer } from './FilterDrawer';
import { RetainedViews } from './RetainedViews';

afterEach(() => vi.restoreAllMocks());

it('preserves a retained filter draft and handles Escape only on its visible page', () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const closeSource = vi.fn(), closeOther = vi.fn();
  const source = <RetainedViews activeKey="nested"><FilterDrawer open title="Source filters" onClose={closeSource}><input aria-label="Source filter draft" defaultValue="" /></FilterDrawer></RetainedViews>;
  const other = <FilterDrawer open title="Other filters" onClose={closeOther}><input aria-label="Other filter draft" /></FilterDrawer>;
  const { rerender } = render(<RetainedViews activeKey="source">{source}</RetainedViews>);
  const draft = screen.getByRole('textbox', { name: 'Source filter draft' });
  fireEvent.change(draft, { target: { value: 'Unapplied filter' } });
  rerender(<RetainedViews activeKey="other">{other}</RetainedViews>);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(closeOther).toHaveBeenCalledTimes(1);
  expect(closeSource).not.toHaveBeenCalled();
  rerender(<RetainedViews activeKey="source">{source}</RetainedViews>);
  expect(screen.getByRole('textbox', { name: 'Source filter draft' })).toBe(draft);
  expect(draft).toHaveValue('Unapplied filter');
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Source filters' })).getByRole('button', { name: 'Close filters' }));
  expect(closeSource).toHaveBeenCalledTimes(1);
  expect(closeOther).toHaveBeenCalledTimes(1);
});
