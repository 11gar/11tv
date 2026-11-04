<#
.SYNOPSIS
  Redémarrage nocturne de la Surface, seulement si la TV ne sert pas.

.DESCRIPTION
  Lancé par la tâche planifiée « 11TV - redémarrage nocturne » (compte SYSTEM), toutes les
  15 minutes pendant la fenêtre de nuit. Redémarre si la TV est inactive (écran d'accueil,
  pas de musique) ou si le serveur ne répond pas ; sinon attend le passage suivant. À
  l'échéance, redémarre quand même. Ne redémarre pas deux fois la même nuit.

  Le redémarrage installe aussi les mises à jour Windows en attente, en dehors des heures
  d'utilisation.

  Journal : %ProgramData%\11TV\nightly-reboot.log
#>
[CmdletBinding()]
param(
  [string]$HealthUrl = 'http://127.0.0.1:8080/api/health',
  # Heure limite (HH:mm) après laquelle on redémarre même si la TV est utilisée.
  [string]$Deadline = '05:45',
  # Affiche la décision sans redémarrer.
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$logDir = Join-Path $env:ProgramData '11TV'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'nightly-reboot.log'

function Write-Log([string]$Message) {
  if ($DryRun) { Write-Host "[simulation] $Message"; return }
  Add-Content -Path $logFile -Encoding UTF8 -Value ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $Message)
}

$now = Get-Date
$boot = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
if (($now - $boot).TotalHours -lt 3) {
  Write-Log 'Allumée depuis moins de 3 h : rien à faire'
  exit 0 # Déjà redémarrée cette nuit (ou allumée récemment).
}

$reason = $null
try {
  $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10
  if ($health.idle) { $reason = 'TV inactive' }
} catch {
  $reason = 'serveur sans réponse'
}

$limit = [datetime]::ParseExact($Deadline, 'HH:mm', $null)
if (-not $reason -and $now -ge $limit) { $reason = "échéance de $Deadline atteinte" }

if (-not $reason) {
  Write-Log ("TV utilisée (vue : {0}, musique : {1}) : redémarrage reporté" -f $health.view, $health.musicPlaying)
  exit 0
}

Write-Log "Redémarrage ($reason)"
if ($DryRun) { exit 0 }
shutdown.exe /r /t 60 /d p:0:0 /c "11TV : redémarrage nocturne"
