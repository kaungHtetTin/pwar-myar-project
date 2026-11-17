"""Package only reviewed timer sources and current Laravel-targeted client builds."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BRAND = 'PwarMyar' if ROOT.name == 'pwarmyar-pos' else 'MKPOS'
VERSION = json.loads((ROOT / 'frontend/package.json').read_text(encoding='utf-8-sig'))['version']
DEST = ROOT / 'release' / f'{BRAND}-{VERSION}-essential-timers-20261031'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def archive(target, base, names):
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for name in sorted(set(names)):
            source = (base / name).resolve()
            if not source.is_relative_to(base.resolve()) or not source.is_file():
                raise RuntimeError(f'Invalid source: {name}')
            relative = source.relative_to(base)
            if any(part in {'.git', 'vendor', 'storage', 'node_modules'} or part.startswith('.env') for part in relative.parts):
                raise RuntimeError(f'Private path: {name}')
            output.write(source, relative.as_posix())
    with zipfile.ZipFile(target) as check:
        assert check.testzip() is None
        for name in check.namelist():
            assert check.read(name) == (base / name).read_bytes()

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    business = 'pos' if BRAND == 'PwarMyar' else 'app'
    for app, label in [(business, 'Business-Web'), ('mobile', 'Mobile-Web'), ('shop', 'Shop-Web'), ('office', 'Office-Web')]:
        base = ROOT / 'laravel/public' / app
        if not (base / 'index.html').is_file() or not (base / '.htaccess').is_file():
            raise RuntimeError(f'Missing {app} routing/build files')
        archive(DEST / f'{BRAND}-{label}-{VERSION}.zip', base,
                [path.relative_to(base).as_posix() for path in base.rglob('*') if path.is_file()])
    before = ROOT / 'artifacts/essential-timers-before-20261031'
    names = [p.relative_to(before).as_posix() for p in before.rglob('*') if p.is_file()
             and p.suffix in {'.js', '.jsx'}]
    names += ['shared/network/chatFallback.js', 'shared/network/displayClock.js',
              'frontend/src/essentialTimers.test.js', 'frontend/src/chatTimers.integration.test.js',
              'scripts/package-essential-timers.py']
    archive(DEST / f'{BRAND}-Timer-Source-{VERSION}.zip', ROOT, names)
    (DEST / 'INSTALL.txt').write_text(f'''{BRAND} {VERSION} essential timer update - 2026-10-31

Back up deployed web assets before replacing them.
Extract each WEB archive into that application's existing document root:
Business -> existing Laravel public/{business} or the mapped Business subdomain.
Mobile -> existing public/mobile or its mapped subdomain.
Shop -> existing public/shop or its mapped storefront document root.
Office -> existing public/office or its mapped Office document root.
Keep the generated assets and index.html from the same build together.
Reload installed web apps/browser tabs after deployment; purge the normal static
asset cache if an old index is served. Keep each project's current API URLs.

The Source archive is for the development repository, not the public web root.
It includes changed sources and regression tests. No live environment files,
database dumps, Laravel application changes or Node server files are included.

Changes: one shared disconnected-chat fallback clock per SPA; fallback stops
while healthy, hidden or offline; Socket.IO automatic retries disabled in favor
of explicit 30-300 second recovery with jitter; 300ms search/preview debounce;
150ms queued chat refresh; shared visible-only last-seen display clock.
HTTP presence fallback is limited to visible chat views during disconnection;
unrelated foreground pages do not send periodic presence heartbeats.
Request timeouts, photo spacing, rate-limit cooldowns, event-driven offline
cache refresh, AI delivery reconciliation, workers and maintenance are retained.
Zero-delay Office loaders are one-shot loads, not recurring polling.
Socket authentication renewal after ticket expiry remains necessary.

Node.js socket server: no source/protocol change, rebuild or restart required.
Laravel: no migration or worker restart required for THIS client-only update.
The earlier price-type backend fix is separate and remains required if not deployed.
Bundled Windows/Android clients need rebuilding and redistribution to receive
these sources. Native installers/APK/AAB were not built in this package.
Production deployment has not been performed.
Rollback: restore all four previous web builds and reload their clients.
''', encoding='utf-8')
    evidence = ROOT / 'artifacts/essential-timers-validation.txt'
    if evidence.is_file():
        (DEST / 'VALIDATION.txt').write_bytes(evidence.read_bytes())
    entries = [dict(file=p.name, bytes=p.stat().st_size, sha256=sha(p))
               for p in sorted(DEST.iterdir()) if p.is_file() and p.name not in {'manifest.json', 'SHA256SUMS.txt'}]
    (DEST / 'manifest.json').write_text(json.dumps(entries, indent=2), encoding='utf-8')
    (DEST / 'SHA256SUMS.txt').write_text(''.join(f"{e['sha256']}  {e['file']}\n" for e in entries), encoding='ascii')
    bundle = DEST.parent / (DEST.name + '.zip')
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_STORED) as output:
        for path in sorted(DEST.iterdir()):
            if path.is_file(): output.write(path, DEST.name + '/' + path.name)
    with zipfile.ZipFile(bundle) as check:
        assert check.testzip() is None
        for path in DEST.iterdir():
            if path.is_file(): assert check.read(DEST.name + '/' + path.name) == path.read_bytes()
    bundle.with_suffix('.zip.sha256').write_text(f'{sha(bundle)}  {bundle.name}\n', encoding='ascii')
    print(bundle)

if __name__ == '__main__':
    main()
