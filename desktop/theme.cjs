function applyWindowTheme(window, nativeTheme, payload) {
  if (!payload || !['light', 'dark'].includes(payload.mode) || !/^#[0-9a-f]{6}$/i.test(payload.background || '')) throw new Error('Invalid application theme.');
  if (!window || window.isDestroyed()) return false;
  nativeTheme.themeSource = payload.mode;
  window.setBackgroundColor(payload.background);
  return true;
}
module.exports = { applyWindowTheme };
