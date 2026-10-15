[CmdletBinding()]
param(
    [string]$ImageName = 'agent-cdcbuddy:2.1.3',
    [ValidateSet('vector', 'foodborne', 'env', 'chronic')]
    [string]$Domain = 'env'
)

$ErrorActionPreference = 'Stop'
$databaseNames = @{
    vector = 'vector_monitoring.db'
    foodborne = 'foodborne_monitoring.db'
    env = 'env_monitoring.db'
    chronic = 'chronic_monitoring.db'
}
$containerName = "cdcbuddy-missing-db-$Domain-$PID"
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "$containerName-$([guid]::NewGuid().ToString('N'))"
$dataPath = Join-Path $testRoot 'data'

try {
    New-Item -ItemType Directory -Force -Path $dataPath | Out-Null

    $containerId = (& docker run -d --name $containerName `
        -e "AGENT_DOMAIN=$Domain" `
        -e "NEXT_PUBLIC_AGENT_DOMAIN=$Domain" `
        -e "APP_BUSINESS_DB_PATH=/app/data/$Domain/app_business.db" `
        --mount "type=bind,source=$dataPath,target=/app/data" `
        $ImageName).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $containerId) {
        throw 'Unable to start the missing fact database test container'
    }

    & docker wait $containerName | Out-Null
    $logs = (& docker logs $containerName 2>&1 | Out-String)
    $expected = "[ENTRYPOINT ERROR] Required fact database not mounted: /app/$($databaseNames[$Domain])"
    if ($logs -notmatch [regex]::Escape($expected)) {
        throw "Expected a clear missing database error, but received:`n$logs"
    }
    if ($logs -match 'PermissionError|OperationalError|unable to open database') {
        throw "Missing database handling leaked an implementation error:`n$logs"
    }

    Write-Host "PASS: Missing $Domain fact database fails with a clear diagnostic ($ImageName)"
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
