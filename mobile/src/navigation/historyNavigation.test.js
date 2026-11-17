import { beforeEach, describe, expect, it } from 'vitest';
import { backSourcePath, ensureHistoryEntry, hasInAppBackEntry, isParentReturn, nextHistoryState, replacementHistoryState } from './historyNavigation';

describe('history-aware mobile navigation', () => {
  beforeEach(() => window.history.replaceState({}, '', '/suppliers/3'));

  it('tags direct entries and keeps a safe fallback index', () => {
    ensureHistoryEntry();
    expect(hasInAppBackEntry()).toBe(false);
    expect(backSourcePath('/suppliers')).toBe('/suppliers');
    expect(replacementHistoryState()).toMatchObject({ mkposHistoryIndex: 0 });
  });

  it('marks pushed routes as having an in-app back entry', () => {
    ensureHistoryEntry();
    window.history.pushState(nextHistoryState(), '', '/purchases/12');
    expect(hasInAppBackEntry()).toBe(true);
    expect(window.history.state).toMatchObject({ mkposHistoryIndex: 1 });
    expect(backSourcePath('/purchases')).toBe('/suppliers/3');
  });
  it('recognizes parent returns while preserving unrelated history metadata', () => {
    window.history.replaceState({ preserved: 'source' }, '', '/products/4/edit');
    ensureHistoryEntry();
    expect(nextHistoryState().preserved).toBe('source');
    expect(isParentReturn('/products/4/edit', '/products')).toBe(true);
    expect(isParentReturn('/settings/receipt', '/settings/printer')).toBe(false);
    expect(isParentReturn('/products', '/products/new')).toBe(false);
  });
});
