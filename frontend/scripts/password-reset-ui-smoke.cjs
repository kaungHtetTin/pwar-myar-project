const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
async function run() {
  if (!process.argv.includes('--native')) {
    const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mkpos-password-reset-qa-'));
    const apps = ['frontend', 'mobile', 'shop'];
    for (const appName of apps) {
      const { build } = await import('vite');
      const appRoot = path.resolve(__dirname, '../../', appName);
      const api = path.resolve(__dirname, 'password-reset-api-fixture.js');
      const result = await build({ configFile: false, root: appRoot, logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"' }, resolve: { alias: [{ find: '../api/client', replacement: api }, { find: '../api', replacement: api }, { find: './api', replacement: api }] }, build: { write: false, lib: { entry: path.join(appRoot, 'scripts/password-reset-fixture.jsx'), formats: ['iife'], name: 'Fixture' } } });
      const files = (Array.isArray(result) ? result[0] : result).output;
      fs.writeFileSync(path.join(output, `${appName}.html`), `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${files.filter(f => f.fileName.endsWith('.css')).map(f => f.source).join('\n')}</style></head><body><div id="${appName === 'shop' ? 'fixture-root' : 'root'}"></div><script>${files.find(f => f.type === 'chunk').code}</script></body></html>`);
    }
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = require('node:child_process').spawn(require('../../desktop/node_modules/electron'), [__filename, '--native', output], { env, stdio: 'inherit', windowsHide: true });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } else {
    const { app, BrowserWindow } = require('electron');
    await app.whenReady();
    const output = process.argv[3];
    const win = new BrowserWindow({ show: false, width: 1440, height: 1000, useContentSize: true, webPreferences: { backgroundThrottling: false } });
    try {
      const js = code => win.webContents.executeJavaScript(code);
      const wait = expression => js(`new Promise((resolve,reject)=>{const start=Date.now();const poll=()=>{if(${expression})resolve();else if(Date.now()-start>7000)reject(new Error(${JSON.stringify(expression)}));else setTimeout(poll,30);};poll();})`);
      const painted = () => js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const change = (name, value) => js(`{ const input=[...document.querySelectorAll('input[aria-label="${name}"]')].find(el=>!el.closest('[hidden]')); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); }`);
      const click = text => js(`([...document.querySelectorAll('button,a')].find(el=>!el.closest('[hidden]') && el.textContent.trim()===${JSON.stringify(text)})).click()`);
      for (const appName of ['frontend', 'mobile', 'shop']) {
        win.setContentSize(appName === 'frontend' ? 1280 : 393, appName === 'frontend' ? 900 : 852);
        await win.loadFile(path.join(output, `${appName}.html`));
        await wait(`!![...document.querySelectorAll('a')].find(el=>el.textContent.trim()==='Forgot password?')`);
        if (appName === 'frontend') {
          await js(`window.loginSizes = { input: document.querySelector('.auth-split-input').getBoundingClientRect().height, heading: getComputedStyle(document.querySelector('.auth-split-heading h2')).fontSize, submit: document.querySelector('.auth-submit').getBoundingClientRect().height }`);
          await painted(); fs.writeFileSync(path.join(output, 'frontend-login.png'), (await win.webContents.capturePage()).toPNG());
        }
        await click('Forgot password?'); await wait(`!!document.querySelector('.password-reset-form')`);
        if (appName === 'frontend') {
          assert.ok(await js(`Math.abs(document.querySelector('.password-reset-form .auth-split-input').getBoundingClientRect().height - window.loginSizes.input) < 1`), 'Reset input matches login height');
          assert.equal(await js(`getComputedStyle(document.querySelector('.password-reset-form .auth-split-heading h2')).fontSize`), await js('window.loginSizes.heading'));
          assert.ok(await js(`Math.abs(document.querySelector('.password-reset-form .auth-submit').getBoundingClientRect().height - window.loginSizes.submit) < 1`), 'Reset action matches login height');
          await painted(); fs.writeFileSync(path.join(output, 'frontend-forgot-password.png'), (await win.webContents.capturePage()).toPNG());
        }

        assert.ok(await js('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), `${appName} has no horizontal overflow`);
        await change('Email address', 'buyer@example.test'); await click('Send reset code');
        await wait(`!!document.querySelector('input[name=code]')`); await painted();
        fs.writeFileSync(path.join(output, `${appName}-reset-code.png`), (await win.webContents.capturePage()).toPNG());
        await change('Email verification code', '012345'); await change('New password', 'new-password'); await change('Confirm new password', 'new-password');
        await click('Reset password'); await wait(`document.body.textContent.includes('Your password has been changed.')`);
        assert.equal(await js(`window.resetCalls.filter(call=>call.path.endsWith('/reset-password')).length`), 1);
        await click('Back to sign in'); await wait(`!document.querySelector('.password-reset-form') || !!document.querySelector('.password-reset-form[hidden]') || !!document.querySelector('.password-reset-form').closest('[hidden]')`);
        console.log(`${appName}: login entry, OTP, reset once, return to sign-in, no horizontal overflow passed.`);
      }
      const email = path.join(require('node:os').tmpdir(), 'mkpos-password-reset-email.html');
      if (fs.existsSync(email)) {
        win.setContentSize(640, 800); await win.loadFile(email); await painted();
        fs.writeFileSync(path.join(output, 'email-template.png'), (await win.webContents.capturePage()).toPNG());
      }
      console.log(`Screenshots: ${output}`);
    } finally { win.destroy(); app.quit(); }
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; if (process.argv.includes('--native')) require('electron').app.exit(1); });
