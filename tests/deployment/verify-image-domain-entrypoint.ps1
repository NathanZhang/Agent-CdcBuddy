[CmdletBinding()]
param(
    [string]$ImageName = 'agent-cdcbuddy:2.0.0',
    [ValidateSet('vector', 'foodborne', 'env', 'chronic')]
    [string]$Domain = 'foodborne'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$databaseByDomain = @{
    vector = 'vector_monitoring.db'
    foodborne = 'foodborne_monitoring.db'
    env = 'env_monitoring.db'
    chronic = 'chronic_monitoring.db'
}
$databaseName = $databaseByDomain[$Domain]
$sourceDatabase = Join-Path $projectRoot $databaseName
if (-not (Test-Path -LiteralPath $sourceDatabase -PathType Leaf)) {
    throw "Missing test database: $sourceDatabase"
}

$containerName = "cdcbuddy-domain-entrypoint-$Domain-$PID"
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "$containerName-$([guid]::NewGuid().ToString('N'))"
$dataPath = Join-Path $testRoot 'data'
$factPath = Join-Path $testRoot $databaseName

try {
    New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
    Copy-Item -LiteralPath $sourceDatabase -Destination $factPath

    $containerId = (& docker run -d --name $containerName `
        -e "AGENT_DOMAIN=$Domain" `
        -e "NEXT_PUBLIC_AGENT_DOMAIN=$Domain" `
        -e 'APP_BUSINESS_DB_PATH=/app/data/app_business.db' `
        --mount "type=bind,source=$factPath,target=/app/$databaseName,readonly" `
        --mount "type=bind,source=$dataPath,target=/app/data" `
        $ImageName).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $containerId) {
        throw "Unable to start domain entrypoint test container for $Domain"
    }

    Start-Sleep -Seconds 5
    $ErrorActionPreference = 'Continue'
    $logs = (& docker logs $containerName 2>&1 | Out-String)
    $ErrorActionPreference = 'Stop'
    if ($logs -match 'PermissionError|OperationalError|unable to open database file') {
        throw "Entrypoint initialized unrelated domain databases for $Domain`n$logs"
    }

    $status = (& docker inspect $containerName --format '{{.State.Status}}').Trim()
    if ($status -ne 'running') {
        throw "Domain entrypoint test container exited unexpectedly: $status`n$logs"
    }

    Write-Host "PASS: Entrypoint only initializes the active domain ($Domain)"
}
finally {
    & docker rm -f $containerName 2>$null | Out-Null
    if (Test-Path -LiteralPath $testRoot) {
        $resolvedRoot = [IO.Path]::GetFullPath($testRoot)
        $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
        if (-not $resolvedRoot.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove non-temporary test path: $resolvedRoot"
        }
        Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
    }
}
