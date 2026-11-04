<#
.SYNOPSIS
  Met à jour 11TV sur la Surface : récupère le code, reconstruit, relance le serveur.

.DESCRIPTION
  À lancer depuis la session de la TV, sans droits d'administrateur :

    powershell -ExecutionPolicy Bypass -File scripts\update.ps1

  Le serveur en cours est arrêté une fois la nouvelle version construite : le lanceur
  (run-11tv.ps1) le relance tout seul quelques secondes plus tard. Edge reste ouvert.
#>
[CmdletBinding()]
param(
  [string]$RepoDir # Par défaut : le dépôt qui contient ce script.
)

$ErrorActionPreference = 'Stop'
# Sous PowerShell 5.1, $PSScriptRoot est vide dans les valeurs par défaut des paramètres.
if (-not $RepoDir) { $RepoDir = Split-Path $PSScriptRoot -Parent }
Set-Location $RepoDir

function Invoke-Native([string]$Title, [scriptblock]$Command) {
  Write-Host "`n== $Title" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Title : échec (code $LASTEXITCODE)" }
}

# pnpm installé par « npm install -g » n'existe que pour le compte qui l'a installé : à
# défaut, on passe par npx (fourni avec Node pour toute la machine) avec la version du dépôt.
# Les .cmd fonctionnent quelle que soit la stratégie d'exécution des scripts PowerShell.
$pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source
$pnpmArgs = @()
if (-not $pnpm) {
  $version = (Get-Content (Join-Path $RepoDir 'package.json') -Raw | ConvertFrom-Json).packageManager
  $pnpm = (Get-Command npx.cmd -ErrorAction Stop).Source
  $pnpmArgs = @('--yes', $version)
  Write-Host "pnpm introuvable pour ce compte : utilisation de npx ($version)." -ForegroundColor Yellow
}

Invoke-Native 'Récupération du code' { git pull --ff-only }
Invoke-Native 'Dépendances' { & $pnpm @pnpmArgs install --frozen-lockfile }
Invoke-Native 'Construction' { & $pnpm @pnpmArgs build }

$servers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*apps\server\dist\index.js*' }
if ($servers) {
  $servers | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Write-Host "`nServeur arrêté : le lanceur le relance avec la nouvelle version." -ForegroundColor Green
} else {
  Write-Host "`nAucun serveur en cours : il démarrera à la prochaine ouverture de session." -ForegroundColor Yellow
}
