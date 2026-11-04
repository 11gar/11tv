<#
.SYNOPSIS
  Lanceur de 11TV : démarre le serveur et le relance s'il s'arrête ou ne répond plus.

.DESCRIPTION
  Lancé à l'ouverture de session par la tâche planifiée « 11TV » (voir setup-surface.ps1),
  dans la session de l'utilisateur de la TV : la souris et le volume (SendInput) ne
  fonctionnent pas depuis un service.

    - Un seul lanceur à la fois (un second s'arrête aussitôt).
    - Coupe les notifications Windows de la session (elles s'afficheraient sur la TV).
    - Démarre le serveur en production, sans fenêtre.
    - Surveille /api/health toutes les 30 s : trois absences de réponse d'affilée, et le
      serveur est considéré comme bloqué puis relancé.
    - Après un arrêt, attend avant de relancer (5 s, puis de plus en plus jusqu'à 2 min si
      le serveur s'arrête en boucle).

  Journal : %LOCALAPPDATA%\11TV\logs\launcher.log. Ceux du serveur sont à côté (11tv.log).
#>
[CmdletBinding()]
param(
  [string]$RepoDir, # Par défaut : le dépôt qui contient ce script.
  [string]$HealthUrl = 'http://127.0.0.1:8080/api/health',
  # Laisse les notifications de la session telles quelles (essai sur un PC de développement).
  [switch]$KeepNotifications
)

$ErrorActionPreference = 'Stop'
# Sous PowerShell 5.1, $PSScriptRoot est vide dans les valeurs par défaut des paramètres.
if (-not $RepoDir) { $RepoDir = Split-Path $PSScriptRoot -Parent }

$logDir = Join-Path $env:LOCALAPPDATA '11TV\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'launcher.log'
if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 1MB) {
  Move-Item -Force $logFile "$logFile.1"
}

function Write-Log([string]$Message) {
  $line = '{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $Message
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

# --- Un seul lanceur ----------------------------------------------------------------------
$mutex = New-Object System.Threading.Mutex($false, 'Local\11TV-launcher')
if (-not $mutex.WaitOne(0)) {
  Write-Log 'Un lanceur tourne déjà : arrêt.'
  exit 0
}

# --- Session de la TV ---------------------------------------------------------------------
# Pas de bulles de notification par-dessus la TV.
if (-not $KeepNotifications) {
  $pushKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications'
  # Pas de -Force sur une clé existante : il la recréerait, en effaçant ses autres valeurs.
  if (-not (Test-Path $pushKey)) { New-Item -Path $pushKey | Out-Null }
  Set-ItemProperty -Path $pushKey -Name ToastEnabled -Value 0 -Type DWord
}

# --- Serveur ------------------------------------------------------------------------------
$entry = Join-Path $RepoDir 'apps\server\dist\index.js'
if (-not (Test-Path $entry)) {
  Write-Log "Serveur non construit ($entry) : lancez « pnpm build »."
  exit 1
}
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }

# Un serveur resté d'une session précédente du lanceur occuperait les ports.
function Stop-OrphanServer {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -like '*apps\server\dist\index.js*' } |
    ForEach-Object {
      Write-Log "Arrêt d'un ancien serveur (PID $($_.ProcessId))"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

$env:NODE_ENV = 'production'
$delaySec = 5
Write-Log "Lanceur démarré ($RepoDir)"

while ($true) {
  Stop-OrphanServer
  $started = Get-Date
  $server = Start-Process -FilePath $node -ArgumentList @('--enable-source-maps', "`"$entry`"") `
    -WorkingDirectory $RepoDir -WindowStyle Hidden -PassThru
  $null = $server.Handle # Sans cela, ExitCode reste vide une fois le processus terminé.
  Write-Log "Serveur démarré (PID $($server.Id))"

  $failures = 0
  while (-not $server.WaitForExit(30000)) {
    if (((Get-Date) - $started).TotalSeconds -lt 90) { continue } # Laisse le temps de démarrer.
    try {
      Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10 | Out-Null
      $failures = 0
    } catch {
      $failures++
      Write-Log "Le serveur ne répond pas ($failures/3)"
      if ($failures -ge 3) {
        Write-Log 'Serveur bloqué : arrêt forcé'
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }

  $ranSec = ((Get-Date) - $started).TotalSeconds
  Write-Log ('Serveur arrêté (code {0}) après {1:N0} s' -f $server.ExitCode, $ranSec)
  # Un serveur qui a tenu 10 minutes repart vite ; un serveur qui plante en boucle, de moins en moins.
  if ($ranSec -gt 600) { $delaySec = 5 } else { $delaySec = [Math]::Min($delaySec * 2, 120) }
  Write-Log "Relance dans $delaySec s"
  Start-Sleep -Seconds $delaySec
}
