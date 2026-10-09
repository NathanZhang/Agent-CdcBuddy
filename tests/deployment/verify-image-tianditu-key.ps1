[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ImageName,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedKey
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ExpectedKey) -or $ExpectedKey -eq 'your_tianditu_key_here') {
    throw 'ExpectedKey must be a non-placeholder Tianditu browser key'
}

$previousExpectedKey = $env:EXPECTED_TIANDITU_KEY
try {
    $env:EXPECTED_TIANDITU_KEY = $ExpectedKey
    $checkCommand = @'
set -eu
if grep -R -F -q -- 'your_tianditu_key_here' /app/.next/static; then
  exit 21
fi
grep -R -F -q -- "$EXPECTED_TIANDITU_KEY" /app/.next/static
'@
    $checkCommand = $checkCommand.Replace("`r`n", "`n")

    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & docker run --rm --env EXPECTED_TIANDITU_KEY --entrypoint sh $ImageName -c $checkCommand
        $dockerExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }

    if ($dockerExitCode -eq 21) {
        throw "Image embeds the Tianditu placeholder instead of the configured key ($ImageName)"
    }
    if ($dockerExitCode -ne 0) {
        throw "Image does not embed the configured Tianditu key ($ImageName)"
    }
}
finally {
    $env:EXPECTED_TIANDITU_KEY = $previousExpectedKey
}

Write-Host "PASS: Image embeds the configured Tianditu key without the placeholder ($ImageName)"
