import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAiPageLink, returnFromAiPage } from './useAiPageLink';

afterEach(() => { vi.restoreAllMocks(); history.replaceState(null, '', '/'); });
function entry(id, key = id) { history.replaceState({ retained: 'draft', mkposDesktopNavigation: { module: 'settings', sourceModule: 'assistant' }, mkposAiPageLink: { module: 'settings', id, key } }, '', '/'); }

it('opens an approved section once per history activation and waits for native data', () => {
  entry('settings_receipt');
  const open = vi.fn();
  const hook = renderHook(({ ready }) => useAiPageLink('settings', open, ready), { initialProps: { ready: false } });
  expect(open).not.toHaveBeenCalled();
  hook.rerender({ ready: true });
  expect(open).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ tab: 'receipt' }));
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(open).toHaveBeenCalledTimes(1);
  act(() => { entry('settings_barcode'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(open).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'barcode' }));
  act(() => { entry('settings_unknown'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(open).toHaveBeenCalledTimes(2);
});

it('returns to the assistant on cancel and clears the cancelled form target without losing history metadata', () => {
  entry('settings_receipt');
  const back = vi.spyOn(history, 'back').mockImplementation(() => {});
  returnFromAiPage('customers_new');
  expect(back).not.toHaveBeenCalled();
  returnFromAiPage('settings_receipt');
  expect(back).toHaveBeenCalledOnce();
  expect(history.state.mkposAiPageLink).toBeUndefined();
  expect(history.state.retained).toBe('draft');
});
