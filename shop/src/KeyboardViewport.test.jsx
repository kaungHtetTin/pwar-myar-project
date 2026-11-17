import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { KeyboardViewport } from './KeyboardViewport';
import { canRestoreFocus, focusPanel } from './keyboardFocus';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function viewportFixture() {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const viewport = new EventTarget();
  viewport.height = 850; viewport.scale = 1;
  vi.stubGlobal('visualViewport', viewport);
  render(<><KeyboardViewport /><input aria-label="Buyer name" defaultValue="Keep draft" /><button>Done</button></>);
  return viewport;
}

it('responds only to a keyboard-sized viewport reduction and restores after dismissal', async () => {
  const viewport = viewportFixture(), input = screen.getByLabelText('Buyer name');
  input.focus();
  viewport.height = 790; viewport.dispatchEvent(new Event('resize'));
  await waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-shop-keyboard-open'));
  viewport.height = 510; viewport.dispatchEvent(new Event('resize'));
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-shop-keyboard-open'));
  expect(document.documentElement.style.getPropertyValue('--shop-keyboard-height')).toBe('510px');
  expect(input).toHaveValue('Keep draft');
  expect(input).toHaveFocus();
  viewport.height = 850; viewport.dispatchEvent(new Event('resize'));
  await waitFor(() => expect(document.documentElement).not.toHaveAttribute('data-shop-keyboard-open'));
  expect(document.documentElement.style.getPropertyValue('--shop-keyboard-height')).toBe('');
});

it('tracks Safari keyboard panning without changing the layout viewport or losing focus', async () => {
  const viewport = viewportFixture(), input = screen.getByLabelText('Buyer name');
  input.focus();
  viewport.height = 480; viewport.offsetTop = 36;
  viewport.dispatchEvent(new Event('resize'));
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--shop-keyboard-top')).toBe('36px'));
  viewport.offsetTop = 12;
  viewport.dispatchEvent(new Event('scroll'));
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--shop-keyboard-top')).toBe('12px'));
  expect(input).toHaveFocus();
  input.blur();
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.documentElement.style.getPropertyValue('--shop-keyboard-top')).toBe('12px');
  viewport.height = 850; viewport.offsetTop = 0;
  viewport.dispatchEvent(new Event('resize'));
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--shop-keyboard-top')).toBe(''));
});

it('leaves pinch zoom and unfocused viewport resizes alone', async () => {
  const viewport = viewportFixture();
  screen.getByLabelText('Buyer name').focus();
  viewport.height = 450; viewport.scale = 2; viewport.dispatchEvent(new Event('resize'));
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.documentElement).not.toHaveAttribute('data-shop-keyboard-open');
  screen.getByLabelText('Buyer name').blur();
  viewport.scale = 1; viewport.dispatchEvent(new Event('resize'));
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.documentElement).not.toHaveAttribute('data-shop-keyboard-open');
});

it('focuses a panel button on touch devices without opening an input keyboard', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { container } = render(<section><input aria-label="Search" /><button>Close</button></section>);
  focusPanel(container, 'input');
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  expect(canRestoreFocus(screen.getByLabelText('Search'))).toBe(false);
  expect(canRestoreFocus(screen.getByRole('button'))).toBe(true);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  focusPanel(container, 'input');
  expect(screen.getByLabelText('Search')).toHaveFocus();
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Rice' } });
  expect(screen.getByLabelText('Search')).toHaveValue('Rice');
});
