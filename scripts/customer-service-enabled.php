<?php

require dirname(__DIR__).'/laravel/vendor/autoload.php';
$app = require dirname(__DIR__).'/laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
echo app(App\Services\TelegramSupport\Settings::class)->get()['enabled'] ? 'enabled' : 'disabled';
