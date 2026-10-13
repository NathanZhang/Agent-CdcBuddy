[CmdletBinding()]
param([string]$ConfigPath)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'remote-common.ps1')
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$config = Get-DeploymentConfig -ConfigPath $ConfigPath
$agents = @(Get-AgentDeploymentDefinitions -Config $config)
$remotePath = Assert-SafeRemotePath $config.RemotePath
$quotedRemotePath = ConvertTo-RemoteShellArgument $remotePath
$tarPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $config.TarPath))
$composePath = Join-Path $projectRoot 'compose.production.yml'
$envExamplePath = Join-Path $projectRoot '.env.example'

$requiredFiles = @($tarPath, $composePath, $envExamplePath)
$requiredFiles += $agents | ForEach-Object { Join-Path $projectRoot $_.Database }
foreach ($required in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Required deployment file is missing: $required"
    }
}

$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$prepareCommand = "mkdir -p -- $quotedRemotePath; if [ -f $quotedRemotePath/compose.production.yml ]; then cp -- $quotedRemotePath/compose.production.yml $quotedRemotePath/compose.production.yml.pre-2.0.1-$timestamp; fi; if [ -f $quotedRemotePath/deploy.env ]; then cp -- $quotedRemotePath/deploy.env $quotedRemotePath/deploy.env.pre-2.0.1-$timestamp; fi"
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $prepareCommand | Out-Host

Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath $composePath -RemotePath "$remotePath/compose.production.yml"
Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath $envExamplePath -RemotePath "$remotePath/.env.example"

foreach ($agent in $agents) {
    $remoteDatabase = "$remotePath/$($agent.Database)"
    $quotedRemoteDatabase = ConvertTo-RemoteShellArgument $remoteDatabase
    $existsOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "test -s $quotedRemoteDatabase && printf yes || printf no")
    if (([string]$existsOutput[-1]).Trim() -ne 'yes') {
        Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath (Join-Path $projectRoot $agent.Database) -RemotePath "$remoteDatabase.incoming"
        Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "mv -- $(ConvertTo-RemoteShellArgument "$remoteDatabase.incoming") $quotedRemoteDatabase && chown root:1000 $quotedRemoteDatabase && chmod 0640 $quotedRemoteDatabase" | Out-Host
    }
}

$publicHost = ($config.RemoteHost -split '@')[-1]
$deployEnv = @(
    "APP_IMAGE=$($config.ImageName)"
    "DEPLOY_DIR=$remotePath"
    "VECTOR_PORT=$($config.VectorPort)"
    "FOODBORNE_PORT=$($config.FoodbornePort)"
    "ENV_PORT=$($config.EnvPort)"
    "CHRONIC_PORT=$($config.ChronicPort)"
)
foreach ($agent in $agents) {
    $originProperty = $agent.Domain + 'Origin'
    $origin = [string]$config.$originProperty
    if ([string]::IsNullOrWhiteSpace($origin)) {
        $origin = "http://${publicHost}:$($agent.Port)"
    }
    $uri = $null
    if (-not [Uri]::TryCreate($origin, [UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -notin @('http', 'https') -or $uri.UserInfo -or
        $uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment) {
        throw "Invalid browser origin for $($agent.Domain)"
    }
    $deployEnv += "$($agent.Domain.ToUpperInvariant())_ORIGIN=$($uri.GetLeftPart([UriPartial]::Authority))"
}
$deployEnv = ($deployEnv -join "`n") + "`n"
$encodedDeployEnv = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($deployEnv))
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "printf %s $(ConvertTo-RemoteShellArgument $encodedDeployEnv) | base64 -d > $quotedRemotePath/deploy.env" | Out-Host

$tarFileName = Split-Path $tarPath -Leaf
$remoteTarPath = "$remotePath/$tarFileName"
$quotedRemoteTarPath = ConvertTo-RemoteShellArgument $remoteTarPath
$localTarHash = Get-FileSha256 -Path $tarPath
$remoteTarHashOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "if [ -f $quotedRemoteTarPath ]; then sha256sum $quotedRemoteTarPath | awk '{print `$1}'; fi")
$remoteTarHashText = if ($remoteTarHashOutput.Count -gt 0) { ([string]$remoteTarHashOutput[-1]).Trim() } else { '' }
$artifactChanged = -not (Test-ArtifactSha256Match -LocalHash $localTarHash -RemoteHashText $remoteTarHashText)

if ($artifactChanged) {
    $remoteIncomingTarPath = "$remoteTarPath.incoming"
    $quotedRemoteIncomingTarPath = ConvertTo-RemoteShellArgument $remoteIncomingTarPath
    Copy-ToRemote -RemoteHost $config.RemoteHost -LocalPath $tarPath -RemotePath $remoteIncomingTarPath
    $uploadedTarHashOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "sha256sum $quotedRemoteIncomingTarPath | awk '{print `$1}'")
    $uploadedTarHash = ([string]$uploadedTarHashOutput[-1]).Trim()
    if (-not (Test-ArtifactSha256Match -LocalHash $localTarHash -RemoteHashText $uploadedTarHash)) {
        throw "Uploaded image artifact failed SHA-256 verification: $remoteIncomingTarPath"
    }
    Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "mv -- $quotedRemoteIncomingTarPath $quotedRemoteTarPath" | Out-Host
}

$quotedImageName = ConvertTo-RemoteShellArgument $config.ImageName
$imagePresentOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker image inspect $quotedImageName >/dev/null 2>&1 && echo yes || echo no")
$imagePresent = $imagePresentOutput.Count -gt 0 -and ([string]$imagePresentOutput[-1]).Trim() -eq 'yes'
if ($artifactChanged -or -not $imagePresent) {
    Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker load --input $quotedRemoteTarPath" | Out-Host
}

$stopLegacyCommand = @'
if docker inspect agent-cdcbuddy >/dev/null 2>&1; then
  docker stop --time 30 agent-cdcbuddy >/dev/null
  if [ "$(docker inspect --format '{{.State.Running}}' agent-cdcbuddy)" != "false" ]; then
    echo 'Legacy container did not stop cleanly' >&2
    exit 1
  fi
fi
'@
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $stopLegacyCommand | Out-Host

$dataSetup = @"
if [ ! -f $remotePath/.env ]; then
  cp -- $remotePath/.env.example $remotePath/.env
  chmod 0600 $remotePath/.env
fi
mkdir -p -- $remotePath/data/vector $remotePath/data/foodborne $remotePath/data/env $remotePath/data/chronic
chown 1000:1000 $remotePath/data $remotePath/data/vector $remotePath/data/foodborne $remotePath/data/env $remotePath/data/chronic
chmod 0750 $remotePath/data $remotePath/data/vector $remotePath/data/foodborne $remotePath/data/env $remotePath/data/chronic
chown root:1000 $remotePath/vector_monitoring.db $remotePath/foodborne_monitoring.db $remotePath/env_monitoring.db $remotePath/chronic_monitoring.db
chmod 0640 $remotePath/vector_monitoring.db $remotePath/foodborne_monitoring.db $remotePath/env_monitoring.db $remotePath/chronic_monitoring.db
find $remotePath/data -type f -name '*.db*' -exec chown 1000:1000 {} \;
find $remotePath/data -type f -name '*.db*' -exec chmod 0660 {} \;
"@
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $dataSetup | Out-Host

# The entrypoint performs locked business + checkpoint backup after the legacy writer stops.
# Do not create the target business DB here: that would suppress paired migration.

$startCommand = "cd $quotedRemotePath && docker compose --env-file deploy.env -f compose.production.yml up -d --pull never --force-recreate"
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $startCommand | Out-Host

foreach ($agent in $agents) {
    $healthy = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $healthOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $(ConvertTo-RemoteShellArgument $agent.Container)")
        $health = ([string]$healthOutput[-1]).Trim()
        if ($health -eq 'healthy') {
            $healthy = $true
            break
        }
        if ($health -in @('unhealthy', 'exited', 'dead')) {
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $healthy) {
        $logs = Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker logs --tail 100 $(ConvertTo-RemoteShellArgument $agent.Container) 2>&1"
        throw "Remote container $($agent.Container) did not become healthy:`n$logs"
    }
}

$publicHost = ($config.RemoteHost -split '@')[-1]
$results = foreach ($agent in $agents) {
    $url = "http://${publicHost}:$($agent.Port)"
    foreach ($path in @('/', '/api/health/ready')) {
        $response = Invoke-WebRequest -Uri "$url$path" -UseBasicParsing -TimeoutSec 15
        if ($response.StatusCode -ne 200) {
            throw "Remote HTTP smoke test returned $($response.StatusCode): $url$path"
        }
    }
    [pscustomobject]@{
        Domain = $agent.Domain
        Container = $agent.Container
        Port = $agent.Port
        Url = "$url/"
        Health = 'healthy'
    }
}
$results
