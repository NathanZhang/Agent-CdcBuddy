[CmdletBinding()]
param(
    [string]$ImageName = 'agent-cdcbuddy:2.0.0'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sourceDatabase = Join-Path $projectRoot 'vector_monitoring.db'
if (-not (Test-Path -LiteralPath $sourceDatabase -PathType Leaf)) {
    throw "Missing test database: $sourceDatabase"
}

$containerName = "cdcbuddy-business-migration-$PID"
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "$containerName-$([guid]::NewGuid().ToString('N'))"
$dataPath = Join-Path $testRoot 'data'
$factPath = Join-Path $testRoot 'vector_monitoring.db'

try {
    New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
    Copy-Item -LiteralPath $sourceDatabase -Destination $factPath

    & docker run --rm --entrypoint python3 `
        --mount "type=bind,source=$dataPath,target=/work" `
        $ImageName -c "import sqlite3; c=sqlite3.connect('/work/app_business.db'); c.execute('create table migration_probe(value text not null)'); c.execute('insert into migration_probe values (?)', ('preserved',)); c.commit(); c.close()"
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to create the legacy business database fixture'
    }

    $containerId = (& docker run -d --name $containerName `
        -e 'AGENT_DOMAIN=vector' `
        -e 'NEXT_PUBLIC_AGENT_DOMAIN=vector' `
        -e 'APP_BUSINESS_DB_PATH=/app/data/vector/app_business.db' `
        --mount "type=bind,source=$factPath,target=/app/vector_monitoring.db,readonly" `
        --mount "type=bind,source=$dataPath,target=/app/data" `
        $ImageName).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $containerId) {
        throw 'Unable to start the business database migration test container'
    }

    Start-Sleep -Seconds 5
    $status = (& docker inspect $containerName --format '{{.State.Status}}').Trim()
    if ($status -ne 'running') {
        $logs = (& docker logs $containerName 2>&1 | Out-String)
        throw "Migration test container exited unexpectedly: $status`n$logs"
    }

    $probeOutput = (& docker exec $containerName python3 -c "import sqlite3; print(sqlite3.connect('/app/data/vector/app_business.db').execute('select value from migration_probe').fetchone()[0])" 2>&1 | Out-String)
    $probeExitCode = $LASTEXITCODE
    $probe = $probeOutput.Trim()
    if ($probeExitCode -ne 0 -or $probe -ne 'preserved') {
        throw 'Legacy business data was not preserved in the vector database'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'app_business.db') -PathType Leaf)) {
        throw 'Legacy business database must remain available for rollback'
    }

    Write-Host "PASS: Legacy business data is copied into the vector database ($ImageName)"
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
