$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$commonScript = Join-Path $projectRoot 'scripts\deploy\remote-common.ps1'

if (-not (Test-Path -LiteralPath $commonScript -PathType Leaf)) {
    throw "Missing deployment helper: $commonScript"
}

. $commonScript

$acceptedPath = Assert-SafeRemotePath '/data/Agent-CdcBuddy'
if ($acceptedPath -ne '/data/Agent-CdcBuddy') {
    throw 'Safe deployment path was not preserved'
}

foreach ($unsafePath in @('/', '/data', '/data/../root', "/data/Agent-CdcBuddy`nrm -rf /")) {
    $rejected = $false
    try {
        Assert-SafeRemotePath $unsafePath | Out-Null
    }
    catch {
        $rejected = $true
    }
    if (-not $rejected) {
        throw "Unsafe remote path accepted: $unsafePath"
    }
}

$ports = @(Get-DeploymentPortCandidates)
if ($ports.Count -ne 100 -or $ports[0] -ne 32100 -or $ports[-1] -ne 32199) {
    throw 'Deployment port candidates must be exactly 32100-32199'
}

$agentConfig = [pscustomobject]@{
    VectorPort = 32112
    FoodbornePort = 32113
    EnvPort = 32114
    ChronicPort = 32115
}
$agents = @(Get-AgentDeploymentDefinitions -Config $agentConfig)
$expectedAgents = @(
    @{ Domain = 'vector'; Service = 'vector-agent'; Container = 'agent-cdcbuddy-vector'; Database = 'vector_monitoring.db'; Port = 32112 }
    @{ Domain = 'foodborne'; Service = 'foodborne-agent'; Container = 'agent-cdcbuddy-foodborne'; Database = 'foodborne_monitoring.db'; Port = 32113 }
    @{ Domain = 'env'; Service = 'env-agent'; Container = 'agent-cdcbuddy-env'; Database = 'env_monitoring.db'; Port = 32114 }
    @{ Domain = 'chronic'; Service = 'chronic-agent'; Container = 'agent-cdcbuddy-chronic'; Database = 'chronic_monitoring.db'; Port = 32115 }
)
if ($agents.Count -ne $expectedAgents.Count) {
    throw "Expected four deployment agents, got $($agents.Count)"
}
for ($index = 0; $index -lt $expectedAgents.Count; $index++) {
    $actual = $agents[$index]
    $expected = $expectedAgents[$index]
    foreach ($property in @('Domain', 'Service', 'Container', 'Database', 'Port')) {
        if ($actual.$property -ne $expected[$property]) {
            throw "Deployment agent $index has wrong ${property}: $($actual.$property)"
        }
    }
}

if (-not (Test-ArtifactSizeMatch -LocalSize 878197760 -RemoteSizeText '878197760')) {
    throw 'Equal artifact sizes must be reusable'
}
if (Test-ArtifactSizeMatch -LocalSize 878197760 -RemoteSizeText '0') {
    throw 'Mismatched artifact sizes must not be reusable'
}

$quoted = ConvertTo-RemoteShellArgument "a'b"
$expectedQuoted = "'a'`"'`"'b'"
if ($quoted -ne $expectedQuoted) {
    throw 'Remote shell quoting does not preserve apostrophes safely'
}

$requiredScripts = @(
    'build-image.ps1',
    'deploy-remote.ps1',
    'status.ps1',
    'logs.ps1',
    'deploy.config.ps1.example'
)
foreach ($name in $requiredScripts) {
    $path = Join-Path $projectRoot "scripts\deploy\$name"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing deployment script: $name"
    }
}

$parserErrors = @()
Get-ChildItem (Join-Path $projectRoot 'scripts\deploy') -Filter '*.ps1' | ForEach-Object {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    $parserErrors += $errors
}
if ($parserErrors.Count -gt 0) {
    throw ($parserErrors | ForEach-Object Message | Out-String)
}

$previousErrorAction = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$statusProbe = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot 'scripts\deploy\status.ps1') 2>&1
$ErrorActionPreference = $previousErrorAction
if (($statusProbe | Out-String) -match 'Join-Path.+empty string') {
    throw 'Deployment entrypoint evaluates PSScriptRoot before script parameter binding completes'
}

Write-Host 'PASS: Remote deployment helpers'
