import React, { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RetainedViews } from './RetainedViews';
import { PageRouteContext, RefreshRegistrationContext, usePageRefresh } from './pageRefresh';
import { publishDataChange } from './dataChanges';

afterEach(() => vi.restoreAllMocks());

function Page({ refresh }) {
  usePageRefresh(refresh);
  return <input aria-label="Draft" defaultValue="" />;
}

it('registers only the visible page for swipe refresh and reconciles an affected hidden list without resetting a form draft', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const source = vi.fn(), form = vi.fn();
  let currentRefresh;
  const register = (handler) => {
    currentRefresh = handler;
    return () => { if (currentRefresh === handler) currentRefresh = null; };
  };
  function Flow() {
    const [path, setPath] = useState('/products');
    return <RefreshRegistrationContext.Provider value={register}>
      <button onClick={() => setPath('/products/new')}>Open form</button>
      <button onClick={() => setPath('/products')}>Return</button>
      <RetainedViews activeKey={path}><PageRouteContext.Provider value={path}><Page refresh={path === '/products' ? source : form} /></PageRouteContext.Provider></RetainedViews>
    </RefreshRegistrationContext.Provider>;
  }
  render(<Flow />);
  act(() => currentRefresh());
  expect(source).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Open form'));
  const draft = screen.getByRole('textbox', { name: 'Draft' });
  fireEvent.change(draft, { target: { value: 'Keep this draft' } });
  act(() => currentRefresh());
  expect(form).toHaveBeenCalledTimes(1);
  act(() => publishDataChange('/products/7', 'PUT'));
  await waitFor(() => expect(source).toHaveBeenCalledTimes(2));
  expect(form).toHaveBeenCalledTimes(1);
  expect(draft).toHaveValue('Keep this draft');
  fireEvent.click(screen.getByText('Return'));
  expect(source).toHaveBeenCalledTimes(2);
  act(() => currentRefresh());
  expect(source).toHaveBeenCalledTimes(3);
});
