<?php

// Render a fixture preview only; this script does not connect to SMTP or send mail.
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require __DIR__.'/../laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$details = [
    'business_name' => 'Demo Shop', 'plan_name' => 'PwarMyar Pro Monthly',
    'amount_paid' => 25000, 'currency' => 'Ks',
    'starts_at' => '17 Oct 2026, 18:30 +0630', 'ends_at' => '16 Nov 2026, 18:30 +0630',
    'approved_at' => '17 Oct 2026, 18:30 +0630', 'reference' => 'REQ-1234',
];
$directory = __DIR__.'/../artifacts/subscription-email';
if (!is_dir($directory)) mkdir($directory, 0777, true);
file_put_contents($directory.'/preview.html', view('emails.subscription-approved', ['name' => 'Demo Owner', 'details' => $details])->render());
file_put_contents($directory.'/preview.txt', view('emails.subscription-approved-text', ['name' => 'Demo Owner', 'details' => $details])->render());
echo "Rendered subscription approval email preview.\n";
