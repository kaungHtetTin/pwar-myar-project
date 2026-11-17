export const ACCESS_TOKEN_KEY = 'mkpos.mobile.accessToken';

export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}
