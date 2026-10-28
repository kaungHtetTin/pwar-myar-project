let customers = [
  { id: 1, name: 'Aye Aye', email: 'aye@example.com', phone: '09987654321', address: 'Yangon', is_active: true, created_at: '2026-10-10T00:00:00Z' },
  { id: 2, name: 'Maung Maung', email: 'maung@example.com', phone: '09123456789', address: 'Mandalay', is_active: false, created_at: '2026-10-11T00:00:00Z' },
];
window.customerFixtureCalls = [];
export async function api(path, options = {}) {
  window.customerFixtureCalls.push({ path, method: options.method || 'GET' });
  if (path.endsWith('/email') && options.method === 'POST') return { message: `Email sent to ${JSON.parse(options.body).recipient_email}.` };
  const id = Number(path.split('/').pop());
  if (options.method === 'DELETE') { customers = customers.filter(row => row.id !== id); return { ok: true }; }
  if (options.method) {
    const data = JSON.parse(options.body);
    if (data.password !== data.password_confirmation) throw new Error('The password confirmation does not match.');
    if (customers.some(row => row.email === data.email && row.id !== id)) throw new Error('The email has already been taken.');
    const row = { ...data, id: id || 3, created_at: '2026-10-15T00:00:00Z' };
    customers = customers.filter(item => item.id !== row.id).concat(row);
    return row;
  }
  if (id) return customers.find(row => row.id === id);
  const query = new URLSearchParams(path.split('?')[1]);
  const items = customers.filter(row => (!query.get('q') || `${row.name} ${row.email} ${row.phone}`.toLowerCase().includes(query.get('q').toLowerCase())) && (query.get('status') === 'all' || row.is_active === (query.get('status') === 'active')));
  return { items, total: items.length, page: 1, last_page: 1 };
}
