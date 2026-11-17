import React, { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, BookOpen, CircleDollarSign, Eye, Settings2, ShieldBan, Users } from 'lucide-react';
import { api } from './api';
import { OfficePageToolbar } from './OfficePageToolbar';
import {OfficeTableLoadingStatus, OfficeTableLoading, OfficeActionCell, OfficeActionHeader, OfficeTablePagination} from './OfficeTable';
import { RowActions } from './RowActions';
import { FilterDrawer } from './FilterDrawer';
import { BookOpeningBalanceModal, BookAssignBankModal, BookEntryModal, BookEntryDetails, BookVoidModal, bookMoney, bookTypes } from './FinancialBookForms';
import './financial-book.css';

const defaults = { currency: 'Ks', type: 'all', status: 'active', founder_id: '', account_id: '', from: '', to: '' };
function BookFilters({ query, currencies, founders, bankBooks, onApply, onClear }) {
  const [draft, setDraft] = useState(() => ({ ...query }));
  const field = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  return <form className="office-drawer-filter-form" onSubmit={event => { event.preventDefault(); onApply(draft); }}><div className="office-drawer-filter-fields">
    <label>Currency<input required maxLength={20} list="office-book-currencies" value={draft.currency} onChange={event => field('currency', event.target.value)} /><datalist id="office-book-currencies">{currencies.map(currency => <option key={currency} value={currency} />)}</datalist></label>
    <label>Entry type<select value={draft.type} onChange={event => field('type', event.target.value)}><option value="all">All types</option>{Object.entries(bookTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Bank book<select value={draft.account_id} onChange={event => field('account_id', event.target.value)}><option value="">All bank books</option>{bankBooks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label>
    <label>Founder<select value={draft.founder_id} onChange={event => field('founder_id', event.target.value)}><option value="">All founders / all entries</option>{founders.map(founder => <option key={founder.id} value={founder.id}>{founder.name}</option>)}</select></label>
    <label>Status<select value={draft.status} onChange={event => field('status', event.target.value)}><option value="active">Active entries</option><option value="all">Include voided entries</option><option value="voided">Voided entries only</option></select></label>
    <label>From date<input type="date" value={draft.from} onChange={event => field('from', event.target.value)} /></label><label>To date<input type="date" min={draft.from || undefined} value={draft.to} onChange={event => field('to', event.target.value)} /></label>
    </div><div className="office-drawer-filter-actions"><button type="button" onClick={onClear}>Clear</button><button type="submit" className="office-button-primary">Apply filters</button></div></form>;
}

export function FinancialBookPage({ refreshToken = 0, filterOpen = false, onFilterOpen, onFilterClose, onOpenFounders }) {
  const [query, setQuery] = useState({ ...defaults, q: '', page: 1, per_page: 25 }), [search, setSearch] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null), [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener('mkpos:office-bank-books-changed', update);
    window.addEventListener('mkpos:office-founders-changed', update);
    return () => {
      window.removeEventListener('mkpos:office-bank-books-changed', update);
      window.removeEventListener('mkpos:office-founders-changed', update);
    };
  }, []);
  useEffect(() => {
    const current = ++sequence.current;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true); setError('');
      const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== ''));
      api(`/office/financial-book?${params}`).then(value => { if (!cancelled && sequence.current === current) setData(value); }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, refreshToken, revision]);
  function saved() { setModal(null); setNotice('Financial book updated.'); setRevision(value => value + 1); }
  const filterCount = Object.keys(defaults).filter(key => query[key] !== defaults[key]).length;
  const sameCurrency = data?.currency === query.currency;
  return <div className="office-page-stack office-financial-book">
    <OfficePageToolbar searchLabel="Search financial book" placeholder="Search description, category or reference" search={search} onSearchChange={setSearch} onSearch={() => setQuery(current => ({ ...current, q: search.trim(), page: 1 }))} onClearSearch={() => { setSearch(''); setQuery(current => ({ ...current, q: '', page: 1 })); }} extraActions={<>
      <button type="button" disabled={!data || loading || !sameCurrency} onClick={() => setModal({ type: 'transfer', data })}><ArrowRightLeft size={14} />Transfer</button>
      <button type="button" disabled={!onOpenFounders} onClick={onOpenFounders}><Settings2 size={14} />Founder settings</button>
      <button type="button" className="office-button-primary" disabled={!data || loading || !sameCurrency || Number(data.summary.unallocated) <= 0} onClick={() => setModal({ type: 'allocate', data })}><Users size={14} />Allocate profit</button>
    </>} actionLabel="New entry" onCreate={() => { setNotice(''); setModal({ type: 'entry', data }); }} onFilterOpen={onFilterOpen} filterOpen={filterOpen} filterCount={filterCount} busy={!data || loading || !sameCurrency} />
    {error && <div className="feedback error" role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {notice && <p className="office-success" role="status">{notice}</p>}
    {data && <>
      <section className="office-book-explanation"><BookOpen size={19} /><div><strong>Financial book in {data.currency}</strong><p>Recorded profit is income minus expenses. Founder contributions and payouts do not change profit. Subscription payments are included automatically.</p><small>Balances below cover all recorded dates. Search and filters apply to the entries table.</small></div></section>
      <section className="office-stat-grid office-book-stats" aria-label="All-time book balances">{[['Income', 'income', 'green'], ['Expenses', 'expenses', 'red'], ['Recorded profit', 'profit', 'purple'], ['Recorded cash', 'cash', 'blue']].map(([label, key, tone]) => <article className="office-stat-card" key={key}><span className={`office-stat-icon office-tone-${tone}`}><CircleDollarSign size={18} /></span><div><span>{label}</span><strong>{bookMoney(data.summary[key], data.currency)}</strong></div></article>)}</section>
      <section className="office-bank-books" aria-label="Bank book balances">{(data.bank_books || []).map(bank => <article key={bank.id}><h2>{bank.name}</h2><strong className={Number(bank.balance) < 0 ? 'office-book-negative-balance' : undefined}>{bookMoney(bank.balance, data.currency)}</strong><small>{bank.is_subscription_default ? 'Default for new subscription receipts' : bank.is_active === false ? 'Archived bank book balance' : 'Recorded bank book balance'}</small>{bank.opening_count > 0 && <small>Opening adjustments: {bookMoney(bank.opening_adjustments, data.currency)}</small>}<button type="button" disabled={loading || !sameCurrency || bank.is_active === false} onClick={() => setModal({ type: 'opening', data, accountId: bank.id })}>Opening adjustment</button></article>)}</section>
      {data.unassigned_bank_count > 0 && <p className="office-book-bank-review">{data.unassigned_bank_count} previous cash entries need a bank book. Unassigned net balance: {bookMoney(data.unassigned_bank_balance, data.currency)}. Use the row action to assign each entry.</p>}
      <section className="office-panel office-book-founders" aria-labelledby="office-book-founders-title">
        <header className="office-book-founders-heading"><h2 id="office-book-founders-title">Founder profit</h2><p>Allocating profit pays all active founder shares from the selected bank book.</p></header>
        <dl className="office-book-profit-summary"><dt>Unallocated profit</dt><dd>{bookMoney(data.summary.unallocated, data.currency)}</dd><dt>Allocated to founders</dt><dd>{bookMoney(data.summary.allocated, data.currency)}</dd></dl>
        {Number(data.summary.unallocated) < 0 && <p className="office-book-deficit">Recorded expenses or receipt corrections exceed the remaining profit. Further allocations are blocked until this deficit is covered.</p>}
        {data.founders.map(founder => <article className="office-book-founder-column" key={founder.id} aria-label={`${founder.name} profit`}>
          <header><h3>{founder.name}</h3><span>{founder.is_active === false ? 'Archived' : `${founder.share_bps / 100}% share`}</span></header>
          <dl>{[['Allocated profit', founder.allocated], ['Profit paid', founder.paid], ['Unpaid profit', founder.balance], ['Capital contributed', founder.contributed]].map(([label, amount]) => <React.Fragment key={label}>
            <dt className={label === 'Unpaid profit' ? 'office-book-unpaid' : undefined}>{label}</dt><dd className={label === 'Unpaid profit' ? 'office-book-unpaid' : undefined}>{bookMoney(amount, data.currency)}</dd>
          </React.Fragment>)}</dl>
        </article>)}
        <p className="office-book-founders-help">New allocations are recorded as paid. Unpaid profit tracks older allocations awaiting payout; capital contributions stay separate.</p>
      </section>
      <section className="office-panel office-table-panel"><div className="office-panel-header"><div><h2>Book entries</h2><p>{data.currency} / {`${data.total} matching entries`}</p></div></div><div className="office-table-scroll"><table className="office-data-table office-book-table" aria-label="Financial book entries"><thead><tr><th>Date</th><th>Entry</th><th>Category / reference</th><th>Bank book / party</th><th>Amount</th><th>Recorded by</th><OfficeActionHeader /></tr></thead><tbody>{data.items.map(item => <tr key={`${item.source}-${item.id}`} className={item.voided_at ? 'office-book-voided' : ''}><td>{item.entry_date}</td><td><div className="office-cell-stack"><strong>{item.description}</strong><small>{bookTypes[item.type]}{item.voided_at ? ' / Voided' : ''}</small></div></td><td><div className="office-cell-stack"><span>{item.category || '-'}</span><small>{item.reference}</small></div></td><td><div className="office-cell-stack"><strong>{item.type === 'profit_allocation' && !item.account_id ? 'Legacy unpaid allocation' : item.to_account_name ? `${item.account_name} to ${item.to_account_name}` : item.account_name || 'Unassigned'}</strong><small>{item.founder_id ? data.founders.find(founder => founder.id === Number(item.founder_id))?.name : item.type === 'profit_allocation' ? 'Founder allocation' : item.counterparty || '-'}</small></div></td><td><strong>{bookMoney(item.amount, item.currency)}</strong><small className="office-book-cash-direction">{item.type === 'profit_allocation' ? (item.account_id ? 'Founder profit paid' : 'No cash movement') : item.type === 'transfer' ? 'Between bank books' : item.type === 'opening_balance' ? (Number(item.amount) < 0 ? 'Balance decrease' : 'Balance increase') : ['expense', 'payout'].includes(item.type) ? 'Money out' : 'Money in'}</small></td><td>{item.created_by_name || 'System'}</td><OfficeActionCell><RowActions label={`book entry ${item.source}-${item.id}`} disabled={loading}><button type="button" onClick={() => setModal({ type: 'detail', item })}><Eye size={14} />View entry</button>{item.source === 'manual' && !item.voided_at && !item.account_id && !['profit_allocation', 'transfer'].includes(item.type) && <button type="button" onClick={() => setModal({ type: 'assign-bank', item, data })}><BookOpen size={14} />Assign bank book</button>}{item.source === 'manual' && !item.voided_at && <button type="button" className="danger-button" onClick={() => setModal({ type: 'void', item })}><ShieldBan size={14} />Void entry</button>}</RowActions></OfficeActionCell></tr>)}{!data.items.length && <tr><td colSpan={7}><div className="office-empty"><BookOpen size={24} /><strong>No entries match these filters.</strong><span>Record an expense or adjust the filters.</span></div></td></tr>}</tbody></table></div><OfficeTablePagination label="Book entries" total={data.total} page={data.page} perPage={data.per_page} lastPage={data.last_page} disabled={loading} onPageChange={page => setQuery(current => ({ ...current, page }))} onPerPageChange={per_page => setQuery(current => ({ ...current, per_page, page: 1 }))} /></section>
    </>}
    {data && loading && <OfficeTableLoadingStatus label="Updating financial entries..."/>}
    {!data && loading && <OfficeTableLoading columns={["Date", "Entry", "Category / reference", "Bank book / party", "Amount", "Recorded by"]} label="Loading financial book..."/>}
    <FilterDrawer open={filterOpen} title="Financial book filters" onClose={onFilterClose}><BookFilters key={filterOpen ? 'open' : 'closed'} query={query} currencies={data?.currencies || ['Ks']} founders={data?.founders || []} bankBooks={data?.bank_books || []} onApply={draft => { setQuery(current => ({ ...current, ...Object.fromEntries(Object.keys(defaults).map(key => [key, draft[key]])), currency: draft.currency.trim(), page: 1 })); onFilterClose(); }} onClear={() => { setQuery(current => ({ ...current, ...defaults, page: 1 })); onFilterClose(); }} /></FilterDrawer>
    {data && modal?.type === 'opening' && <BookOpeningBalanceModal data={modal.data} accountId={modal.accountId} onClose={() => setModal(null)} onSaved={saved} />}
    {data && modal?.type === 'entry' && <BookEntryModal data={modal.data} onClose={() => setModal(null)} onSaved={saved} />}
    {data && modal?.type === 'transfer' && <BookEntryModal data={modal.data} initialType="transfer" onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.type === 'assign-bank' && <BookAssignBankModal item={modal.item} bankBooks={modal.data.bank_books} onClose={() => setModal(null)} onSaved={saved} />}
    {data && modal?.type === 'allocate' && <BookEntryModal data={modal.data} initialType="profit_allocation" onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.type === 'detail' && <BookEntryDetails item={modal.item} onClose={() => setModal(null)} />}
    {modal?.type === 'void' && <BookVoidModal item={modal.item} onClose={() => setModal(null)} onSaved={saved} />}
  </div>;
}
