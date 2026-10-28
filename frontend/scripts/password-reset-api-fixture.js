window.resetCalls = [];
export async function request(path, options) {
 window.resetCalls.push({ path, ...options });
 if (path.includes('forgot-password')) return { message: 'If an eligible account exists, a reset code has been sent.', resend_after: 60 };
 if (path.includes('reset-password')) return { message: 'Password reset successfully.' };
 return { items: [], has_more: false, enabled: false, unread_count: 0 };
}
export const apiRequest = request;
export const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const customerToken = () => '';
export const setCustomerToken = () => {};
export const requestChatImage = request;
export const API = '/api';
