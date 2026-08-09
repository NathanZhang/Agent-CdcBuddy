[CmdletBinding()]
param([string]$ConfigPath)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'remote-common.ps1')
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
}
$config = Get-DeploymentConfig -ConfigPath $ConfigPath
$remotePath = Assert-SafeRemotePath $config.RemotePath
$quotedRemotePath = ConvertTo-RemoteShellArgument $remotePath

Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "docker ps --filter name=$(ConvertTo-RemoteShellArgument $config.ContainerName) --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'; printf '\nMounts:\n'; docker inspect --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} (rw={{.RW}}){{println}}{{end}}' $(ConvertTo-RemoteShellArgument $config.ContainerName); printf '\nDeployment:\n'; cat $quotedRemotePath/deploy.env" | Out-Host

$portOutput = @(Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command "sed -n 's/^APP_PORT=//p' $quotedRemotePath/deploy.env | head -n 1")
$port = [int](([string]$portOutput[-1]).Trim())
$response = Invoke-WebRequest -Uri "http://39.106.143.253:$port/" -UseBasicParsing -TimeoutSec 15
Write-Host "HTTP $($response.StatusCode): http://39.106.143.253:$port/"
