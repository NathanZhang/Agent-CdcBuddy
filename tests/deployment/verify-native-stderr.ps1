$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. (Join-Path $projectRoot 'scripts\deploy\remote-common.ps1')

$output = Invoke-RemoteCommand `
    -RemoteHost 'root@39.106.143.253' `
    -Command 'printf diagnostic-message >&2; printf success-message'

$text = $output | Out-String
if ($text -notmatch 'success-message') {
    throw 'Remote command stdout was not returned'
}

Write-Host 'PASS: Native stderr does not mask a successful SSH exit code'
