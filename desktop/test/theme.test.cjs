const assert = require('node:assert/strict');
const test = require('node:test');
const { applyWindowTheme } = require('../theme.cjs');
test('packages the native theme bridge alongside the main process', () => {
  assert.ok(require('../package.json').build.files.includes('theme.cjs'));
});
test('applies the validated appearance and background to the desktop window', () => {
  const colors = [], native = {};
  const window = { isDestroyed: () => false, setBackgroundColor: color => colors.push(color) };
  assert.equal(applyWindowTheme(window, native, { mode:'dark', background:'#12131a' }), true);
  assert.equal(native.themeSource, 'dark'); assert.deepEqual(colors, ['#12131a']);
  assert.throws(() => applyWindowTheme(window, native, { mode:'dark', background:'red; color:blue' }));
  assert.throws(() => applyWindowTheme(window, native, { mode:'system', background:'#ffffff' }));
  assert.equal(applyWindowTheme({ isDestroyed: () => true }, native, { mode:'light', background:'#ffffff' }), false);
  assert.deepEqual(colors, ['#12131a']);
});
