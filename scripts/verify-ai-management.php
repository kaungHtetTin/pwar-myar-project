<?php

// Read-only local installation check. Never submits a proposal or business change.
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require __DIR__.'/../laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$owner = App\Models\User::where('role', 'owner')->where('is_active', true)
    ->whereIn('business_id', Illuminate\Support\Facades\DB::table('businesses')->where('status', 'active')->select('id'))->firstOrFail();
$app->make(App\Tenancy\TenantContext::class)->set((int) $owner->business_id);
$writes = 0;
Illuminate\Support\Facades\DB::listen(function ($q) use (&$writes) {
    if (preg_match('/^\s*(insert|update|delete|replace|alter|create|drop)\b/i', $q->sql)) $writes++;
});
$agent = new App\Ai\Agents\MkposAssistant($owner);
$names = array_map(fn ($t) => method_exists($t, 'name') ? $t->name() : class_basename($t), iterator_to_array((function () use ($agent) { yield from $agent->tools(); })()));
$expected = App\Ai\Tools\BusinessManagementTool::NAMES;
$context = $app->make(App\Services\AiBusinessReader::class)->run($owner, 'get_business_context', []);
$products = $app->make(App\Services\AiManagementReader::class)->read(['resource' => 'products', 'limit' => 1]);
$prices = $app->make(App\Services\AiPriceRuleActions::class)->read();
$missing = array_values(array_diff($expected, $names));
echo json_encode(['ready' => $app->make(App\Services\AiManagementOperations::class)->ready(), 'total_agent_tools' => count($names), 'management_tools' => count($expected), 'missing_tools' => $missing, 'context_lists_management' => count($context['data']['available_management_tools']), 'product_read_succeeded' => isset($products['items']), 'price_read_succeeded' => isset($prices['configured']), 'writes_performed' => $writes], JSON_PRETTY_PRINT).PHP_EOL;
exit($missing || $writes ? 1 : 0);
