export async function api(path) {
 if (path === '/office/auth/me') throw new Error('Fixture session');
 if (path === '/office/financial-report') return null;
 return { items: [], total: 0, page: 1, last_page: 1, per_page: 25, summary: { total: 0, access_counts: {} } };
}
export const apiBlob = api;
export const apiUpload = api;
