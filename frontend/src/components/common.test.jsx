import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterDrawer, Modal, TablePagination } from './common';
import { RetainedFrame } from './RetainedViews';

describe('retained overlay return controls', () => {
  it.each([['modal', Modal], ['drawer', FilterDrawer]])('keeps hidden %s drafts and ignores Escape until the page resumes', (_, Overlay) => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const hiddenClose = vi.fn(), activeClose = vi.fn();
    const view = active => <>
      <RetainedFrame active={active}><RetainedFrame active><Overlay open title="Source form" onClose={hiddenClose}><input aria-label="Source draft" defaultValue="Unsent source draft" /></Overlay></RetainedFrame></RetainedFrame>
      <Overlay open title="Visible form" onClose={activeClose}><input aria-label="Visible draft" /></Overlay>
    </>;
    const { rerender } = render(view(true));
    const draft = screen.getByRole('textbox', { name: 'Source draft' });
    fireEvent.change(draft, { target: { value: 'Preserved after navigating away' } });
    rerender(view(false));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(hiddenClose).not.toHaveBeenCalled();
    expect(activeClose).toHaveBeenCalledTimes(1);
    rerender(view(true));
    expect(screen.getByRole('textbox', { name: 'Source draft' })).toBe(draft);
    expect(draft).toHaveValue('Preserved after navigating away');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Source form', exact: true })).getByRole('button', { name: /^Close/ }));
    expect(hiddenClose).toHaveBeenCalledTimes(1);
    scroll.mockRestore();
  });
});

describe('TablePagination', () => {
  it('matches the Products footer range and page controls', () => {
    const onPageChange = vi.fn();
    render(<TablePagination className="test-footer" page={2} pageSize={25} total={62} onPageChange={onPageChange} />);

    expect(screen.getByText('26-50 of 62')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange.mock.calls).toEqual([[1], [3]]);
  });

  it('disables unavailable directions and renders an empty range', () => {
    render(<TablePagination className="test-footer" page={1} pageSize={25} total={0} onPageChange={() => {}} />);

    expect(screen.getByText('0-0 of 0')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
