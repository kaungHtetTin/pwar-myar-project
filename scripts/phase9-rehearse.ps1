[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_]+$')]
    [string]$SourceDatabase,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_]+_rehearsal$')]
    [string]$RehearsalDatabase,

    [string]$DatabaseHost = '127.0.0.1',
    [int]$DatabasePort = 3306,
    [string]$DatabaseUser = 'root',
    [string]$MySqlDefaultsFile,
    [string]$BackupDirectory = (Join-Path $PSScriptRoot '..\laravel\storage\app\rollout-backups')
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$laravel = Join-Path $workspace 'laravel'
$migration = '2026_08_20_000000_add_trial_subscription_classification'
$migrationFile = 'database/migrations/2026_08_20_000000_add_trial_subscription_classification.php'

if ($SourceDatabase -eq $RehearsalDatabase) {
    throw 'The rehearsal database must be different from the source database.'
}

function Resolve-MySqlTool([string]$Name) {
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $xamppTool = "C:\xampp\mysql\bin\$Name.exe"
    if (Test-Path -LiteralPath $xamppTool) { return $xamppTool }
    throw "$Name was not found in PATH or C:\xampp\mysql\bin."
}

$mysql = Resolve-MySqlTool 'mysql'
$mysqldump = Resolve-MySqlTool 'mysqldump'
$connectionArgs = @()
if ($MySqlDefaultsFile) {
    $resolvedDefaults = (Resolve-Path -LiteralPath $MySqlDefaultsFile).Path
    $connectionArgs += "--defaults-extra-file=$resolvedDefaults"
}
$connectionArgs += @("--host=$DatabaseHost", "--port=$DatabasePort", "--user=$DatabaseUser")

New-Item -ItemType Directory -Force -Path $BackupDirectory | Out-Null
$backupDirectoryPath = (Resolve-Path -LiteralPath $BackupDirectory).Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $backupDirectoryPath "$SourceDatabase-before-phase9-$stamp.sql"
$evidenceFile = Join-Path $backupDirectoryPath "phase9-rehearsal-$stamp.json"

& $mysqldump @connectionArgs --single-transaction --routines --triggers --hex-blob "--result-file=$backupFile" $SourceDatabase
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $backupFile)) {
    throw 'The source database backup failed. Rehearsal was not started.'
}

$targetExists = & $mysql @connectionArgs --batch --skip-column-names information_schema "--execute=SELECT COUNT(*) FROM SCHEMATA WHERE SCHEMA_NAME = '$RehearsalDatabase'"
if ([int]$targetExists -eq 0) {
    & $mysql @connectionArgs "--execute=CREATE DATABASE ``$RehearsalDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the rehearsal database.' }
} else {
    $tableCount = & $mysql @connectionArgs --batch --skip-column-names information_schema "--execute=SELECT COUNT(*) FROM TABLES WHERE TABLE_SCHEMA = '$RehearsalDatabase'"
    if ([int]$tableCount -ne 0) {
        throw "The rehearsal database [$RehearsalDatabase] is not empty. Use a new *_rehearsal database."
    }
}

$sourceCommand = 'source ' + ($backupFile -replace '\\', '/')
& $mysql @connectionArgs $RehearsalDatabase "--execute=$sourceCommand"
if ($LASTEXITCODE -ne 0) { throw 'Importing the production-like copy failed.' }

$previousDatabase = [Environment]::GetEnvironmentVariable('DB_DATABASE', 'Process')
$previousEnvironment = [Environment]::GetEnvironmentVariable('APP_ENV', 'Process')
try {
    $env:DB_DATABASE = $RehearsalDatabase
    $env:APP_ENV = 'phase9-rehearsal'

    $migrationCount = & $mysql @connectionArgs --batch --skip-column-names $RehearsalDatabase "--execute=SELECT COUNT(*) FROM migrations WHERE migration = '$migration'"
    if ([int]$migrationCount -gt 0) {
        & $mysql @connectionArgs $RehearsalDatabase "--execute=DELETE payments FROM subscription_payments payments JOIN subscription_plans plans ON plans.id = payments.subscription_plan_id WHERE plans.is_system = 1; DELETE requests FROM subscription_requests requests JOIN subscription_plans plans ON plans.id = requests.subscription_plan_id WHERE plans.is_system = 1; DELETE subscriptions FROM business_subscriptions subscriptions JOIN subscription_plans plans ON plans.id = subscriptions.subscription_plan_id WHERE plans.is_system = 1;"
        if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the rehearsal copy for a pre-trial migration state.' }
        Push-Location $laravel
        try { & php artisan migrate:rollback "--path=$migrationFile" --force --no-interaction }
        finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { throw 'Preparing the pre-trial schema through the migration rollback failed.' }
    }

    $businessesBefore = [int](& $mysql @connectionArgs --batch --skip-column-names $RehearsalDatabase '--execute=SELECT COUNT(*) FROM businesses')
    $subscriptionsBefore = [int](& $mysql @connectionArgs --batch --skip-column-names $RehearsalDatabase '--execute=SELECT COUNT(*) FROM business_subscriptions')

    Push-Location $laravel
    try {
        & php artisan migrate --force --no-interaction
        if ($LASTEXITCODE -ne 0) { throw 'Forward migration rehearsal failed.' }
        & php artisan trial:rollout-check --json
        if ($LASTEXITCODE -ne 0) { throw 'Post-migration rollout checks failed.' }

        & php artisan migrate:rollback "--path=$migrationFile" --force --no-interaction
        if ($LASTEXITCODE -ne 0) { throw 'Rollback rehearsal failed.' }

        & php artisan migrate --force --no-interaction
        if ($LASTEXITCODE -ne 0) { throw 'Second forward migration after rollback failed.' }
        & php artisan trial:rollout-check --json
        if ($LASTEXITCODE -ne 0) { throw 'Final rollout checks failed.' }
    } finally {
        Pop-Location
    }

    $businessesAfter = [int](& $mysql @connectionArgs --batch --skip-column-names $RehearsalDatabase '--execute=SELECT COUNT(*) FROM businesses')
    $subscriptionsAfter = [int](& $mysql @connectionArgs --batch --skip-column-names $RehearsalDatabase '--execute=SELECT COUNT(*) FROM business_subscriptions')
    if ($businessesAfter -ne $businessesBefore -or $subscriptionsAfter -ne $subscriptionsBefore) {
        throw 'Migration rehearsal changed pre-existing business or subscription row counts.'
    }

    $evidence = [ordered]@{
        completed_at = (Get-Date).ToString('o')
        source_database = $SourceDatabase
        rehearsal_database = $RehearsalDatabase
        backup_file = $backupFile
        forward_migration = 'passed'
        rollback = 'passed'
        second_forward_migration = 'passed'
        rollout_check = 'passed'
        businesses_preserved = $businessesAfter
        subscriptions_preserved = $subscriptionsAfter
    }
    $evidence | ConvertTo-Json | Set-Content -LiteralPath $evidenceFile -Encoding UTF8
    Write-Host "Phase 9 rehearsal passed. Evidence: $evidenceFile"
} finally {
    [Environment]::SetEnvironmentVariable('DB_DATABASE', $previousDatabase, 'Process')
    [Environment]::SetEnvironmentVariable('APP_ENV', $previousEnvironment, 'Process')
}
