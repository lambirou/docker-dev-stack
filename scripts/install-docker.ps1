<#
.SYNOPSIS
    Installe Docker Desktop si necessaire et attend que le moteur reponde.
.NOTES
    L'installation exige des droits administrateur. Si Docker est deja
    operationnel, le script ne fait rien.
#>
[CmdletBinding()]
param(
    [switch]$Force,
    [int]$TimeoutSeconds = 240
)

. (Join-Path $PSScriptRoot 'lib.ps1')

Write-Step 'Docker'

if ((Test-DockerEngine) -and -not $Force) {
    $version = docker version --format '{{.Server.Version}}'
    Write-Ok ('moteur Docker ' + $version + ' operationnel')
    return
}

if (-not (Test-Cmd 'docker')) {
    Write-Note 'Docker Desktop est absent de cette machine'

    if (-not (Test-Admin)) {
        Write-Err 'droits administrateur requis pour installer Docker Desktop'
        Write-Err 'relance ce script depuis un PowerShell administrateur'
        exit 1
    }
    if (-not (Test-Cmd 'winget')) {
        Write-Err 'winget introuvable : installe App Installer depuis le Microsoft Store'
        exit 1
    }

    if (-not (Test-Cmd 'wsl')) {
        Write-Note 'WSL absent, installation du sous-systeme Linux'
        wsl --install --no-launch
        Write-Note 'un redemarrage de Windows sera necessaire avant de poursuivre'
    }

    Write-Note 'installation de Docker Desktop via winget (plusieurs minutes)'
    winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Err ('winget a echoue avec le code ' + $LASTEXITCODE)
        Write-Note 'si le code vaut 1603 ou 3010, redemarre Windows puis relance ce script'
        exit 1
    }
    Write-Ok 'Docker Desktop installe'
}

$exe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
if (Test-Path -LiteralPath $exe) {
    if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        Write-Note 'demarrage de Docker Desktop'
        Start-Process -FilePath $exe -WindowStyle Hidden
    }
} else {
    Write-Note ('executable introuvable : ' + $exe)
}

Write-Host '    attente du moteur ' -NoNewline
$ready = Wait-For -Condition { Test-DockerEngine } -TimeoutSeconds $TimeoutSeconds
Write-Host ''

if (-not $ready) {
    Write-Err ('le moteur Docker n a pas repondu en ' + $TimeoutSeconds + ' secondes')
    Write-Note 'ouvre Docker Desktop manuellement, attends qu il soit vert, puis relance'
    exit 1
}

$version = docker version --format '{{.Server.Version}}'
Write-Ok ('moteur Docker ' + $version + ' operationnel')

