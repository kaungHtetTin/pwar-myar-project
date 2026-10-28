import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider, useLanguage } from './LanguageProvider';
import { NotificationProvider, NotificationRegion, useNotifications } from './notifications';

function LanguageProbe() {
  const [showDetail, setShowDetail] = useState(false);
  const { notify } = useNotifications();
  return (
    <main>
      <h1>Products</h1>
      <input defaultValue="Products" placeholder="Search customer name or phone" />
      <button type="button" onClick={() => setShowDetail(true)}>Add</button>
      <button type="button" onClick={() => notify('Sale completed.', 'success')}>Confirm</button>
      {showDetail && <p>Delete sale</p>}
      <NotificationRegion />
    </main>
  );
}

function DraftProbe() {
  const { language, setLanguage } = useLanguage();
  const [draft, setDraft] = useState('');
  return <section>
    <h2>AI conversation messages</h2>
    <input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} />
    <button type="button" data-no-localize onClick={() => setLanguage(language === 'my' ? 'en' : 'my')}>Switch locale</button>
    <p data-no-localize title="Products">Products</p><pre>Products</pre>
  </section>;
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.setItem('mkpos.language', 'my');
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ language: 'my' }),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('preserves the mounted draft and raw evidence across language changes without refetching settings', async () => {
    render(<LanguageProvider><DraftProbe /></LanguageProvider>);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const input = screen.getByRole('textbox', { name: 'Draft' });
    fireEvent.change(input, { target: { value: 'Unsent customer reply 001234' } });
    expect(screen.getByRole('heading').textContent).toMatch(/\p{Script=Myanmar}/u);
    expect(screen.getByTitle('Products')).toHaveTextContent('Products');
    expect(screen.getAllByText('Products')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }));
    await screen.findByRole('heading', { name: 'AI conversation messages' });
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(input);
    expect(input).toHaveValue('Unsent customer reply 001234');
    fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }));
    await waitFor(() => expect(screen.getByRole('heading').textContent).toMatch(/\p{Script=Myanmar}/u));
    expect(input).toHaveValue('Unsent customer reply 001234');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('translates static, dynamic, placeholder, and notification text without changing values', async () => {
    render(
      <LanguageProvider>
        <NotificationProvider>
          <LanguageProbe />
        </NotificationProvider>
      </LanguageProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'ကုန်ပစ္စည်းများ' })).toBeInTheDocument();
    const input = screen.getByPlaceholderText('ဖောက်သည်အမည် (သို့) ဖုန်းနံပါတ်ဖြင့် ရှာရန်');
    expect(input).toHaveValue('Products');

    fireEvent.click(screen.getByRole('button', { name: 'ထည့်မည်' }));
    expect(await screen.findByText('အရောင်းမှတ်တမ်း ဖျက်မည်')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'အတည်ပြုမည်' }));
    await waitFor(() => expect(screen.getByText('ငွေရှင်းပြီးပါပြီ။')).toBeInTheDocument());
  });
});
