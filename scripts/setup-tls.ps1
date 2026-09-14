<#
.SYNOPSIS
    Genere des certificats HTTPS reconnus par le navigateur avec mkcert.
.NOTES
    mkcert -install ajoute une autorite de certification racine au magasin
    Windows. C est une modification de la securite de la machine, reversible
    avec mkcert -uninstall. Le script demande confirmation sauf si le
    parametre -AcceptRootCA est fourni.
#>
[CmdletBinding()]
param([switch]$AcceptRootCA)

. (Join-Path $PSScriptRoot 'lib.ps1')

Write-Step 'Certificats HTTPS'

$root = Get-RepoRoot
$certDir = Join-Path $root 'config\traefik\certs'
$dynDir = Join-Path $root 'config\traefik\dynamic'

if (-not $AcceptRootCA) {
    Write-Note 'mkcert va installer une autorite de certification racine dans le'
    Write-Note 'magasin de certificats de Windows. Cela modifie la configuration'
    Write-Note 'de securite de la machine. Reversible avec : mkcert -uninstall'
    $answer = Read-Host '    Continuer ? (o/N)'
    if ($answer -notmatch '^[oOyY]') {
        Write-Note 'abandon, aucun changement'
        return
    }
}

if (-not (Test-Cmd 'mkcert')) {
    if (-not (Test-Cmd 'winget')) {
        Write-Err 'winget introuvable : installe mkcert manuellement'
        exit 1
    }
    Write-Note 'installation de mkcert via winget'
    winget install --id FiloSottile.mkcert -e --accept-package-agreements --accept-source-agreements
    $machinePath = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
    $env:PATH = $machinePath + ';' + $userPath
    if (-not (Test-Cmd 'mkcert')) {
        Write-Err 'mkcert reste introuvable : ouvre un nouveau terminal et relance ce script'
        exit 1
    }
}

Write-Note 'installation de l autorite racine locale'
mkcert -install
if ($LASTEXITCODE -ne 0) {
    Write-Err 'mkcert -install a echoue'
    exit 1
}

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

Push-Location $certDir
try {
    mkcert -cert-file local.pem -key-file local-key.pem '*.test' '*.localhost' 'localhost' '127.0.0.1' '::1'
    $generated = ($LASTEXITCODE -eq 0)
} finally {
    Pop-Location
}

if (-not $generated) {
    Write-Err 'la generation du certificat a echoue'
    exit 1
}
Write-Ok ('certificat ecrit dans ' + $certDir)

$source = Join-Path $dynDir 'tls.yml.example'
$target = Join-Path $dynDir 'tls.yml'
Copy-Item -LiteralPath $source -Destination $target -Force
Write-Ok 'configuration TLS activee pour Traefik'

Push-Location $root
try {
    docker compose restart traefik | Out-Null
} finally {
    Pop-Location
}
Write-Ok 'Traefik redemarre, les certificats sont actifs'
Write-Note 'redemarre le navigateur pour qu il prenne en compte la nouvelle autorite'

