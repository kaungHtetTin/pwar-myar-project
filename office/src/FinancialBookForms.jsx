import { officeDateTime, officeDay } from './dateTime';
import React, { useId, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from './api';
import { OfficeModal } from './OfficeModal';

export const bookTypes = { subscription_income: 'Subscription income', income: 'Other income', expense: 'Expense', contribution: 'Founder contribution', payout: 'Founder payout', profit_allocation: 'Profit allocation', transfer: 'Bank transfer', opening_balance: 'Opening balance adjustment' };
export const bookMoney = (amount, currency) => `${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
const today = () => officeDay(new Date().toISOString());

function MutationModal({ title, description, action, onClose, onSaved, prepare, children }) {
  const formId = useId(), saving = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { const { path, method, body } = prepare(); await api(path, { method, body: JSON.stringify(body) }); onSaved(); }
    catch (e) { setError(e.message); }
    finally { saving.current = false; setBusy(false); }
  }
  return <OfficeModal title={title} description={description} onClose={onClose} busy={busy} className="office-book-modal" footer={<><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" form={formId} disabled={busy} className="office-button-primary"><Save size={15} />{busy ? 'Saving...' : action}</button></>}>
    <form id={formId} onSubmit={submit} className="office-book-form"><fieldset disabled={busy}>{children}{error && <div className="feedback error" role="alert">{error}</div>}</fieldset></form>
  </OfficeModal>;
}

export function BookEntryModal({ data, initialType = 'expense', onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ type: initialType, entry_date: today(), amount: '', currency: data.currency, description: '', category: '', reference: '', counterparty: '', payment_method: '', founder_id: data.founders.find(item => item.is_active !== false)?.id || '', account_id: initialType === 'transfer' ? (data.subscription_account_id || data.bank_books?.find(bank => bank.is_active !== false)?.id || '') : '', to_account_id: '' }));
  const [requestKey] = useState(() => crypto.randomUUID());
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const transfer = form.type === 'transfer';
  const allocation = form.type === 'profit_allocation', founder = ['payout', 'contribution'].includes(form.type);
  function prepare() {
    const body = { ...form, account_id: Number(form.account_id), to_account_id: transfer ? Number(form.to_account_id) : null, founder_id: founder ? Number(form.founder_id) : null, request_key: requestKey, settings_version: allocation ? data.settings_version : null };
    if (transfer && Number(form.account_id) === Number(form.to_account_id)) throw new Error('Choose two different bank books.');
    if (allocation && Math.round(Number(form.amount) * 100) > Math.round(Number(data.summary.unallocated) * 100)) throw new Error('Amount exceeds unallocated profit.');
    return { path: '/office/financial-book/entries', method: 'POST', body };
  }
  return <MutationModal title={transfer ? 'Transfer between bank books' : allocation ? 'Allocate founder profit' : 'New book entry'} description={transfer ? 'Record money moved between bank books. Total cash and profit stay unchanged.' : allocation ? 'Deduct the total from the selected bank book and record all founder shares as paid.' : 'Record money received or paid by PwarMyar.'} action={transfer ? 'Record transfer' : allocation ? 'Allocate profit' : 'Save entry'} onClose={onClose} onSaved={onSaved} prepare={prepare}>
    {!allocation && !transfer && <label>Entry type<select value={form.type} onChange={event => field('type', event.target.value)}>{['expense', 'income', 'contribution', 'payout'].map(type => <option key={type} value={type}>{bookTypes[type]}</option>)}</select></label>}
    <div className="office-book-form-grid"><label>Date<input type="date" required max={today()} min={allocation ? today() : undefined} value={form.entry_date} onChange={event => field('entry_date', event.target.value)} /></label><label>Currency<input required maxLength={20} readOnly value={form.currency} /></label><label>Amount<input type="number" required min="0.01" max="999999999999.99" step="0.01" value={form.amount} onChange={event => field('amount', event.target.value)} /></label>
    {founder && <label>Founder<select value={form.founder_id} onChange={event => field('founder_id', event.target.value)}>{data.founders.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div>
    <div className="office-book-form-grid">
      <label>{transfer ? 'From bank book' : 'Bank book'}<select required value={form.account_id} onChange={event => field('account_id', event.target.value)}><option value="">Choose bank book</option>{(data.bank_books || []).filter(bank => bank.is_active !== false).map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label>
      {transfer && <label>To bank book<select required value={form.to_account_id} onChange={event => field('to_account_id', event.target.value)}><option value="">Choose receiving bank book</option>{(data.bank_books || []).filter(bank => bank.is_active !== false).map(bank => <option key={bank.id} value={bank.id} disabled={Number(form.account_id) === bank.id}>{bank.name}</option>)}</select></label>}
    </div>
    {transfer && <p className="office-book-form-note">Source balance: {bookMoney(data.bank_books?.find(bank => bank.id === Number(form.account_id))?.balance, data.currency)}. This records an internal transfer, separate from founder payouts.</p>}
    {allocation && <p className="office-book-form-note">Bank book balance: {bookMoney(data.bank_books?.find(bank => bank.id === Number(form.account_id))?.balance, data.currency)}. Saving deducts {bookMoney(form.amount, data.currency)} from this book and marks all founder shares as paid.</p>}
    {allocation && <div className="office-book-form-note"><strong>Unallocated profit: {bookMoney(data.summary.unallocated, data.currency)}</strong>{data.founders.filter(item => item.is_active !== false).map(item => <span key={item.id}>{item.name}: {item.share_bps / 100}%</span>)}<small>Shares are saved with this allocation. Any rounding remainder goes to the last active founder.</small></div>}
    {form.type === 'payout' && <p className="office-book-form-note">Unpaid allocation: {bookMoney(data.founders.find(item => item.id === Number(form.founder_id))?.balance, data.currency)}. Recorded cash: {bookMoney(data.summary.cash, data.currency)}.</p>}
    <label>Description<textarea required rows={2} maxLength={500} value={form.description} onChange={event => field('description', event.target.value)} /></label>
    {!allocation && !transfer && <div className="office-book-form-grid"><label>Category<input maxLength={100} placeholder="Hosting, marketing, salaries..." value={form.category} onChange={event => field('category', event.target.value)} /></label><label>Paid to / received from<input maxLength={200} value={form.counterparty} onChange={event => field('counterparty', event.target.value)} /></label><label>Payment method<input maxLength={100} placeholder="Cash, bank transfer..." value={form.payment_method} onChange={event => field('payment_method', event.target.value)} /></label><label>Receipt / reference<input maxLength={200} value={form.reference} onChange={event => field('reference', event.target.value)} /></label></div>}
    {transfer && <label>Transfer reference<input maxLength={200} value={form.reference} onChange={event => field('reference', event.target.value)} /></label>}
    {form.type === 'income' && <p className="office-book-form-note">Subscription payments are already included automatically. Use Other income only for separate receipts.</p>}
  </MutationModal>;
}

export function BookOpeningBalanceModal({ data, accountId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ account_id: accountId, entry_date: today(), amount: '', description: '', reference: '' }));
  const [requestKey] = useState(() => crypto.randomUUID());
  const bank = data.bank_books.find(item => item.id === Number(form.account_id));
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  function prepare() {
    if (!Number(form.amount)) throw new Error('Enter a non-zero opening adjustment.');
    return { path: '/office/financial-book/entries', method: 'POST', body: { ...form, account_id: Number(form.account_id), type: 'opening_balance', currency: data.currency, request_key: requestKey, category: 'Opening balance', expected_bank_balance: bank.balance } };
  }
  return <MutationModal title="Opening balance adjustment" description="Add an adjustment to the existing bank book. All recorded transactions stay included." action="Save opening adjustment" prepare={prepare} onClose={onClose} onSaved={onSaved}>
    <div className="office-book-form-grid"><label>Bank book<select required value={form.account_id} onChange={event => field('account_id', event.target.value)}>{data.bank_books.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Currency<input readOnly value={data.currency} /></label><label>Adjustment date<input required type="date" max={today()} value={form.entry_date} onChange={event => field('entry_date', event.target.value)} /></label><label>Adjustment amount<input required type="number" step="0.01" min="-999999999999.99" max="999999999999.99" value={form.amount} onChange={event => field('amount', event.target.value)} /></label></div>
    <p className="office-book-form-note">Use a positive amount to increase the balance or a negative amount to reduce it. Enter the adjustment only, rather than the bank&apos;s full current balance.</p>
    <dl className="office-book-opening-preview"><dt>Current recorded balance</dt><dd>{bookMoney(bank.balance, data.currency)}</dd><dt>Opening adjustment</dt><dd>{bookMoney(form.amount, data.currency)}</dd><dt>Resulting balance</dt><dd>{bookMoney(Number(bank.balance) + Number(form.amount || 0), data.currency)}</dd></dl>
    <label>Reason / opening balance note<textarea required maxLength={500} rows={2} value={form.description} onChange={event => field('description', event.target.value)} /></label>
    <label>Reference<input maxLength={200} value={form.reference} onChange={event => field('reference', event.target.value)} /></label>
    <p className="office-book-form-note">This changes recorded cash only. It does not add income, expenses, founder contributions or profit.</p>
  </MutationModal>;
}

export function BookAssignBankModal({ item, bankBooks, onClose, onSaved }) {
  const [account, setAccount] = useState('');
  return <MutationModal title="Assign bank book" description={`${item.description}. Assign the original bank book without changing the amount or date.`} action="Assign bank book" onClose={onClose} onSaved={onSaved} prepare={() => ({ path: `/office/financial-book/entries/${item.id}/bank-book`, method: 'PATCH', body: { account_id: Number(account) } })}>
    <label>Bank book<select required value={account} onChange={event => setAccount(event.target.value)}><option value="">Choose bank book</option>{bankBooks.map(bank => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select></label>
  </MutationModal>;
}

export function BookVoidModal({ item, onClose, onSaved }) {
  const [reason, setReason] = useState('');
  return <MutationModal title="Void book entry" description={`${item.description}: ${bookMoney(item.amount, item.currency)}. The original entry remains in history.`} action="Void entry" onClose={onClose} onSaved={onSaved} prepare={() => ({ path: `/office/financial-book/entries/${item.id}/void`, method: 'POST', body: { reason } })}>
    <label>Reason for voiding<textarea required maxLength={500} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></label>
  </MutationModal>;
}

export function BookEntryDetails({ item, onClose }) {
  return <OfficeModal title="Book entry details" description={`${item.source === 'subscription' ? 'Subscription payment' : 'Book entry'} #${item.id}`} onClose={onClose} className="office-book-modal" footer={<button type="button" onClick={onClose}>Close</button>}>
    <dl className="office-book-details">{[['Type', bookTypes[item.type]], ['Date', item.entry_date], ['Description', item.description], ['Amount', bookMoney(item.amount, item.currency)], ['Bank book', item.account_name || (item.type === 'profit_allocation' ? 'Legacy unpaid allocation' : 'Unassigned')], ['Allocation payment', item.type === 'profit_allocation' ? (item.account_id ? 'Paid from bank book' : 'Legacy unpaid allocation') : null], ['Receiving bank book', item.to_account_name], ['Bank assigned by', item.bank_assigned_by_name], ['Bank assigned at', item.bank_assigned_at && officeDateTime(item.bank_assigned_at)], ['Category', item.category], ['Counterparty', item.counterparty], ['Payment method', item.payment_method], ['Reference', item.reference], ['Recorded by', item.created_by_name || 'System'], ['Recorded at', item.created_at && officeDateTime(item.created_at)], ['Status', item.voided_at ? 'Voided' : 'Active'], ['Void reason', item.void_reason], ['Voided by', item.voided_by_name], ['Voided at', item.voided_at && officeDateTime(item.voided_at)]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {item.allocation && <div className="office-book-allocation-details"><h3>{item.account_id ? 'Recorded founder payments' : 'Recorded founder shares'}</h3>{item.allocation.map(share => <p key={share.id}><strong>{share.name}</strong><span>{share.share_bps / 100}%: {bookMoney(share.amount, item.currency)}</span></p>)}</div>}
  </OfficeModal>;
}
