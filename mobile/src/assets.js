export function publicAsset(path) {
  return `${import.meta.env.BASE_URL}${String(path || '').replace(/^\/+/, '')}`;
}

// Use the supplied transparent symbol inside the shared brand frames.
export const BRAND_LOGO = publicAsset('branding/pwarmyar-mark.png');
