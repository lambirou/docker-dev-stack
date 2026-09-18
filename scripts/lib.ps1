# Fonctions partagees par les scripts de la stack.
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host ('    [ok]   ' + $Message) -ForegroundColor Green
}

function Write-Note {
    param([string]$Message)
    Write-Host ('    [note] ' + $Message) -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host ('    [err]  ' + $Message) -ForegroundColor Red
}

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Cmd {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Get-StackHostnames {
    # Noms complets. Le niveau dev.test n'est pas decoratif : le cookie de session
    # de tinyauth est pose sur ce domaine parent, ce qui permet a une seule page de
    # connexion de couvrir n'importe quel service de la stack. Le portail occupe
    # l'apex dev.test : tinyauth accepte l'hote qui est exactement le domaine du
    # cookie, la porte d'entree de la stack est donc protegee comme les autres.
    return @('dev.test', 'auth.dev.test', 'traefik.dev.test', 'minio.dev.test', 'mail.dev.test',
        'redis.dev.test', 'qdrant.dev.test', 'meilisearch.dev.test', 'neo4j.dev.test', 'phpmyadmin.dev.test',
        'prisma.dev.test', 'tools.dev.test', 'containers.dev.test', 'proxy.dev.test')
}

function Get-DotEnv {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $map }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $parts = $trimmed.Split('=', 2)
        if ($parts.Count -eq 2) { $map[$parts[0].Trim()] = $parts[1].Trim() }
    }
    return $map
}

function Wait-For {
    param(
        [scriptblock]$Condition,
        [int]$TimeoutSeconds = 120,
        [int]$IntervalSeconds = 3
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            if (& $Condition) { return $true }
        } catch {
            # on ignore et on retente
        }
        Start-Sleep -Seconds $IntervalSeconds
        Write-Host '.' -NoNewline
    }
    return $false
}

function Test-DockerEngine {
    if (-not (Test-Cmd 'docker')) { return $false }
    $null = docker info --format '{{.ServerVersion}}' 2>$null
    return ($LASTEXITCODE -eq 0)
}
