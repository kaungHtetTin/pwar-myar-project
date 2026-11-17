"""Package the PwarMyar database/photo/refresh update without private files."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'frontend/package.json').read_text(encoding='utf-8-sig'))['version']
DEST = ROOT / 'release' / f'PwarMyar-{VERSION}-database-performance-20261031-final'

BACKEND = [
    'app/Http/Controllers/Api/PriceTypeController.php',
    'app/Services/BusinessReport.php', 'app/Services/ShopOrderCards.php',
    'app/Http/Controllers/Api/ApiController.php', 'app/Http/Controllers/Api/ProductController.php',
    'app/Http/Controllers/Api/CustomerController.php', 'app/Http/Controllers/Api/SaleController.php',
    'app/Http/Controllers/Ecommerce/AdminController.php', 'config/database.php',
    '.env.production.example', 'docs/database-performance.md',
]
SOURCE = [
    'shared/network/productPhotos.js', 'shared/network/refreshQueue.js', 'shared/network/referenceCache.js',
    'frontend/src/components/ProductPhoto.jsx', 'frontend/src/components/ProductPhoto.test.jsx',
    'frontend/src/dataEvents.js', 'frontend/src/dataEvents.test.jsx', 'frontend/src/networkOptimization.test.js',
    'frontend/src/screens/ShopPromotions.jsx',
    'frontend/src/components/KeepAliveModules.test.jsx', 'frontend/src/screens/TransactionsScreen.jsx',
    'mobile/src/styles/index.css', 'mobile/src/styles/auth-reference.css',
    'mobile/src/products/ProductPhoto.jsx', 'mobile/src/products/ProductPhoto.test.jsx',
    'mobile/src/navigation/pageRefresh.js', 'mobile/src/navigation/pageRefresh.test.jsx',
    'laravel/tests/Feature/PriceTypeReadOnlyTest.php', 'laravel/tests/Feature/PriceTypeReadRealtimeTest.php',
    'laravel/tests/Feature/DatabasePerformanceTest.php', 'README.md',
] + ['laravel/' + name for name in BACKEND]


def archive(name, base, names):
    with zipfile.ZipFile(DEST / name, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for relative in sorted(names):
            relative = Path(relative).as_posix()
            source = (base / relative).resolve()
            if not source.is_relative_to(base.resolve()) or not source.is_file():
                raise RuntimeError(f'Invalid package source: {relative}')
            parts = Path(relative).parts
            if any(part in {'.git', 'node_modules', 'vendor', 'storage'} for part in parts):
                raise RuntimeError(f'Private/generated directory: {relative}')
            if any(part.startswith('.env') and part != '.env.production.example' for part in parts):
                raise RuntimeError(f'Private environment: {relative}')
            if source.suffix.lower() in {'.log', '.sql', '.sqlite', '.jks', '.keystore', '.pfx', '.pem'}:
                raise RuntimeError(f'Private/generated file: {relative}')
            output.write(source, relative)
    with zipfile.ZipFile(DEST / name) as check:
        if check.testzip() is not None:
            raise RuntimeError(f'Corrupt package: {name}')
        print(f'{name}: {len(check.namelist())} files')


def main():
    # Validate all build inputs before creating any output.
    for app in ['pos', 'mobile']:
        for required in ['index.html', '.htaccess']:
            if not (ROOT / 'laravel/public' / app / required).is_file():
                raise RuntimeError(f'Missing {app}/{required}; run build:laravel first')
    DEST.mkdir(parents=True, exist_ok=False)
    for app, label in [('pos', 'Business-Web'), ('mobile', 'Mobile-Web')]:
        base = ROOT / 'laravel/public' / app
        names = [str(path.relative_to(base)) for path in base.rglob('*') if path.is_file()]
        archive(f'PwarMyar-{label}-{VERSION}.zip', base, names)
    archive(f'PwarMyar-Laravel-Performance-Update-{VERSION}.zip', ROOT / 'laravel', BACKEND)
    archive(f'PwarMyar-Optimization-Source-{VERSION}.zip', ROOT, SOURCE)
    (DEST / 'INSTALL.txt').write_text(f'''PwarMyar {VERSION} database performance update - 2026-10-31

1. Back up the existing Laravel source, database and private .env.
2. Extract the Laravel Performance Update ZIP into the existing Laravel project root.
   It contains only the changed PHP files, database configuration, documentation
   and a production EXAMPLE. Keep the live .env, APP_KEY, credentials and uploads.
3. Extract Business-Web into the document root for https://pos.pwarmyar.com.
   Extract Mobile-Web into the document root for https://mobilepos.pwarmyar.com.
   Both builds use https://pwarmyar.com/public/api and token authentication.
4. Confirm the host's simultaneous connection allowance covers PHP and AI workers.
   In the live .env set DB_PERSISTENT=true. Use the host's local database settings;
   normally DB_HOST=localhost, blank DB_PORT and blank DB_SOCKET unless supplied.
5. From the deployed Laravel directory run:
       php artisan config:cache
       php artisan queue:restart
   Keep the existing worker supervision/cron arrangement. Do not add duplicate
   AI executors. Recycle PHP workers through the hosting panel if required.
6. Verify persistence without exposing credentials:
       php artisan tinker --execute="dump(config('database.connections.mysql.options')[PDO::ATTR_PERSISTENT] ?? false);"
   Expected: true. Monitor database errors and simultaneous connections.

No migration, composer install, data reset, API URL change or version bump is
required for this incremental update. Deploy the backend and both web builds
together. The Source ZIP is for the development repository, not the public web root.
Windows/Android installers, Office, Shop and Node releases were not rebuilt.
This package has not been uploaded or deployed to production.
See laravel/docs/database-performance.md in the source package for rollback guidance.
''', encoding='utf-8')
    manifest = [dict(file=path.name, bytes=path.stat().st_size,
                     sha256=hashlib.sha256(path.read_bytes()).hexdigest())
                for path in sorted(DEST.iterdir()) if path.is_file()]
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (DEST / 'SHA256SUMS.txt').write_text(''.join(f"{entry['sha256']}  {entry['file']}\n" for entry in manifest), encoding='ascii')
    print(f'Release folder: {DEST}')


if __name__ == '__main__':
    main()
