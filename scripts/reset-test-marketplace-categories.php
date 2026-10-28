<?php
// One-off local reset authorized before installing the common taxonomy.
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require __DIR__.'/../laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('local') || config('database.connections.mysql.database') !== 'mkpos'
    || ($argv[1] ?? '') !== '--confirm-local-test-categories') {
    fwrite(STDERR, "This helper requires the local mkpos database and the explicit confirmation flag.\n"); exit(1);
}
use Illuminate\Support\Facades\DB;
if (DB::table('migrations')->where('migration', '2026_10_18_000002_seed_default_marketplace_categories')->exists()) {
    fwrite(STDERR, "Default categories are already installed. This one-off reset is disabled.\n"); exit(1);
}
DB::transaction(function () {
    DB::table('marketplace_category_locks')->where('id', 1)->lockForUpdate()->first();
    $categories = DB::table('marketplace_categories')->get();
    $links = DB::table('marketplace_product_categories')->whereNotNull('category_id')->get();
    $backup = __DIR__.'/../artifacts/marketplace-categories/test-category-backup-'.date('Ymd-His').'.json';
    if (file_put_contents($backup, json_encode(['categories' => $categories, 'links' => $links], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) === false) throw new RuntimeException('Could not save the reset backup.');
    $taxonomy = app(App\Services\MarketplaceTaxonomy::class)->categories();
    foreach ($links as $link) {
        DB::table('marketplace_product_category_audits')->insert(['product_id' => $link->product_id, 'business_id' => $link->business_id, 'admin_id' => 0,
            'before' => json_encode($taxonomy->get($link->category_id)), 'after' => null, 'created_at' => now()]);
    }
    DB::table('marketplace_product_categories')->whereNotNull('category_id')->update(['category_id' => null, 'version' => DB::raw('version + 1'), 'updated_by_admin_id' => 0, 'updated_at' => now()]);
    DB::table('marketplace_categories')->update(['parent_id' => null]);
    DB::table('marketplace_categories')->delete();
    echo 'Removed '.$categories->count().' test categories and unlinked '.$links->count()." test assignments. Products retained; backup saved.\n";
});
