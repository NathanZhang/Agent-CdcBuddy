[CmdletBinding()]
param(
    [string]$ConfigPath,
    [ValidateSet('all', 'vector', 'foodborne', 'env', 'chronic')]
    [string]$Domain = 'all',
    [ValidateRange(1, 10000)]
    [int]$Tail = 200,
    [switch]$Follow
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'remote-common.ps1')
if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
}
$config = Get-DeploymentConfig -ConfigPath $ConfigPath
$agents = @(Get-AgentDeploymentDefinitions -Config $config)
$remotePath = Assert-SafeRemotePath $config.RemotePath
$selected = if ($Domain -eq 'all') { $agents } else { @($agents | Where-Object Domain -eq $Domain) }
$services = ($selected | ForEach-Object { ConvertTo-RemoteShellArgument $_.Service }) -join ' '
$followArgument = if ($Follow) { '--follow' } else { '' }
$command = "cd $(ConvertTo-RemoteShellArgument $remotePath) && docker compose --env-file deploy.env -f compose.production.yml logs --tail $Tail $followArgument $services"
Invoke-RemoteCommand -RemoteHost $config.RemoteHost -Command $command | Out-Host
