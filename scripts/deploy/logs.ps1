[CmdletBinding()]
param(
    [string]$ConfigPath,
    [int]$Tail = 200,
    [switch]$Follow
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'remote-common.ps1')
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
}
$config = Get-DeploymentConfig -ConfigPath $ConfigPath
$followArgument = if ($Follow) { '--follow' } else { '' }
$command = "docker logs --tail $Tail $followArgument $(ConvertTo-RemoteShellArgument $config.ContainerName)"
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $command | Out-Host
