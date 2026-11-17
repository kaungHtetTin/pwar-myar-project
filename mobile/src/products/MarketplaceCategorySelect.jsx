import React, { useEffect, useState } from 'react';
import { Button, Field, Select } from '../components/Controls';
import { apiRequest } from '../api/client';
import { useLocale } from '../localization/LocaleContext';

export function MarketplaceCategorySelect({ form, onChange, error }) {
  const { language } = useLocale();
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '' }));
    apiRequest('/products/marketplace-categories', { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setState({ loading: false, items: result.items || [], error: '' });
    }).catch(e => { if (!controller.signal.aborted) setState({ loading: false, items: [], error: e.message }); });
    return () => controller.abort();
  }, [attempt]);
  const value = String(form.marketplace_category_id || '');
  const path = item => (language === 'my' ? item.path_my : item.path) || item.name_en;
  const missing = value && !state.items.some(item => String(item.id) === value);
  return <Field label="Marketplace category (optional)" error={error} hint="Choose a global category for marketplace discovery. Your shop category stays separate.">
    <Select aria-label="Marketplace category (optional)" value={value} disabled={state.loading || Boolean(state.error)} onChange={event => onChange(event.target.value)}>
      <option value="">{state.loading ? 'Loading marketplace categories...' : 'No marketplace category'}</option>
      {missing && <option value={value} disabled data-no-localize>{form.marketplace_category ? path(form.marketplace_category) : `#${value}`}{!state.loading && !state.error ? ` (${language === 'my' ? 'မရရှိနိုင်ပါ' : 'Unavailable'})` : ''}</option>}
      {state.items.map(item => <option key={item.id} value={item.id} data-no-localize>{path(item)}</option>)}
    </Select>
    {state.error && <div role="alert"><p>Could not load marketplace categories.</p><Button variant="secondary" type="button" onClick={() => setAttempt(current => current + 1)}>Retry categories</Button></div>}
  </Field>;
}
