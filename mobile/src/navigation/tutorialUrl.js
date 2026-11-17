export function tutorialUrl({ apiUrl = '/api', origin = window.location.origin, devOrigin = '', publicUrl = '' } = {}) {
  const root = publicUrl || (apiUrl.startsWith('http') ? apiUrl.replace(/\/api\/?$/, '') : devOrigin || new URL(apiUrl.replace(/\/api\/?$/, '') || '/', origin).href);
  const url = new URL(root);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid tutorial website URL.');
  url.pathname = url.pathname.replace(/\/$/, '') + '/tutorials';
  url.search = ''; url.hash = '';
  return url.href;
}

