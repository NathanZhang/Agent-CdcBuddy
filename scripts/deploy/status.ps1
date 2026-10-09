[CmdletBinding()]
param([string]$ConfigPath)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'remote-common.ps1')
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
}
$config = Get-DeploymentConfig -ConfigPath $ConfigPath
$agents = @(Get-AgentDeploymentDefinitions -Config $config)
$remotePath = Assert-SafeRemotePath $config.RemotePath
$quotedRemotePath = ConvertTo-RemoteShellArgument $remotePath
$containerArguments = ($agents | ForEach-Object { ConvertTo-RemoteShellArgument $_.Container }) -join ' '

$remoteTemplate = @'
docker ps -a --filter name=agent-cdcbuddy- --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'; printf '\nMounts:\n'; for container in __CONTAINERS__; do echo "[$container]"; docker inspect --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} (rw={{.RW}}){{println}}{{end}}' "$container"; done; printf '\nDeployment:\n'; cat __REMOTE_PATH__/deploy.env
'@
$remoteCommand = $remoteTemplate.Replace('__CONTAINERS__', $containerArguments).Replace('__REMOTE_PATH__', $quotedRemotePath)
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $remoteCommand | Out-Host

$publicHost = ($config.RemoteHost -split '@')[-1]
foreach ($agent in $agents) {
    $url = "http://${publicHost}:$($agent.Port)/"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    Write-Host "$($agent.Domain): HTTP $($response.StatusCode) $url"
}
