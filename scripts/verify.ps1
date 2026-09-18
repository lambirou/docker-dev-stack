<#
.SYNOPSIS
    Verifie que chaque service de la stack repond correctement.
.NOTES
    Retourne un code de sortie non nul si au moins un controle echoue.
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'lib.ps1')

$root = Get-RepoRoot
$cfg = Get-DotEnv (Join-Path $root '.env')
$results = @()

# Tinyauth ne redirige vers sa page de connexion que les clients qu'il identifie
# comme des navigateurs ; aux autres il repond 401. Sans cet en-tete, le controle
# du routage signalerait en echec les hotes proteges, qui fonctionnent pourtant.
$navigateur = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

function Add-Result {
    param([string]$Name, [bool]$Success, [string]$Detail)
    $script:results += [pscustomobject]@{
        Service = $Name
        Etat    = $(if ($Success) { 'OK' } else { 'ECHEC' })
        Detail  = $Detail
    }
}

function Get-HttpCode {
    param([string]$Url, [string]$HostHeader)
    if ($HostHeader) {
        return (curl.exe -s -o NUL -w '%{http_code}' -A $script:navigateur -H ('Host: ' + $HostHeader) $Url)
    }
    return (curl.exe -s -o NUL -w '%{http_code}' -A $script:navigateur $Url)
}

Push-Location $root
try {
    Write-Step 'Conteneurs'
    $lines = @(docker compose ps --format '{{.Service}}|{{.Status}}')
    foreach ($line in $lines) {
        $parts = $line.Split('|')
        $up = $parts[1] -like 'Up*'
        $unhealthy = $parts[1] -like '*unhealthy*'
        Add-Result -Name $parts[0] -Success ($up -and -not $unhealthy) -Detail $parts[1]
    }

    Write-Step 'Bases de donnees'

    $pg = docker compose exec -T postgres psql -U $cfg['POSTGRES_USER'] -d $cfg['POSTGRES_DB'] -tAc "SELECT extversion FROM pg_extension WHERE extname='vector'" 2>$null
    Add-Result -Name 'postgres/pgvector' -Success ([bool]$pg) -Detail ('vector ' + ($pg -join '').Trim())

    $my = docker compose exec -T mariadb mariadb -u $cfg['MARIADB_USER'] ('-p' + $cfg['MARIADB_PASSWORD']) -N -e 'SELECT VERSION()' 2>$null
    Add-Result -Name 'mariadb' -Success ([bool]$my) -Detail (($my -join '').Trim())

    $rd = docker compose exec -T redis redis-cli -a $cfg['REDIS_PASSWORD'] --no-auth-warning ping 2>$null
    Add-Result -Name 'redis' -Success (($rd -join '') -match 'PONG') -Detail (($rd -join '').Trim())

    $neo = docker compose exec -T neo4j cypher-shell -u neo4j -p $cfg['NEO4J_PASSWORD'] 'RETURN 1 AS ok;' 2>$null
    Add-Result -Name 'neo4j' -Success (($neo -join '') -match '1') -Detail 'cypher-shell'

    Write-Step 'Endpoints HTTP'

    $endpoints = @(
        @{ Name = 'qdrant'; Url = 'http://localhost:' + $cfg['QDRANT_HTTP_PORT'] + '/healthz' },
        @{ Name = 'meilisearch'; Url = 'http://localhost:' + $cfg['MEILI_PORT'] + '/health' },
        @{ Name = 'minio'; Url = 'http://localhost:' + $cfg['MINIO_API_PORT'] + '/minio/health/live' },
        @{ Name = 'mailpit'; Url = 'http://localhost:' + $cfg['MAILPIT_UI_PORT'] + '/api/v1/info' },
        @{ Name = 'redisinsight'; Url = 'http://localhost:' + $cfg['REDISINSIGHT_PORT'] + '/api/health/' },
        # La sonde interroge reellement Postgres : un 200 dit que la console est utilisable.
        @{ Name = 'prisma-studio'; Url = 'http://localhost:' + $cfg['PRISMA_STUDIO_PORT'] + '/healthz' },
        @{ Name = 'it-tools'; Url = 'http://localhost:' + $cfg['IT_TOOLS_PORT'] + '/' },
        @{ Name = 'dockhand'; Url = 'http://localhost:' + $cfg['DOCKHAND_PORT'] + '/' },
        @{ Name = 'traefik-manager'; Url = 'http://localhost:' + $cfg['TRAEFIK_MANAGER_PORT'] + '/login' }
    )
    foreach ($ep in $endpoints) {
        $code = Get-HttpCode -Url $ep.Url
        Add-Result -Name $ep.Name -Success ($code -eq '200') -Detail ('HTTP ' + $code)
    }

    Write-Step 'Routage Traefik'

    # La stack est servie en HTTPS de bout en bout : le port 80 ne sert plus qu'a
    # rediriger. Un 301 est donc la reponse attendue en HTTP, et c'est elle qu'on
    # verifie — sans suivre la redirection, pour constater le code lui-meme.
    foreach ($name in Get-StackHostnames) {
        $fqdn = $name
        $http = Get-HttpCode -Url 'http://127.0.0.1/' -HostHeader $fqdn
        $https = curl.exe -sk -o NUL -w '%{http_code}' -A $navigateur --resolve ($fqdn + ':443:127.0.0.1') ('https://' + $fqdn + '/')
        $ok = ($http -eq '301') -and ($https -match '^(200|302)$')
        Add-Result -Name $fqdn -Success $ok -Detail ('http ' + $http + ' -> https ' + $https)
    }
} finally {
    Pop-Location
}

Write-Step 'Resultat'
$results | Format-Table -AutoSize | Out-String | Write-Host

$failed = @($results | Where-Object { $_.Etat -ne 'OK' })
if ($failed.Count -gt 0) {
    Write-Err ([string]$failed.Count + ' controle(s) en echec')
    exit 1
}
Write-Ok ([string]$results.Count + ' controles passes')
