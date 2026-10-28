import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

const pageSize = 20;
const rowsOf = result => Array.isArray(result) ? result : result.items || [];

export function FlashSaleProductPicker({ active, contextKey, selected, locked, single, working, loadProducts, loadCategories, onToggle, onBulk, onBusy }) {
  const [search, setSearch] = useState(''), [category, setCategory] = useState(''), [categories, setCategories] = useState([]);
  const [catalog, setCatalog] = useState({ items: [], total: 0, hasMore: false, loading: false, error: '' });
  const [bulkBusy, setBulkBusy] = useState(false), [retry, setRetry] = useState(0);
  const sequence = useRef(0), fetchedKey = useRef(null), catalogRef = useRef(catalog), selectAll = useRef(null), pending = useRef(false);
  catalogRef.current = catalog;
  const selectedIds = new Set(selected.map(product => Number(product.id)));
  const available = catalog.items.filter(product => !product.flash_sale_conflict);
  const allSelected = available.length > 0 && !catalog.hasMore && available.every(product => selectedIds.has(Number(product.id)));
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = !allSelected && catalog.items.some(product => selectedIds.has(Number(product.id))); });
  useEffect(() => {
    let live = true;
    loadCategories?.().then(value => { if (live) setCategories(value); }).catch(() => {});
    return () => { live = false; };
  }, [loadCategories]);
  useEffect(() => {
    if (!active || locked) return undefined;
    const key = JSON.stringify([search.trim(), category, retry, contextKey]);
    if (fetchedKey.current === key) return undefined;
    const id = ++sequence.current;
    fetchedKey.current = null;
    pending.current = false;
    setCatalog(value => ({ ...value, loading: true, error: '' }));
    const timer = setTimeout(async () => {
      try {
        const result = await loadProducts(search.trim(), { category, offset: 0, limit: pageSize });
        if (id !== sequence.current) return;
        const items = rowsOf(result);
        fetchedKey.current = key;
        setCatalog({ items, total: result.total || items.length, hasMore: Boolean(result.has_more), loading: false, error: '' });
      } catch (error) { if (id === sequence.current) setCatalog({ items: [], total: 0, hasMore: false, loading: false, error: error.message }); }
    }, 250);
    return () => { clearTimeout(timer); sequence.current = id + 1; };
  }, [active, locked, search, category, retry, contextKey, loadProducts]);
  async function more() {
    const current = catalogRef.current;
    if (pending.current || current.loading || !current.hasMore || bulkBusy) return;
    pending.current = true;
    const id = sequence.current;
    setCatalog(value => ({ ...value, loading: true, error: '' }));
    try {
      const result = await loadProducts(search.trim(), { category, offset: current.items.length, limit: pageSize });
      if (id === sequence.current) setCatalog(value => ({ ...value, items: [...value.items, ...rowsOf(result)], hasMore: Boolean(result.has_more), loading: false }));
    } catch (error) { if (id === sequence.current) setCatalog(value => ({ ...value, loading: false, error: error.message })); }
    finally { if (id === sequence.current) pending.current = false; }
  }
  async function toggleAll(checked) {
    if (!checked) { onBulk(catalog.items, false); return; }
    if (catalog.total > 100) { setCatalog(value => ({ ...value, error: 'Select up to 100 products. Narrow the search or category before selecting all.' })); return; }
    setBulkBusy(true); onBusy(true);
    try {
      let items = catalog.items, hasMore = catalog.hasMore;
      while (hasMore) {
        const result = await loadProducts(search.trim(), { category, offset: items.length, limit: pageSize });
        const next = rowsOf(result);
        if (!next.length) throw new Error('Could not load all matching products. Try again.');
        items = [...items, ...next]; hasMore = Boolean(result.has_more);
        if (items.length > 100) throw new Error('Select up to 100 products. Narrow your filters first.');
      }
      onBulk(items.filter(product => !product.flash_sale_conflict), true);
      setCatalog(value => ({ ...value, items, hasMore: false, error: '' }));
    } catch (error) { setCatalog(value => ({ ...value, error: error.message })); }
    finally { setBulkBusy(false); onBusy(false); }
  }
  const rows = locked ? selected : catalog.items;
  const disabled = working || locked || bulkBusy;
  return <section hidden={!active} className="purchase-wizard-section purchase-product-step shop-flash-product-step" aria-label="Product selection">
    <div className="purchase-product-filters"><label className="purchase-product-search"><Search size={17} /><input aria-label="Search flash sale products" maxLength={255} disabled={disabled} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, SKU, barcode, or category" /></label><select aria-label="Product category" value={category} disabled={disabled} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></div>
    <div className="purchase-product-table-frame" aria-busy={catalog.loading || bulkBusy}>
      <div className="purchase-product-select-header"><span className="purchase-product-check-cell"><input ref={selectAll} type="checkbox" aria-label="Select all matching products" checked={allSelected} disabled={disabled || single || catalog.loading || !catalog.total || (!catalog.hasMore && !available.length)} onChange={event => toggleAll(event.target.checked)} /></span><span>Product</span><span>Category</span><span>Stock</span><span>Online price</span><span>Online unit</span></div>
      <div className="purchase-product-picker" onScroll={event => { const node = event.currentTarget; if (node.scrollHeight - node.scrollTop - node.clientHeight < 100) more(); }}>
        <div className="purchase-product-select-list" role="listbox" aria-label="Flash sale products" aria-multiselectable={!single}>{rows.map(product => {
          const checked = selectedIds.has(Number(product.id)), price = product.unit === 'purchase' ? product.purchase_price : product.base_price;
          const blocked = disabled || catalog.loading || Boolean(product.flash_sale_conflict && !checked);
          const toggle = () => { if (!blocked) onToggle(product, !checked); };
          return <div key={product.id} role="option" aria-label={product.name} aria-selected={checked} aria-disabled={blocked} tabIndex={blocked ? -1 : 0} className={`purchase-product-select-row${checked ? ' selected' : ''}${product.flash_sale_conflict ? ' is-promoted' : ''}`} onClick={toggle} onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); toggle(); } }}>
            <span className="purchase-product-check-cell"><input type="checkbox" aria-label={`Select ${product.name}`} disabled={blocked} checked={checked} onClick={event => event.stopPropagation()} onChange={toggle} /></span><span title={product.flash_sale_conflict ? `Already promoted: ${product.flash_sale_conflict.name}` : product.name}><strong>{product.name}</strong>{product.flash_sale_conflict && <small className="shop-flash-conflict">Already promoted: {product.flash_sale_conflict.name}</small>}</span><span>{product.category || 'Uncategorized'}</span><span>{product.stock ?? '—'} {product.base_unit || ''}</span><span>{price == null ? '—' : Number(price).toLocaleString()}</span><span>{product.unit === 'purchase' ? product.purchase_unit || 'Purchase unit' : product.base_unit || 'Base unit'}</span>
          </div>;
        })}</div>
        {catalog.loading && <p role="status" className="purchase-product-picker-loading">Loading products…</p>}
        {bulkBusy && <p role="status">Selecting products…</p>}
        {catalog.error && <p role="alert">{catalog.error} <button type="button" disabled={disabled} onClick={() => { if (catalog.items.length && catalog.hasMore) more(); else setRetry(value => value + 1); }}>Retry products</button></p>}
        {!catalog.loading && !catalog.error && !rows.length && <p className="shop-list-end">No matching published products.</p>}
        {catalog.hasMore && !catalog.error && <button type="button" className="purchase-product-load-more" disabled={catalog.loading || disabled} onClick={more}>Load more products</button>}
      </div>
    </div>
    <div className="shop-flash-selection-summary"><span>{selected.length} product{selected.length === 1 ? '' : 's'} selected</span><span>{locked ? 'Used sales keep their original product.' : `${catalog.total} matching · Select up to ${single ? 1 : 100} products`}</span></div>
  </section>;
}
