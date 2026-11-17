<?php

// CLI-only: replace this workspace's root connection with a scoped local user.
if (PHP_SAPI !== 'cli') exit(1);
require __DIR__.'/../laravel/vendor/autoload.php';
$app = require __DIR__.'/../laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (!app()->environment('local') || !in_array(config('database.connections.mysql.host'), ['localhost', '127.0.0.1'], true)) {
    fwrite(STDERR, "This helper is restricted to the local workspace.\n"); exit(1);
}
if (config('database.connections.mysql.username') !== 'root') {
    echo "The workspace already uses a non-root database account.\n"; exit(0);
}
$database = config('database.connections.mysql.database');
if (!preg_match('/^mkpos[a-z0-9_]*$/', $database)) exit(1);
$pdo = Illuminate\Support\Facades\DB::connection()->getPdo();
$username = 'mkpos_app_'.bin2hex(random_bytes(4));
$password = bin2hex(random_bytes(32));
$userSql = $pdo->quote($username)."@'localhost'";
$pdo->exec('CREATE USER '.$userSql.' IDENTIFIED BY '.$pdo->quote($password));
try {
    foreach (array_unique([$database, 'mkpos_order_alert_test']) as $schema) {
        $pdo->exec('GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES ON `'.$schema.'`.* TO '.$userSql);
    }
    $probe = new PDO('mysql:host=127.0.0.1;port='.(int) config('database.connections.mysql.port').';dbname='.$database, $username, $password, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $probe->query('SELECT 1');
    $envPath = $app->environmentFilePath();
    $env = file_get_contents($envPath);
    $env = preg_replace('/^DB_USERNAME=.*$/m', 'DB_USERNAME='.$username, $env);
    $env = preg_replace('/^DB_PASSWORD=.*$/m', 'DB_PASSWORD='.$password, $env);
    if (file_put_contents($envPath, $env, LOCK_EX) === false) throw new RuntimeException('Unable to save private environment.');
    echo "Scoped application database account created and verified. Credentials saved only in the private Laravel .env.\n";
} catch (Throwable $error) {
    $pdo->exec('DROP USER '.$userSql);
    fwrite(STDERR, "Local database hardening failed; the previous application connection is unchanged.\n"); exit(1);
}
