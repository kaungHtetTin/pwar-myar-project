import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CatalogFilters, defaultCatalogFilters } from '../ProductDiscovery';

afterEach(cleanup);
it('keeps sort/filter controls only in the drawer, commits on Apply and restores focus/scroll lock on close', () => {
  const onChange = vi.fn();
  render(<CatalogFilters value={defaultCatalogFilters} onChange={onChange} />);
  expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Filters' }); trigger.focus(); fireEvent.click(trigger);
  const drawer = screen.getByRole('dialog', { name: 'Sort & filter' });
  fireEvent.change(within(drawer).getByLabelText('Sort by'), { target: { value: 'price_asc' } });
  fireEvent.click(within(drawer).getByLabelText('In stock only'));
  expect(onChange).not.toHaveBeenCalled(); expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(drawer).getByRole('button', { name: 'Apply filters' }));
  expect(onChange).toHaveBeenCalledWith({ ...defaultCatalogFilters, sort: 'price_asc', in_stock: true });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus(); expect(document.body.style.overflow).not.toBe('hidden');
});
it.each(['close', 'escape', 'backdrop'])('discards uncommitted changes when dismissed with %s', method => {
  const onChange = vi.fn(); render(<CatalogFilters value={defaultCatalogFilters} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'newest' } });
  if (method === 'close') fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
  if (method === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
  if (method === 'backdrop') fireEvent.mouseDown(screen.getByRole('dialog').parentElement);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Filters' })); expect(screen.getByLabelText('Sort by')).toHaveValue('default');
});
