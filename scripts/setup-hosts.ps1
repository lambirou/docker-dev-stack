<#
.SYNOPSIS
    Ajoute (ou retire) les entrees *.test de la stack dans le fichier hosts.
.NOTES
    Exige des droits administrateur. Idempotent : les anciennes entrees
    dev-stack sont reecrites a chaque execution.
#>
[CmdletBinding()]
param([switch]$Remove)

. (Join-Path $PSScriptRoot 'lib.ps1')

Write-Step 'Fichier hosts'

$hostsFile = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$marker = '# dev-stack'

if (-not (Test-Admin)) {
    Write-Err 'droits administrateur requis pour modifier le fichier hosts'
    Write-Note 'relance dans un terminal administrateur, ou lance :'
    Write-Note ('  Start-Process powershell -Verb RunAs -ArgumentList "-File","' + $PSCommandPath + '"')
    exit 1
}

$existing = @(Get-Content -LiteralPath $hostsFile)
$kept = @($existing | Where-Object { $_ -notlike ('*' + $marker + '*') })

if ($Remove) {
    Set-Content -LiteralPath $hostsFile -Value $kept -Encoding ASCII
    ipconfig /flushdns | Out-Null
    Write-Ok 'entrees dev-stack retirees'
    return
}

$entries = @(Get-StackHostnames | ForEach-Object { '127.0.0.1 ' + $_ + '.test ' + $marker })
Set-Content -LiteralPath $hostsFile -Value ($kept + $entries) -Encoding ASCII
ipconfig /flushdns | Out-Null

Write-Ok ([string]$entries.Count + ' entrees ecrites dans ' + $hostsFile)
foreach ($name in Get-StackHostnames) {
    Write-Host ('           https://' + $name + '.test')
}
