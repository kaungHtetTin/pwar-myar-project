import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useKeyboardViewport } from './useKeyboardViewport';

function Fixture() {
  useKeyboardViewport();
  return <textarea aria-label="Message" defaultValue="Keep draft" />;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('tracks keyboard resize and panning, retains the frame through send blur, and clears on dismissal', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 850, scale: 1, offsetTop: 0 });
  vi.stubGlobal('visualViewport', viewport);
  const { unmount } = render(<Fixture />);
  const input = screen.getByLabelText('Message');
  input.focus();
  viewport.height = 790;
  viewport.dispatchEvent(new Event('resize'));
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.documentElement).not.toHaveAttribute('data-mobile-keyboard-open');
  viewport.height = 490;
  viewport.offsetTop = 24;
  viewport.dispatchEvent(new Event('resize'));
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-mobile-keyboard-open'));
  expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('490px');
  expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-top')).toBe('24px');
  viewport.offsetTop = 12;
  viewport.dispatchEvent(new Event('scroll'));
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-top')).toBe('12px'));
  expect(input).toHaveFocus();
  expect(input).toHaveValue('Keep draft');
  input.blur();
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.documentElement).toHaveAttribute('data-mobile-keyboard-open');
  viewport.height = 850;
  viewport.dispatchEvent(new Event('resize'));
  await waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-mobile-keyboard-open'));
  expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-height')).toBe('');
  input.focus();
  viewport.height = 490;
  viewport.scale = 2;
  viewport.dispatchEvent(new Event('resize'));
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.documentElement).not.toHaveAttribute('data-mobile-keyboard-open');
  unmount();
  expect(document.documentElement.style.getPropertyValue('--mobile-keyboard-top')).toBe('');
});
