import { beforeEach, expect, it, vi } from 'vitest';
import { clearOfficeNavigation, normalizeOfficePage, officePageFromHash, officePageHash, readOfficeNavigation, restoreOfficeNavigation, writeOfficeNavigation } from './officeNavigation';

const admin = { id: 12, role: 'super_admin' };
beforeEach(() => { vi.restoreAllMocks(); window.sessionStorage.clear(); window.history.replaceState({}, '', '/office/'); });

it('restores each supported page and detail URL without server path routing', () => {
  for (const page of [{ tab: 'ai-requests' }, { tab: 'ai-usage' }, { tab: 'error-reports' }, { tab: 'founders' }, { tab: 'financial-book' }, { tab: 'business-detail', businessId: 11 }, { tab: 'settings', settingsTab: 'ai-assistant' }]) {
    expect(officePageFromHash(officePageHash(page), admin)).toEqual(normalizeOfficePage(page, admin));
  }
  window.history.replaceState({}, '', '/mkpos/office/?lang=en#/ai/balance-book');
  const state = readOfficeNavigation(admin);
  writeOfficeNavigation(state, admin);
  expect(window.location.pathname).toBe('/mkpos/office/');
  expect(window.location.search).toBe('?lang=en');
  expect(state.entries[0].tab).toBe('ai-requests');
});

it('restores navigation metadata after reload while keeping history state small and preserving unrelated markers', () => {
  window.history.replaceState({ fixture: 'keep' }, '', '/office/');
  const initial = readOfficeNavigation(admin);
  const state = { ...initial, entries: [...initial.entries, { tab: 'businesses', businessId: null }, { tab: 'business-detail', businessId: 11, alertTarget: { secret: 'must not persist' } }], index: 2 };
  writeOfficeNavigation(state, admin);
  const restored = readOfficeNavigation(admin);
  expect(restored.index).toBe(2);
  expect(restored.entries[2]).toEqual({ tab: 'business-detail', businessId: 11 });
  expect(restored.key).toBe(state.key);
  expect(window.history.state.fixture).toBe('keep');
  expect(Object.keys(window.history.state.mkposOffice).sort()).toEqual(['index', 'key', 'scope']);
  expect(Object.values(window.sessionStorage).join('')).not.toContain('must not persist');
  window.history.replaceState({ ...window.history.state, mkposOffice: { ...window.history.state.mkposOffice, index: 1 } }, '', '/office/#/businesses');
  expect(restoreOfficeNavigation(restored, admin).index).toBe(1);
});

it('rejects invalid or unauthorized destinations and never resumes another account history', () => {
  const regular = { id: 13, role: 'admin' };
  for (const path of ['#/admins', '#/branding', '#/ai/usage-report', '#/ai/balance-book', '#/ai/skills', '#/ai/agent-assignments', '#/businesses/-1', '#/businesses/9007199254740993', '#/%invalid', '#/unknown']) {
    expect(officePageFromHash(path, regular).tab).toBe('overview');
  }
  expect(officePageFromHash('#/settings/ai-assistant', regular).settingsTab).toBe('account');
  expect(officePageFromHash('#/settings/telegram-support', regular).settingsTab).toBe('account');
  expect(officePageFromHash('#/settings/telegram-support', admin).settingsTab).toBe('telegram-support');
  expect(officePageFromHash('#/system/server-health', admin).tab).toBe('server-health');
  expect(officePageFromHash('#/system/server-health', regular).tab).toBe('overview');
  for (const section of ['ai-provider','ai-pricing']) {
    expect(officePageFromHash(`#/settings/${section}`, regular).settingsTab).toBe('account');
    expect(officePageFromHash(`#/settings/${section}`, admin).settingsTab).toBe(section);
  }
  const state = readOfficeNavigation(admin);
  writeOfficeNavigation({ ...state, entries: [{ tab: 'overview' }, { tab: 'founders' }], index: 1 }, admin);
  const other = readOfficeNavigation(regular);
  expect(other.key).not.toBe(state.key);
  expect(other.entries).toHaveLength(1);
});

it('continues from the URL when storage is blocked, and logout clears only the current account routes', () => {
  const state = readOfficeNavigation(admin);
  writeOfficeNavigation(state, admin);
  window.sessionStorage.setItem('another-app', 'keep');
  clearOfficeNavigation(admin);
  expect(window.location.hash).toBe('');
  expect(window.history.state.mkposOffice).toBeUndefined();
  expect(window.sessionStorage.getItem('another-app')).toBe('keep');
  window.history.replaceState({}, '', '/office/#/founders');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked storage'); });
  expect(readOfficeNavigation(admin).entries[0].tab).toBe('founders');
});
