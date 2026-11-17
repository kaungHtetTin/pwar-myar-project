export function accessPageFromPath(pathname) {
  if (pathname === '/access/roles/new') return { kind: 'role-form', id: null };
  if (pathname === '/access/staff/new') return { kind: 'staff-form', id: null };
  const role = pathname.match(/^\/access\/roles\/(\d+)\/edit$/); if (role) return { kind: 'role-form', id: Number(role[1]) };
  const staff = pathname.match(/^\/access\/staff\/(\d+)\/edit$/); if (staff) return { kind: 'staff-form', id: Number(staff[1]) };
  const password = pathname.match(/^\/access\/staff\/(\d+)\/password$/); if (password) return { kind: 'password', id: Number(password[1]) };
  return { kind: 'list', id: null };
}

export function accessListPath(type, limit, offset) { return `/${type}?with_total=true&limit=${limit}&offset=${offset}`; }

export function accessPermissionGroups(modules = []) {
  const definitions = [
    ['Operations', ['sell', 'products', 'purchases', 'sales']],
    ['Contacts', ['suppliers', 'customers']],
    ['Finance', ['expenses', 'transactions', 'reports']],
    ['My Shop', modules.filter(module => module.id.startsWith('ecommerce_') || module.id === 'shop').map(module => module.id)],
  ];
  const used = new Set(definitions.flatMap(([, ids]) => ids));
  const groups = definitions.map(([label, ids]) => ({ label, modules: modules.filter(module => ids.includes(module.id)) }));
  const other = modules.filter(module => !used.has(module.id));
  if (other.length) groups.push({ label: 'Other', modules: other });
  return groups.filter(group => group.modules.length);
}
export function accessInitials(name = '') { return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'U'; }
