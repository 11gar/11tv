<#
.SYNOPSIS
  Met à jour 11TV sur la Surface : récupère le code, reconstruit, relance le serveur.

.DESCRIPTION
  À lancer depuis la session de la TV, sans droits d'administrateur :

    powershell -ExecutionPolicy Bypass -File scripts\update.ps1

  Ou depuis le téléphone : Réglages → Mettre à jour (le serveur lance ce script).

  Le serveur en cours est arrêté une fois la nouvelle version construite : le lanceur
  (run-11tv.ps1) le relance tout seul quelques secondes plus tard. Edge reste ouvert.

  Codes de sortie : 0 nouvelle version installée, 3 déjà à jour, 1 échec.
#>
[CmdletBinding()]
param(
  [string]$RepoDir, # Par défaut : le dépôt qui contient ce script.
  # Reconstruit même si le code n'a pas changé.
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
# Journal lisible (accents) quand la sortie est redirigée vers un fichier par le serveur.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
# Lancé sans console par le serveur : git ne doit jamais attendre une saisie ni ouvrir de
# fenêtre de connexion sur la TV.
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'
# Sous PowerShell 5.1, $PSScriptRoot est vide dans les valeurs par défaut des paramètres.
if (-not $RepoDir) { $RepoDir = Split-Path $PSScriptRoot -Parent }
Set-Location $RepoDir

function Invoke-Native([string]$Title, [scriptblock]$Command) {
  Write-Host "`n== $Title"
  # git et pnpm écrivent leur progression sur la sortie d'erreur. Sortie redirigée,
  # PowerShell 5.1 en ferait des erreurs bloquantes : on la mêle à la sortie normale, et
  # seul le code de sortie compte.
  $ErrorActionPreference = 'Continue'
  & $Command 2>&1 | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { "$($_.TargetObject)" } else { "$_" }
  }
  if ($LASTEXITCODE -ne 0) { throw "$Title : échec (code $LASTEXITCODE)" }
}

try {
  # pnpm installé par « npm install -g » n'existe que pour le compte qui l'a installé : à
  # défaut, on passe par npx (fourni avec Node pour toute la machine) avec la version du
  # dépôt. Les .cmd fonctionnent quelle que soit la stratégie d'exécution des scripts.
  $pnpm = (Get-Command pnpm.cmd -ErrorAction SilentlyContinue).Source
  $pnpmArgs = @()
  if (-not $pnpm) {
    $version = (Get-Content (Join-Path $RepoDir 'package.json') -Raw | ConvertFrom-Json).packageManager
    $pnpm = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
    if (-not $pnpm) { throw 'Ni pnpm ni npx introuvables : Node.js est-il installé ?' }
    $pnpmArgs = @('--yes', $version)
    Write-Host "pnpm introuvable pour ce compte : utilisation de npx ($version)."
  }

  $before = git rev-parse HEAD
  Invoke-Native 'Récupération du code' { git pull --ff-only }
  $after = git rev-parse HEAD
  $built = Test-Path (Join-Path $RepoDir 'apps\server\dist\index.js')
  if ($before -eq $after -and $built -and -not $Force) {
    Write-Host "`n11TV est déjà à jour ($($after.Substring(0, 7)))."
    exit 3
  }

  Invoke-Native 'Dépendances' { & $pnpm @pnpmArgs install --frozen-lockfile }
  Invoke-Native 'Construction' { & $pnpm @pnpmArgs build }
} catch {
  Write-Host "`nÉchec de la mise à jour : $($_.Exception.Message)"
  exit 1
}

Write-Host "`nVersion $($after.Substring(0, 7)) construite."
$servers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*apps\server\dist\index.js*' }
if ($servers) {
  # Après cet arrêt, le serveur ne peut plus rien écrire : ce message est le dernier.
  Write-Host 'Serveur arrêté : le lanceur le relance avec la nouvelle version.'
  $servers | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
} else {
  Write-Host 'Aucun serveur en cours : il démarrera à la prochaine ouverture de session.'
}
exit 0
