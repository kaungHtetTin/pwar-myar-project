import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomerAuth, CustomerProvider, useCustomer } from '../CustomerAccount';
import { RetainedViews } from '../RetainedViews';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

it('keeps a hidden sign-in draft from redirecting the source page after an account update', async () => {
  localStorage.clear();
  window.history.replaceState({}, '', '#/cart');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  function Flow() {
    const [page, setPage] = useState('login');
    const { setCustomer } = useCustomer();
    return <>
      <button onClick={() => setPage('cart')}>Open cart</button>
      <button onClick={() => setPage('login')}>Return to sign in</button>
      <button onClick={() => setCustomer({ id: 1, name: 'Updated customer' })}>Update account</button>
      <RetainedViews activeKey={page}>{page === 'login' ? <CustomerAuth next="/store/demo" /> : <p>Retained cart</p>}</RetainedViews>
    </>;
  }
  render(<CustomerProvider><Flow /></CustomerProvider>);
  const email = screen.getByLabelText('Email');
  fireEvent.change(email, { target: { value: 'Unsubmitted@example.test' } });
  fireEvent.click(screen.getByText('Open cart'));
  fireEvent.click(screen.getByText('Update account'));
  await act(async () => {});
  expect(window.location.hash).toBe('#/cart');
  expect(email).toHaveValue('Unsubmitted@example.test');
  fireEvent.click(screen.getByText('Return to sign in'));
  await waitFor(() => expect(window.location.hash).toBe('#/store/demo'));
  expect(screen.getByLabelText('Email')).toBe(email);
});
