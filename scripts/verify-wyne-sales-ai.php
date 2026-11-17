<?php
// Read-only registration check; no AI calls or business writes.
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require __DIR__.'/../laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$owner = App\Models\User::where('role', 'owner')->where('is_active', true)->firstOrFail();
app(App\Tenancy\TenantContext::class)->set((int) $owner->business_id);
$names = [];
foreach ((new App\Ai\Agents\MkposAssistant($owner))->tools() as $tool) {
    if ($tool instanceof App\Ai\Tools\BusinessManagementTool && str_contains($tool->name(), 'sales_ai')) $names[] = $tool->name();
}
if (count($names) !== 11) { fwrite(STDERR, 'Expected eleven Sales AI tools, got '.count($names).PHP_EOL); exit(1); }
echo json_encode(['registered_sales_ai_tools' => $names], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR).PHP_EOL;
