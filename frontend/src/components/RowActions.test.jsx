import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RowActions } from './RowActions';

describe('shared row actions', () => {
  it('supports keyboard navigation, disabled actions, and focus restoration', () => {
    const action = vi.fn();
    render(<RowActions label="Sample"><button onClick={action}>View</button><button disabled>Delete</button><button>Edit</button></RowActions>);
    const trigger = screen.getByRole('button', { name: 'Actions for Sample' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'View' }));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('ignores touch hover signals and opens reliably from the resulting click', () => {
    render(<RowActions label="Touch sample"><button>View</button></RowActions>);
    const trigger = screen.getByRole('button', { name: 'Actions for Touch sample' });
    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(trigger).toHaveClass('is-open');
    expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).not.toHaveClass('is-open');
  });

  it('opens on mouse hover and lets a click pin the menu open', () => {
    vi.useFakeTimers();
    try {
      render(<RowActions label="Mouse sample"><button>View</button></RowActions>);
      const trigger = screen.getByRole('button', { name: 'Actions for Mouse sample' });
      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'View' })).not.toHaveFocus();

      fireEvent.click(trigger);
      fireEvent.pointerLeave(menu, { pointerType: 'mouse' });
      vi.advanceTimersByTime(200);
      expect(screen.getByRole('menu')).toBeInTheDocument();

      fireEvent.click(trigger);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens upward and stays inside the viewport for a bottom table row', () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.classList.contains('row-actions-trigger')) {
        return { top: 550, bottom: 578, left: 760, right: 788, width: 28, height: 28, x: 760, y: 550, toJSON() {} };
      }
      if (this.classList.contains('row-actions-menu')) {
        return { top: 0, bottom: 130, left: 0, right: 190, width: 190, height: 130, x: 0, y: 0, toJSON() {} };
      }
      return originalRect.call(this);
    };
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });

    try {
      render(<RowActions label="Bottom row"><button>View</button><button>Edit</button></RowActions>);
      fireEvent.click(screen.getByRole('button', { name: 'Actions for Bottom row' }));
      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('data-placement', 'top');
      expect(menu).toHaveStyle({ top: '416px', left: '598px' });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });
});
