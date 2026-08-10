[CmdletBinding()]
param(
    [string]$ImageName = 'agent-cdcbuddy:1.0.0',
    [string]$OutputPath = '.deploy-artifacts/agent-cdcbuddy-1.0.0-linux-amd64.tar',
    [string]$TiandituKey = $env:NEXT_PUBLIC_TIANDITU_KEY
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $projectRoot
try {
    & docker info --format '{{.ServerVersion}}' | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'Docker daemon is not available' }

    $buildArgs = @('buildx', 'build', '--progress', 'plain', '--platform', 'linux/amd64', '--load', '--tag', $ImageName)
    if ($TiandituKey) {
        $buildArgs += @('--build-arg', "NEXT_PUBLIC_TIANDITU_KEY=$TiandituKey")
    }
    $buildArgs += '.'
    & docker @buildArgs
    if ($LASTEXITCODE -ne 0) { throw 'Docker image build failed' }

    $platform = (& docker image inspect $ImageName --format '{{.Os}}/{{.Architecture}}').Trim()
    if ($LASTEXITCODE -ne 0 -or $platform -ne 'linux/amd64') {
        throw "Unexpected image platform: $platform"
    }

    & (Join-Path $projectRoot 'tests\deployment\verify-image-entrypoint.ps1') -ImageName $ImageName

    $absoluteOutput = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
    $artifactRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot '.deploy-artifacts'))
    if (-not $absoluteOutput.StartsWith($artifactRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Output tar must be under $artifactRoot"
    }
    New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
    $temporaryOutput = "$absoluteOutput.incoming"
    if (Test-Path -LiteralPath $temporaryOutput) { Remove-Item -LiteralPath $temporaryOutput -Force }

    & docker save --output $temporaryOutput $ImageName
    if ($LASTEXITCODE -ne 0) { throw 'Docker image export failed' }
    if ((Get-Item -LiteralPath $temporaryOutput).Length -le 0) { throw 'Exported image tar is empty' }

    if (Test-Path -LiteralPath $absoluteOutput) { Remove-Item -LiteralPath $absoluteOutput -Force }
    Move-Item -LiteralPath $temporaryOutput -Destination $absoluteOutput
    Get-Item -LiteralPath $absoluteOutput | Select-Object FullName, Length, LastWriteTime
}
finally {
    Pop-Location
}
