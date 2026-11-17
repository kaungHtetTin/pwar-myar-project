import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { BrandImage, applyBranding } from './platformBranding';

it('updates mounted logos, falls back when an asset fails, and restores default assets', () => {
  applyBranding({ primary_color: '#4f46e5', logo_url: null });
  render(<BrandImage src="/packaged-logo.png" alt="Platform logo" />);
  expect(screen.getByAltText('Platform logo')).toHaveAttribute('src', '/packaged-logo.png');
  act(() => applyBranding({ primary_color: '#4f46e5', logo_url: '/api/branding/assets/logo?v=1' }));
  expect(screen.getByAltText('Platform logo')).toHaveAttribute('src', '/api/branding/assets/logo?v=1');
  fireEvent.error(screen.getByAltText('Platform logo'));
  expect(screen.getByAltText('Platform logo')).toHaveAttribute('src', '/packaged-logo.png');
  act(() => applyBranding({ primary_color: '#4f46e5', logo_url: '/api/branding/assets/logo?v=2' }));
  expect(screen.getByAltText('Platform logo')).toHaveAttribute('src', '/api/branding/assets/logo?v=2');
  act(() => applyBranding({ primary_color: '#4f46e5', logo_url: null }));
  expect(screen.getByAltText('Platform logo')).toHaveAttribute('src', '/packaged-logo.png');
  expect(document.documentElement.style.getPropertyValue('--platform-primary')).toBe('#4f46e5');
});

it('rejects CSS injection and restores favicon and touch-icon sources', () => {
  const favicon = document.querySelector('link[rel="icon"]');
  const original = favicon.getAttribute('href');
  const touch = document.createElement('link'); touch.rel = 'apple-touch-icon'; touch.href = '/default-icon.png'; document.head.appendChild(touch);
  applyBranding({ primary_color: '#123456', favicon_url: '/new-favicon.png', icon_url: '/new-icon.png' });
  expect(favicon.getAttribute('href')).toBe('/new-favicon.png'); expect(touch.getAttribute('href')).toBe('/new-icon.png');
  applyBranding({ primary_color: 'red; background:url(example.test)', favicon_url: null, icon_url: null });
  expect(document.documentElement.style.getPropertyValue('--platform-primary')).toBe('#123456');
  expect(favicon.getAttribute('href')).toBe(original); expect(touch.href).toBe(new URL('/default-icon.png', window.location.href).href); touch.remove();
});
