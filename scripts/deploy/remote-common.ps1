Set-StrictMode -Version Latest

function Get-DeploymentConfig {
    [CmdletBinding()]
    param(
        [string]$ConfigPath
    )

    if (-not $ConfigPath) {
        $ConfigPath = Join-Path $PSScriptRoot 'deploy.config.ps1'
    }

    $config = [ordered]@{
        RemoteHost   = 'root@39.106.143.253'
        RemotePath   = '/data/Agent-CdcBuddy'
        ImageName      = 'agent-cdcbuddy:2.0.1'
        VectorPort     = 32112
        FoodbornePort  = 32113
        EnvPort        = 32114
        ChronicPort    = 32115
        VectorOrigin   = ''
        FoodborneOrigin = ''
        EnvOrigin      = ''
        ChronicOrigin  = ''
        TarPath        = '.deploy-artifacts/agent-cdcbuddy-2.0.1-linux-amd64.tar'
    }

    if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
        $localConfig = & $ConfigPath
        if ($localConfig -isnot [hashtable]) {
            throw "Deployment config must return a hashtable: $ConfigPath"
        }
        foreach ($key in $localConfig.Keys) {
            if (-not $config.Contains($key)) {
                throw "Unknown deployment config key: $key"
            }
            $config[$key] = $localConfig[$key]
        }
    }

    [pscustomobject]$config
}

function Get-AgentDeploymentDefinitions {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)]$Config)

    $definitions = @(
        [pscustomobject]@{ Domain = 'vector'; Service = 'vector-agent'; Container = 'agent-cdcbuddy-vector'; Database = 'vector_monitoring.db'; Port = [int]$Config.VectorPort }
        [pscustomobject]@{ Domain = 'foodborne'; Service = 'foodborne-agent'; Container = 'agent-cdcbuddy-foodborne'; Database = 'foodborne_monitoring.db'; Port = [int]$Config.FoodbornePort }
        [pscustomobject]@{ Domain = 'env'; Service = 'env-agent'; Container = 'agent-cdcbuddy-env'; Database = 'env_monitoring.db'; Port = [int]$Config.EnvPort }
        [pscustomobject]@{ Domain = 'chronic'; Service = 'chronic-agent'; Container = 'agent-cdcbuddy-chronic'; Database = 'chronic_monitoring.db'; Port = [int]$Config.ChronicPort }
    )

    $ports = @($definitions | ForEach-Object Port)
    foreach ($port in $ports) {
        if ($port -lt 32100 -or $port -gt 32199) {
            throw "Deployment port must stay within 32100-32199: $port"
        }
    }
    if (@($ports | Select-Object -Unique).Count -ne $ports.Count) {
        throw 'Each agent must use a unique deployment port'
    }

    $definitions
}

function Assert-SafeRemotePath {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$RemotePath)

    if ($RemotePath -notmatch '^/data/[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$' -or $RemotePath.Contains('..')) {
        throw "Unsafe remote deployment path: $RemotePath"
    }
    $RemotePath
}

function Get-DeploymentPortCandidates {
    [CmdletBinding()]
    param(
        [int]$Start = 32100,
        [int]$End = 32199
    )

    if ($Start -lt 32100 -or $End -gt 32199 -or $Start -gt $End) {
        throw "Port range must stay within 32100-32199: $Start-$End"
    }
    $Start..$End
}

function ConvertTo-RemoteShellArgument {
    [CmdletBinding()]
    param([AllowEmptyString()][Parameter(Mandatory = $true)][string]$Value)

    $singleQuote = [string][char]39
    $doubleQuote = [string][char]34
    $replacement = $singleQuote + $doubleQuote + $singleQuote + $doubleQuote + $singleQuote
    $singleQuote + $Value.Replace($singleQuote, $replacement) + $singleQuote
}

function Test-ArtifactSizeMatch {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][long]$LocalSize,
        [AllowEmptyString()][Parameter(Mandatory = $true)][string]$RemoteSizeText
    )

    $remoteSize = [long]0
    [long]::TryParse($RemoteSizeText.Trim(), [ref]$remoteSize) -and $LocalSize -gt 0 -and $remoteSize -eq $LocalSize
}

function Get-FileSha256 {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Path)

    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-ArtifactSha256Match {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$LocalHash,
        [AllowEmptyString()][Parameter(Mandatory = $true)][string]$RemoteHashText
    )

    $local = $LocalHash.Trim()
    $remote = $RemoteHashText.Trim()
    $local -match '^[0-9a-fA-F]{64}$' -and
        $remote -match '^[0-9a-fA-F]{64}$' -and
        $local.Equals($remote, [StringComparison]::OrdinalIgnoreCase)
}

function Invoke-RemoteCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RemoteHost,
        [Parameter(Mandatory = $true)][string]$Command
    )

    $previousErrorAction = $ErrorActionPreference
    $nativeExitCode = 1
    try {
        $ErrorActionPreference = 'Continue'
        $output = & ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 $RemoteHost $Command 2>&1
        $nativeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($nativeExitCode -ne 0) {
        throw "Remote command failed on $RemoteHost (exit $nativeExitCode): $output"
    }
    $output
}

function Copy-ToRemote {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RemoteHost,
        [Parameter(Mandatory = $true)][string]$LocalPath,
        [Parameter(Mandatory = $true)][string]$RemotePath
    )

    $resolvedLocal = (Resolve-Path -LiteralPath $LocalPath).Path
    $previousErrorAction = $ErrorActionPreference
    $nativeExitCode = 1
    try {
        $ErrorActionPreference = 'Continue'
        & scp -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 $resolvedLocal "${RemoteHost}:$RemotePath"
        $nativeExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($nativeExitCode -ne 0) {
        throw "SCP failed for $resolvedLocal"
    }
}

function Get-FirstFreeRemotePort {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$RemoteHost,
        [int]$Start = 32100,
        [int]$End = 32199
    )

    Get-DeploymentPortCandidates -Start $Start -End $End | Out-Null
    $template = 'for p in $(seq __START__ __END__); do if ! ss -H -ltn "sport = :$p" | grep -q .; then echo "$p"; exit 0; fi; done; exit 1'
    $remoteScript = $template.Replace('__START__', [string]$Start).Replace('__END__', [string]$End)
    $result = @(Invoke-RemoteCommand -RemoteHost $RemoteHost -Command $remoteScript)
    $portText = [string]$result[-1]
    $port = 0
    if (-not [int]::TryParse($portText.Trim(), [ref]$port) -or $port -lt $Start -or $port -gt $End) {
        $rawResult = ($result | ForEach-Object { "[$($_.GetType().FullName)]<$($_)>" }) -join ', '
        throw "No free deployment port found in $Start-$End. Raw SSH output: $rawResult"
    }
    $port
}
