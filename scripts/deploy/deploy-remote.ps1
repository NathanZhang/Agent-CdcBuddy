[CmdletBinding()]
param(
    [string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'remote-common.ps1')
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$config = Get-DeploymentConfig -ConfigPath $ConfigPath
$remotePath = Assert-SafeRemotePath $config.RemotePath
$quotedRemotePath = ConvertTo-RemoteShellArgument $remotePath
$tarPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $config.TarPath))
$vectorDbPath = Join-Path $projectRoot 'vector_monitoring.db'

foreach ($required in @($tarPath, $vectorDbPath, (Join-Path $projectRoot 'compose.production.yml'), (Join-Path $projectRoot '.env.example'))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Required deployment file is missing: $required"
    }
}

Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "mkdir -p -- $quotedRemotePath" | Out-Host

Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath (Join-Path $projectRoot 'compose.production.yml') -RemotePath "$remotePath/compose.production.yml"
Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath (Join-Path $projectRoot '.env.example') -RemotePath "$remotePath/.env.example"

$hasVectorDb = [string](Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "test -f $quotedRemotePath/vector_monitoring.db && printf yes || printf no")
if ($hasVectorDb.Trim() -ne 'yes') {
    Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath $vectorDbPath -RemotePath "$remotePath/vector_monitoring.db.incoming"
    Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "mv -- $quotedRemotePath/vector_monitoring.db.incoming $quotedRemotePath/vector_monitoring.db && chmod 0644 $quotedRemotePath/vector_monitoring.db" | Out-Host
}

Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "if [ ! -f $quotedRemotePath/.env ]; then cp -- $quotedRemotePath/.env.example $quotedRemotePath/.env; chmod 0600 $quotedRemotePath/.env; fi; mkdir -p -- $quotedRemotePath/data; if [ -f $quotedRemotePath/app_business.db ] && [ ! -f $quotedRemotePath/data/app_business.db ]; then mv -- $quotedRemotePath/app_business.db $quotedRemotePath/data/app_business.db; fi; chown -R 1000:1000 $quotedRemotePath/data; chmod 0775 $quotedRemotePath/data; if [ -f $quotedRemotePath/data/app_business.db ]; then chmod 0664 $quotedRemotePath/data/app_business.db; fi" | Out-Host

$savedPortOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "if [ -f $quotedRemotePath/deploy.env ]; then sed -n 's/^APP_PORT=//p' $quotedRemotePath/deploy.env | head -n 1; fi")
$savedPort = 0
$hasSavedPort = $savedPortOutput.Count -gt 0 -and [int]::TryParse(([string]$savedPortOutput[-1]).Trim(), [ref]$savedPort) -and $savedPort -ge $config.PortStart -and $savedPort -le $config.PortEnd
if (-not $hasSavedPort) {
    $savedPort = Get-FirstFreeRemotePort -RemoteHost $config.RemoteHost -Start $config.PortStart -End $config.PortEnd
}

$deployEnv = "APP_IMAGE=$($config.ImageName)`nAPP_PORT=$savedPort`nDEPLOY_DIR=$remotePath`n"
$encodedDeployEnv = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($deployEnv))
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "printf %s $(ConvertTo-RemoteShellArgument $encodedDeployEnv) | base64 -d > $quotedRemotePath/deploy.env" | Out-Host

$tarFileName = Split-Path $tarPath -Leaf
$remoteTarPath = "$remotePath/$tarFileName"
$quotedRemoteTarPath = ConvertTo-RemoteShellArgument $remoteTarPath
$localTarSize = (Get-Item -LiteralPath $tarPath).Length
$remoteTarSizeOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "if [ -f $quotedRemoteTarPath ]; then stat -c %s $quotedRemoteTarPath; else echo 0; fi")
$remoteTarSizeText = if ($remoteTarSizeOutput.Count -gt 0) { ([string]$remoteTarSizeOutput[-1]).Trim() } else { '0' }
$artifactChanged = -not (Test-ArtifactSizeMatch -LocalSize $localTarSize -RemoteSizeText $remoteTarSizeText)

if ($artifactChanged) {
    Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath $tarPath -RemotePath "$remoteTarPath.incoming"
    Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "mv -- $(ConvertTo-RemoteShellArgument "$remoteTarPath.incoming") $quotedRemoteTarPath" | Out-Host
}

$imagePresentOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker image inspect $(ConvertTo-RemoteShellArgument $config.ImageName) >/dev/null 2>&1 && echo yes || echo no")
$imagePresent = $imagePresentOutput.Count -gt 0 -and ([string]$imagePresentOutput[-1]).Trim() -eq 'yes'
if ($artifactChanged -or -not $imagePresent) {
    Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker load --input $quotedRemoteTarPath" | Out-Host
}

$startCommand = "cd $quotedRemotePath && docker compose --env-file deploy.env -f compose.production.yml up -d --pull never --force-recreate"
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $startCommand | Out-Host

$healthy = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    $healthOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $(ConvertTo-RemoteShellArgument $config.ContainerName)")
    $health = ([string]$healthOutput[-1]).Trim()
    if ($health -eq 'healthy') {
        $healthy = $true
        break
    }
    if ($health -eq 'unhealthy' -or $health -eq 'exited' -or $health -eq 'dead') {
        break
    }
    Start-Sleep -Seconds 3
}

if (-not $healthy) {
    $logs = Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker logs --tail 100 $(ConvertTo-RemoteShellArgument $config.ContainerName) 2>&1"
    throw "Remote container did not become healthy:`n$logs"
}

$response = Invoke-WebRequest -Uri "http://39.106.143.253:$savedPort/" -UseBasicParsing -TimeoutSec 15
if ($response.StatusCode -ne 200) {
    throw "Remote HTTP smoke test returned $($response.StatusCode)"
}

[pscustomobject]@{
    RemoteHost = $config.RemoteHost
    RemotePath = $remotePath
    Port = $savedPort
    Url = "http://39.106.143.253:$savedPort/"
    Health = 'healthy'
}
