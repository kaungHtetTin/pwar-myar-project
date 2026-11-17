function Read-ShopEnvironment([string]$Workspace, [string]$EnvFile) {
    # Match Vite's mode=production file precedence. This reads only public shop settings.
    $files = @('shop\.env', 'shop\.env.local', 'shop\.env.production', 'shop\.env.production.local')
    if ($EnvFile) {
        if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { throw "Environment file does not exist: $EnvFile" }
        $files = @((Resolve-Path -LiteralPath $EnvFile).Path)
    } else { $files = @($files | ForEach-Object { Join-Path $Workspace $_ }) }
    $settings = @{}
    foreach ($file in $files) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
        foreach ($line in Get-Content -LiteralPath $file) {
            if ($line -match '^\s*(?:export\s+)?(VITE_API_URL|VITE_SHOP_URL|VITE_DEFAULT_STORE)\s*=\s*(.*?)\s*$') {
                $name = $Matches[1]
                $value = $Matches[2]
                if ($value -match '^"(.*)"\s*(?:#.*)?$' -or $value -match "^'(.*)'\s*(?:#.*)?$") {
                    $value = $Matches[1]
                } else { $value = ($value -replace '\s+#.*$', '').Trim() }
                if ($value -match '\$') { throw "Use a literal value for $name; variable expansion is not supported by this script." }
                $settings[$name] = $value
            }
        }
    }
    foreach ($name in @('VITE_API_URL', 'VITE_SHOP_URL', 'VITE_DEFAULT_STORE')) {
        $value = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($null -ne $value) { $settings[$name] = $value }
    }
    return $settings
}
