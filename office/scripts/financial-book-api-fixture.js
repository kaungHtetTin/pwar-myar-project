export const initial = {
 bank_books: [{ id: 1, name: 'Kaung Htet Tin', balance: '0' }, { id: 2, name: 'Min Htet Kyaw', balance: '330000' }, { id: 3, name: 'VISA', balance: '0' }],
 currency: 'Ks', currencies: ['Ks', 'USD'], settings_version: 1,
 summary: { income: '500000', expenses: '120000', profit: '380000', cash: '330000', allocated: '200000', unallocated: '180000' },
 founders: [{ id: 1, name: 'Kaung Htet Tin', share_bps: 5000, allocated: '100000', paid: '50000', balance: '50000', contributed: '0' }, { id: 2, name: 'Min Htet Kyaw', share_bps: 5000, allocated: '100000', paid: '0', balance: '100000', contributed: '0' }],
};
const entries = [
 { id: 1, source: 'subscription', type: 'subscription_income', description: 'Subscription payment #1', counterparty: 'Demo Shop 01', category: 'Subscription', amount: '500000', account_id: 2, account_name: 'Min Htet Kyaw' },
 ...Array.from({ length: 27 }, (_, i) => ({ id: i + 2, source: 'manual', type: 'expense', description: i === 0 ? 'Cloud hosting and database backup' : `Platform operating expense ${i + 1}`, counterparty: 'Service provider', category: 'Infrastructure', account_id: 2, account_name: 'Min Htet Kyaw', reference: `MK-2026-${i + 1}`, amount: '4000' })),
].map(item => ({ ...item, currency: 'Ks', entry_date: '2026-10-15', created_by_name: 'Office Admin', created_at: '2026-10-15T12:00:00Z', voided_at: null }));
window.bookCalls = [];
export async function api(path, options) {
 window.bookCalls.push({ path, ...options });
 if (options) {
  const body = JSON.parse(options.body);
  if (body.account_id) body.account_name = initial.bank_books.find(bank => bank.id === body.account_id)?.name;
  if (body.type === 'opening_balance') {
    const bank = initial.bank_books.find(bank => bank.id === body.account_id);
    bank.balance = String(Number(bank.balance) + Number(body.amount));
    bank.opening_adjustments = String(Number(bank.opening_adjustments || 0) + Number(body.amount));
    bank.opening_count = (bank.opening_count || 0) + 1;
    initial.summary.cash = String(Number(initial.summary.cash) + Number(body.amount));
  }
  if (body.type === 'profit_allocation') {
    const source = initial.bank_books.find(bank => bank.id === body.account_id), amount = Number(body.amount);
    source.balance = String(Number(source.balance) - amount);
    initial.summary.cash = String(Number(initial.summary.cash) - amount);
    initial.summary.allocated = String(Number(initial.summary.allocated) + amount);
    initial.summary.unallocated = String(Number(initial.summary.unallocated) - amount);
    const firstMinor = Math.floor(Math.round(amount * 100) * initial.founders[0].share_bps / 10000);
    body.allocation = initial.founders.map((founder, index) => { const share = (index === 0 ? firstMinor : Math.round(amount * 100) - firstMinor) / 100; founder.allocated = String(Number(founder.allocated) + share); founder.paid = String(Number(founder.paid) + share); return { id: founder.id, name: founder.name, share_bps: founder.share_bps, amount: String(share) }; });
  }
  if (body.type === 'transfer') { const from = initial.bank_books.find(bank => bank.id === body.account_id), to = initial.bank_books.find(bank => bank.id === body.to_account_id); from.balance = String(Number(from.balance) - Number(body.amount)); to.balance = String(Number(to.balance) + Number(body.amount)); body.account_name = from.name; body.to_account_name = to.name; }
  if (path.endsWith('/entries')) { entries.unshift({ ...body, id: entries.length + 1, source: 'manual', created_by_name: 'Office Admin', created_at: '2026-10-15T13:00:00Z', voided_at: null }); }
  else if (path.endsWith('/founders')) initial.founders = initial.founders.map((item, i) => ({ ...item, ...body.founders[i] }));
  else if (path.endsWith('/void')) { const id = Number(path.split('/').at(-2)); const item = entries.find(item => item.id === id); item.voided_at = '2026-10-15T13:00:00Z'; item.void_reason = body.reason; }
  return { ok: true };
 }
 const params = new URL(path, 'http://fixture').searchParams;
 let items = entries.filter(item => !item.voided_at);
 if (params.get('type') !== 'all') items = items.filter(item => item.type === params.get('type'));
 if (params.get('account_id')) items = items.filter(item => String(item.account_id) === params.get('account_id') || String(item.to_account_id) === params.get('account_id'));
 if (params.get('q')) items = items.filter(item => item.description.toLowerCase().includes(params.get('q').toLowerCase()));
 const per_page = Number(params.get('per_page') || 25), last_page = Math.max(1, Math.ceil(items.length / per_page)), page = Math.min(last_page, Number(params.get('page') || 1));
 return structuredClone({ ...initial, currency: params.get('currency') || 'Ks', total: items.length, per_page, last_page, page, items: items.slice((page - 1) * per_page, page * per_page) });
}
