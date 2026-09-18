<#
.SYNOPSIS
    Installe et demarre la stack de developpement complete.
.DESCRIPTION
    Enchaine : verification ou installation de Docker, creation du .env,
    telechargement des images, demarrage des services, puis verification.
    Les etapes qui touchent la machine (fichier hosts, autorite de
    certification) sont optionnelles et desactivees par defaut.
.EXAMPLE
    .\scripts\install.ps1
    Installation standard.
.EXAMPLE
    .\scripts\install.ps1 -WithHosts -WithTls
    Ajoute les domaines .test et les certificats reconnus par le navigateur.
    Exige un PowerShell administrateur.
#>
[CmdletBinding()]
param(
    [switch]$SkipDocker,
    [switch]$WithHosts,
    [switch]$WithTls,
    [switch]$NoVerify
)

. (Join-Path $PSScriptRoot 'lib.ps1')

$root = Get-RepoRoot
$started = Get-Date

Write-Host ''
Write-Host '  Dev Stack - installation' -ForegroundColor White
Write-Host ('  ' + $root) -ForegroundColor DarkGray

if (($WithHosts -or $WithTls) -and -not (Test-Admin)) {
    Write-Step 'Prerequis'
    Write-Err 'les options -WithHosts et -WithTls exigent un PowerShell administrateur'
    exit 1
}

if (-not $SkipDocker) {
    & (Join-Path $PSScriptRoot 'install-docker.ps1')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Step 'Docker'
    Write-Note 'etape ignoree (-SkipDocker)'
}

Write-Step 'Configuration'

$envFile = Join-Path $root '.env'
$envSample = Join-Path $root '.env.example'
if (Test-Path -LiteralPath $envFile) {
    Write-Ok '.env deja present, conserve tel quel'
} else {
    Copy-Item -LiteralPath $envSample -Destination $envFile
    Write-Ok '.env cree depuis .env.example'
    Write-Note 'pense a remplacer les mots de passe par defaut'
}

foreach ($dir in @('data\postgres', 'data\mariadb', 'data\qdrant', 'data\meilisearch', 'data\neo4j', 'data\redis', 'data\traefik-manager')) {
    $full = Join-Path $root $dir
    if (-not (Test-Path -LiteralPath $full)) {
        New-Item -ItemType Directory -Force -Path $full | Out-Null
    }
}
Write-Ok 'dossiers d echange verifies'

Push-Location $root
try {
    Write-Step 'Validation du docker-compose.yml'
    docker compose config --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Err 'le fichier docker-compose.yml est invalide'
        exit 1
    }
    Write-Ok 'syntaxe valide'

    Write-Step 'Telechargement des images'
    Write-Note 'environ 2 Go au premier passage'
    docker compose pull --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Err 'le telechargement des images a echoue'
        exit 1
    }
    Write-Ok 'images a jour'

    Write-Step 'Demarrage'
    docker compose up -d --wait --wait-timeout 180
    if ($LASTEXITCODE -ne 0) {
        Write-Note 'certains services ne sont pas encore sains, verification detaillee ci-dessous'
    } else {
        Write-Ok 'tous les services sont demarres'
    }
} finally {
    Pop-Location
}

if ($WithHosts) {
    & (Join-Path $PSScriptRoot 'setup-hosts.ps1')
}

if ($WithTls) {
    & (Join-Path $PSScriptRoot 'setup-tls.ps1') -AcceptRootCA
}

if (-not $NoVerify) {
    & (Join-Path $PSScriptRoot 'verify.ps1')
}

$elapsed = [int]((Get-Date) - $started).TotalSeconds
Write-Step 'Termine'
Write-Ok ('installation effectuee en ' + $elapsed + ' secondes')
Write-Host ''
Write-Host '  Consoles web, servies en HTTPS :' -ForegroundColor White
Write-Host '    Portail        https://dev.test'
Write-Host '    phpMyAdmin     https://phpmyadmin.dev.test'
Write-Host '    Prisma Studio  https://prisma.dev.test'
Write-Host '    MinIO          https://minio.dev.test'
Write-Host '    Mailpit        https://mail.dev.test'
Write-Host '    RedisInsight   https://redis.dev.test'
Write-Host '    Qdrant         https://qdrant.dev.test/dashboard'
Write-Host '    Neo4j          https://neo4j.dev.test'
Write-Host '    Traefik        https://traefik.dev.test'
Write-Host ''
Write-Host '  Le port 80 redirige vers 443. Les ports directs (8306, 9001, 8025...)' -ForegroundColor DarkGray
Write-Host '  restent ouverts en HTTP simple, sans passer par le proxy.' -ForegroundColor DarkGray
Write-Host ''
if (-not $WithHosts) {
    Write-Note 'pour les URL en .test : .\scripts\setup-hosts.ps1 (administrateur)'
}
if (-not $WithTls) {
    Write-Note 'pour du HTTPS sans avertissement : .\scripts\setup-tls.ps1 (administrateur)'
}

