[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ImageName,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{7,40}$')]
    [string]$ExpectedGitHash
)

$ErrorActionPreference = 'Stop'

& docker run --rm --entrypoint sh $ImageName -c "grep -R -F -q -- '$ExpectedGitHash' /app/.next"
if ($LASTEXITCODE -ne 0) {
    throw "Image does not embed the expected Git hash: $ExpectedGitHash ($ImageName)"
}

Write-Host "PASS: Image embeds Git hash $ExpectedGitHash ($ImageName)"
