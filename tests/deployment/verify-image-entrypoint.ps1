[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ImageName
)

$ErrorActionPreference = 'Stop'
$checkCommand = "grep -qx '#!/bin/sh' /app/docker/entrypoint.sh"

$previousErrorAction = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    & docker run --rm --entrypoint sh $ImageName -c $checkCommand
    $dockerExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousErrorAction
}

if ($dockerExitCode -ne 0) {
    throw "Image entrypoint must start with an LF-terminated #!/bin/sh: $ImageName"
}

Write-Host "PASS: Image entrypoint uses an LF-terminated shebang ($ImageName)"
