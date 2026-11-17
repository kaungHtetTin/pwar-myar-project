import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ThemeSettings } from './ThemeSettings';
import { makeThemePalettes, themeRoles } from './themeRuntime';
import { api } from './api';
vi.mock('./api', () => ({ api: vi.fn() }));
const branding = { primary_color: '#0e684e', theme_mode: 'light', theme_version: 1, palettes: makeThemePalettes('#0e684e') };
beforeEach(() => api.mockReset());

it('previews both modes without applying and shows every palette role and derived colors', async () => {
  const saved = vi.fn();
  const preview = { preview_id: 'preview-1', primary_color: '#4f46e5', palettes: makeThemePalettes('#4f46e5'), rationale: 'Matching violet palette' };
  api.mockResolvedValueOnce(preview).mockResolvedValueOnce({ ...branding, ...preview, theme_mode: 'dark', theme_version: 2 });
  render(<ThemeSettings branding={branding} onSaved={saved} />);
  expect(screen.getByLabelText('Theme color inventory').children).toHaveLength(themeRoles.length);
  expect(screen.getByText(/Transparent and overlay colors/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Primary HEX'), { target: { value: '#4f46e5' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Generate with System Agent' }));
  await screen.findByText('Matching violet palette');
  expect(saved).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Dark theme preview')).toHaveStyle('--theme-primary: #4f46e5');
  fireEvent.click(screen.getByRole('button', { name: 'Apply theme to all apps' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(JSON.parse(api.mock.calls[1][1].body)).toEqual({ primary_color: '#4f46e5', theme_mode: 'dark', theme_version: 1, preview_id: 'preview-1' });
});

it('preserves a failed generation draft, reuses its key on retry and blocks duplicate requests', async () => {
  let finish;
  api.mockRejectedValueOnce(new Error('AI unavailable')).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<ThemeSettings branding={branding} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Primary theme color'), { target: { value: '#ff0000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate with System Agent' }));
  await screen.findByText('AI unavailable');
  expect(screen.getByLabelText('Primary HEX')).toHaveValue('#ff0000');
  fireEvent.click(screen.getByRole('button', { name: 'Generate with System Agent' }));
  fireEvent.click(screen.getByRole('button', { name: 'Generating…' }));
  expect(api).toHaveBeenCalledTimes(2);
  expect(JSON.parse(api.mock.calls[0][1].body).request_key).toBe(JSON.parse(api.mock.calls[1][1].body).request_key);
  await act(async () => finish({ preview_id: 'preview-2', primary_color: '#ff0000', palettes: makeThemePalettes('#ff0000'), rationale: 'Red palette' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }));
  expect(screen.getByLabelText('Primary HEX')).toHaveValue('#0e684e');
  expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked();
});

it('saves a mode-only change without generating and filters the inventory', async () => {
  api.mockResolvedValue({ ...branding, theme_mode: 'dark', theme_version: 2 });
  render(<ThemeSettings branding={branding} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find color role' }), { target: { value: 'chart' } });
  expect(screen.getByLabelText('Theme color inventory').children).toHaveLength(6);
  fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply theme to all apps' }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  expect(api.mock.calls[0][0]).toBe('/office/branding');
});

it('updates the live inventory without overwriting an unsaved draft from an older version', async () => {
  const saved = vi.fn();
  const view = render(<ThemeSettings branding={branding} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText('Primary HEX'), { target: { value: '#ff0000' } });
  const next = { primary_color:'#4f46e5', theme_mode:'dark', theme_version:2, palettes:makeThemePalettes('#4f46e5') };
  view.rerender(<ThemeSettings branding={next} onSaved={saved} />);
  await screen.findByText(/The live theme changed elsewhere/);
  expect(screen.getByLabelText('Primary HEX')).toHaveValue('#ff0000');
  expect(screen.getByRole('button', {name:'Apply theme to all apps'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button', {name:'Reset changes'}));
  expect(screen.getByLabelText('Primary HEX')).toHaveValue('#4f46e5');
  expect(screen.getByRole('radio', {name:'Dark'})).toBeChecked();
});
