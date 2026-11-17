import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceHeader } from './WorkspaceHeader';

describe('workspace header', () => {
  it('renders the sidebar toggle and universal refresh action', () => {
    const onToggleSidebar = vi.fn();
    const onRefresh = vi.fn();
    render(<WorkspaceHeader collapsed onToggleSidebar={onToggleSidebar} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(onToggleSidebar).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Change language to Myanmar' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText('Demo Owner')).not.toBeInTheDocument();
    expect(screen.queryByText('Go to a page…')).not.toBeInTheDocument();
  });

  it('changes the sidebar icon to match the available drawer action', () => {
    const { rerender } = render(<WorkspaceHeader collapsed onToggleSidebar={() => {}} onRefresh={() => {}} />);
    const expandButton = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expandButton).toHaveClass('workspace-icon-button', 'workspace-menu-button');
    expect(expandButton.querySelector('.lucide-panel-left-open')).toBeInTheDocument();
    expect(expandButton.querySelector('svg')).toHaveAttribute('width', '16');
    expect(expandButton.querySelector('svg')).toHaveAttribute('height', '16');

    rerender(<WorkspaceHeader collapsed={false} onToggleSidebar={() => {}} onRefresh={() => {}} />);
    const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapseButton).toHaveClass('workspace-icon-button', 'workspace-menu-button');
    expect(collapseButton.querySelector('.lucide-panel-left-close')).toBeInTheDocument();
    expect(collapseButton.querySelector('svg')).toHaveAttribute('width', '16');
    expect(collapseButton.querySelector('svg')).toHaveAttribute('height', '16');
  });

  it('shows a contextual back action when the active page supplies one', () => {
    const onBack = vi.fn();
    render(
      <WorkspaceHeader
        collapsed
        onToggleSidebar={() => {}}
        onRefresh={() => {}}
        backAction={{ label: 'Back to Purchases', onClick: onBack }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to Purchases' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

it('shows the global shop badge and opens orders once, including zero and capped counts', () => {
  const onClick = vi.fn();
  const view = render(<WorkspaceHeader onToggleSidebar={() => {}} onRefresh={() => {}} shopAction={{ count: 12, onClick }} />);
  const button = screen.getByRole('button', { name: 'Shop, 12 orders need action' });
  expect(button).toHaveTextContent('12'); fireEvent.click(button); expect(onClick).toHaveBeenCalledOnce();
  view.rerender(<WorkspaceHeader shopAction={{ count: 120, onClick }} />);
  expect(screen.getByRole('button', { name: 'Shop, 120 orders need action' })).toHaveTextContent('99+');
  view.rerender(<WorkspaceHeader shopAction={{ count: 0, onClick }} />);
  expect(screen.getByRole('button', { name: 'Shop', exact: true }).querySelector('.workspace-chat-badge')).toBeNull();
});
