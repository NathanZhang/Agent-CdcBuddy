$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $projectRoot
try {
    $requiredFiles = @(
        'Dockerfile',
        '.dockerignore',
        'docker/entrypoint.sh',
        'compose.production.yml'
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
            throw "Missing deployment artifact: $file"
        }
    }

    $dockerIgnore = Get-Content -LiteralPath '.dockerignore' -Raw
    foreach ($pattern in @('*.db', '.env', '.env*.local')) {
        if ($dockerIgnore -notmatch [regex]::Escape($pattern)) {
            throw "Docker context does not exclude: $pattern"
        }
    }

    $compose = Get-Content -LiteralPath 'compose.production.yml' -Raw
    foreach ($contract in @('APP_IMAGE', 'APP_PORT', 'DEPLOY_DIR', 'vector_monitoring.db', 'read_only: true', 'APP_BUSINESS_DB_PATH')) {
        if ($compose -notmatch [regex]::Escape($contract)) {
            throw "Compose contract is missing: $contract"
        }
    }

    $entrypointBytes = [System.IO.File]::ReadAllBytes((Resolve-Path 'docker/entrypoint.sh'))
    if ($entrypointBytes.Length -ge 3 -and $entrypointBytes[0] -eq 0xEF -and $entrypointBytes[1] -eq 0xBB -and $entrypointBytes[2] -eq 0xBF) {
        throw 'docker/entrypoint.sh must not contain a UTF-8 BOM'
    }

    $credentialMatches = git grep -n -E 'sk-[a-zA-Z0-9]{20,}' -- 'src/*.ts' 'src/*.tsx' 'scripts/*.js' 'scripts/*.ts'
    if ($LASTEXITCODE -eq 0 -and $credentialMatches) {
        throw 'Hard-coded API credential remains in tracked runtime source'
    }

    $gitIgnore = Get-Content -LiteralPath '.gitignore' -Raw
    if ($gitIgnore -notmatch [regex]::Escape('/scripts/deploy/deploy.config.ps1')) {
        throw 'Local deployment configuration is not ignored'
    }

    Write-Host 'PASS: Docker deployment artifacts'
}
finally {
    Pop-Location
}
