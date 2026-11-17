export function publicAsset(path) {
  return `${import.meta.env.BASE_URL}${String(path || '').replace(/^\/+/, '')}`;
}

export const BRAND_LOGO = publicAsset('branding/pwarmyar-mark.png');
export const APP_ICON = publicAsset('branding/pwarmyar-icon.png');
