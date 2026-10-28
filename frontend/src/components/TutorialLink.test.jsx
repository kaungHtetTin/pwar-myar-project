import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TutorialLink } from './TutorialLink';
afterEach(() => { delete window.mkposDesktop; vi.restoreAllMocks(); });
it('opens the web tutorial library separately', () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  render(<TutorialLink />);
  fireEvent.click(screen.getByRole('button', { name: 'Tutorials' }));
  expect(open).toHaveBeenCalledWith('http://127.0.0.1:8000/tutorials', '_blank', 'noopener,noreferrer');
});
it('uses the Windows native opener and shows errors', async () => {
  window.mkposDesktop = { openTutorials: vi.fn().mockRejectedValue(new Error('No browser')) };
  render(<TutorialLink />);
  fireEvent.click(screen.getByRole('button', { name: 'Tutorials' }));
  await screen.findByRole('alert');
  expect(window.mkposDesktop.openTutorials).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tutorials' })).toBeEnabled());
});
