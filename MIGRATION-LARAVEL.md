# SQLite to MySQL migration

The Laravel application includes a guarded importer for an existing PwarMyar SQLite database.

For an already running Laravel/MySQL installation receiving the October 2026
Office admin, founder and bank-book update, follow the separate
[existing-database upgrade procedure](README.md#upgrading-an-existing-office-financial-book)
and [financial-book preservation guide](office/docs/financial-book.md#preserving-a-running-installation).
That upgrade uses additive migrations and a before/after financial snapshot;
it does not require this importer or its `--truncate` option.

1. Back up both databases.
2. Configure the MySQL target in `laravel/.env` and run `php artisan migrate --force` from `laravel`.
3. Make sure no application is writing to the SQLite file during the copy.
4. Register the destination business owner and note the returned business ID.
5. Run:

   ```powershell
   cd laravel
   php artisan mkpos:import-sqlite BUSINESS_ID ..\data\mkpos.sqlite3 --truncate
   ```

Replace `BUSINESS_ID` with the destination business ID. The importer preserves record IDs and relationships, so it refuses to run when another business already has POS data that could use overlapping legacy IDs. The `--truncate` option replaces the destination business's default settings and any existing POS data; make a MySQL backup first.

After importing, compare product, sale, purchase, customer, payment, and expense counts before switching users to Laravel. Keep the original SQLite file as a read-only backup until the Laravel/MySQL deployment has been verified.
