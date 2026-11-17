import React, { useContext, useId, useState } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import { LocaleContext, localizeError, useText } from './i18n';
import { useEndless } from './useEndless';

export function marketplaceCategoryLabel(category, locale, path = false) {
  return locale === 'my' ? (path ? category.path_my : category.name_my) || (path ? category.path : category.name_en) : (path ? category.path : category.name_en);
}

export function MarketplaceCategoryBrowser({ onSelect, selectedId }) {
  const text = useText(), locale = useContext(LocaleContext), titleId = useId();
  const [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const list = useEndless(`/marketplace/categories?q=${encodeURIComponent(query)}`);
  return <section className="home-category-browser feature-panel" aria-labelledby={titleId}>
    <div className="feature-panel-heading"><h3 id={titleId}>{text('All categories')}</h3></div>
    <form className="home-category-search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); }}>
      <label className="sr-only" htmlFor={`${titleId}-search`}>{text('Search categories')}</label><input id={`${titleId}-search`} maxLength={120} value={search} onChange={event => setSearch(event.target.value)} placeholder={text('Search categories')} />
      <button type="submit" aria-label={text('Search categories')}><Search size={18} /></button>
    </form>
    <div className="home-category-options">{list.items.map(category => <button type="button" key={category.id} aria-pressed={category.id === selectedId} onClick={() => onSelect(category)}><span>{marketplaceCategoryLabel(category, locale, true)}</span><ChevronRight size={17} aria-hidden="true" /></button>)}</div>
    <div ref={list.sentinel} className="list-end">
      {list.busy && <p role="status">{text('Loading categories…')}</p>}
      {list.error && <p role="alert">{localizeError(locale, list.error)} <button type="button" onClick={list.retry}>{text('Try again')}</button></p>}
      {!list.busy && !list.error && !list.items.length && <p>{text('No results found.')}</p>}
      {!list.busy && !list.error && list.more && <button type="button" onClick={list.retry}>{text('Load more')}</button>}
    </div>
  </section>;
}

export function MarketplaceCategoryFilter({ value, onChange }) {
  const text = useText(), locale = useContext(LocaleContext);
  return <div>
    {value && <p>{text('Category')}: {marketplaceCategoryLabel(value, locale, true)}</p>}
    {value && <button type="button" aria-label={text('Remove category filter')} onClick={() => onChange(null)}><X size={17} /></button>}
    <MarketplaceCategoryBrowser selectedId={value?.id} onSelect={onChange} />
  </div>;
}
