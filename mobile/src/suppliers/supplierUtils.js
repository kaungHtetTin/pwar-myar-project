export function blankSupplierForm() {
  return {
    name: '',
    phone: '',
    contact_person: '',
    address: '',
    note: '',
  };
}

export function blankSupplierHistoryFilters() {
  return { q: '', date_from: '', date_to: '' };
}

export function blankSupplierPaymentForm() {
  return { direction: 'shop_to_supplier', payment_method: 'Cash', amount: '', note: '' };
}

export function supplierPageFromPath(pathname) {
  if (pathname === '/suppliers/new') return { kind: 'new', supplierId: null };
  const paymentEdit = pathname.match(/^\/suppliers\/(\d+)\/payments\/(\d+)\/edit$/);
  if (paymentEdit) return { kind: 'payment-edit', supplierId: Number(paymentEdit[1]), paymentId: Number(paymentEdit[2]) };
  const paymentNew = pathname.match(/^\/suppliers\/(\d+)\/payments\/new$/);
  if (paymentNew) return { kind: 'payment-new', supplierId: Number(paymentNew[1]), paymentId: null };
  const edit = pathname.match(/^\/suppliers\/(\d+)\/edit$/);
  if (edit) return { kind: 'edit', supplierId: Number(edit[1]) };
  const detail = pathname.match(/^\/suppliers\/(\d+)$/);
  if (detail) return { kind: 'detail', supplierId: Number(detail[1]) };
  return { kind: 'list', supplierId: null };
}

export function supplierPaymentHistoryPath(supplierId, limit, offset, filters = {}) {
  const params = new URLSearchParams({ supplier_id: String(supplierId), status: 'completed', with_total: 'true', limit: String(limit), offset: String(offset) });
  if(limit===undefined)params.delete('limit');
  if(offset===undefined)params.delete('offset');
  for(const key of ['q','direction','payment_method'])if(filters[key]&&filters[key]!=='all')params.set(key,filters[key]);
  return `/supplier-payments?${params}`;
}

export function supplierPaymentPayload(form, supplierId) {
  return {
    supplier_id: Number(supplierId),
    direction: form.direction,
    payment_method: String(form.payment_method || 'Cash'),
    amount: Math.round(Number(form.amount || 0)),
    note: String(form.note || '').trim(),
  };
}

export function supplierPayload(form) {
  return {
    name: String(form.name || '').trim(),
    phone: String(form.phone || '').trim(),
    contact_person: String(form.contact_person || '').trim(),
    address: String(form.address || '').trim(),
    note: String(form.note || '').trim(),
  };
}

export function supplierHistoryPath(supplierId, filters, limit, offset) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (filters.q.trim()) params.set('purchase_q', filters.q.trim());
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  return `/suppliers/${supplierId}?${params}`;
}

export function supplierDate(value){if(!value)return '-';const date=new Date(String(value).replace(' ','T'));return Number.isNaN(date.getTime())?String(value):date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
