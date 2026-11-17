// Real cURL progress + nested local HTTP test. No Telegram, AI, credentials or paid calls.
const { createServer } = require('node:http');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'artifacts/telegram-typing');
  await fs.mkdir(output, { recursive: true });
  const actions = [];
  let models = 0;
  const started = Date.now();
  const server = createServer((req, res) => {
    req.resume();
    if (req.url === '/model') {
      models++;
      return setTimeout(() => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); }, 9000);
    }
    if (req.url === '/typing') {
      actions.push((Date.now() - started) / 1000);
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}');
    }
    res.writeHead(404); res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const laravel = path.join(root, 'laravel').replaceAll('\\', '/');
  const fixture = path.join(output, 'transport-fixture.php');
  await fs.writeFile(fixture, `<?php
require '${laravel}/vendor/autoload.php';
$app = require '${laravel}/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
$typing = new class extends App\\Services\\TelegramSupport\\TypingIndicator {
    private float $last = -100;
    public function active(): bool { return true; }
    public function tick(): void {
        $now = hrtime(true) / 1000000000;
        if ($now - $this->last < 4) return;
        $this->last = $now;
        Illuminate\\Support\\Facades\\Http::connectTimeout(1)->timeout(1)->post('${base}/typing', ['action' => 'typing'])->throw();
    }
};
$app->instance(App\\Services\\TelegramSupport\\TypingIndicator::class, $typing);
$curl = new GuzzleHttp\\Handler\\CurlHandler();
$handler = function ($request, $options) use ($curl) {
    if ($request->getUri()->getHost() !== 'api.deepseek.com') throw new RuntimeException('Unexpected host');
    return $curl($request->withUri(new GuzzleHttp\\Psr7\\Uri('${base}/model')), $options);
};
$response = Illuminate\\Support\\Facades\\Http::timeout(15)->setHandler($handler)
    ->post('https://api.deepseek.com/v1/chat/completions', ['fixture' => true]);
if ($response->status() !== 200) throw new RuntimeException('Local transport failed');
echo 'Local model request completed';
`);
  try {
    const result = await promisify(execFile)(process.env.PHP_BINARY || 'D:/xampp/php/php.exe', [fixture], { timeout: 25000 });
    assert.ok(result.stdout.includes('Local model request completed'));
    assert.equal(models, 1);
    assert.ok(actions.length >= 3, `Expected repeated actions while first byte was delayed: ${actions}`);
    for (let i = 1; i < actions.length; i++) assert.ok(actions[i] - actions[i - 1] >= 3.9);
    const report = { model_requests: models, delayed_first_byte_seconds: 9, typing_action_times_seconds: actions, external_requests: 0, result: 'passed' };
    await fs.writeFile(path.join(output, 'transport-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
