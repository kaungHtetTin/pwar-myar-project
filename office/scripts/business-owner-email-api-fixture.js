window.ownerEmailCalls = [];
const business = { id: 11, name: 'Demo Shop 01', owner_id: 21, owner_name: 'Demo Shop Owner', owner_email: 'owner@example.test', owner_is_active: true, status: 'active', currency: 'Ks', timezone: 'Asia/Yangon', subscription: null };
export async function api(path, options) {
 window.ownerEmailCalls.push({ path, ...options });
 if (path.endsWith('/email')) return { message: 'Email sent to owner@example.test.' };
 if (path === '/office/businesses/11') return { business, billing: { subscription: null, is_valid: false }, billing_history: [], business_summary: {} };
 if (path.startsWith('/office/businesses?')) return { items: [business], total: 1, page: 1, per_page: 25, last_page: 1, summary: { total: 1, access_counts: {} } };
 if (path === '/office/financial-report') return null;
 return { items: [] };
}
export const apiBlob = api;
export const apiUpload = api;
