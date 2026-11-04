<#
.SYNOPSIS
  Configure la Surface pour 11TV : démarrage automatique, redémarrage nocturne, mises à jour
  hors des heures d'utilisation, énergie, Edge et pare-feu.

.DESCRIPTION
  À lancer une fois, dans une console PowerShell ouverte en administrateur, depuis le dossier
  du dépôt. Commencez par une simulation, qui affiche chaque action sans rien modifier :

    powershell -ExecutionPolicy Bypass -File scripts\setup-surface.ps1 -User tv -DryRun

  puis, si tout vous convient :

    powershell -ExecutionPolicy Bypass -File scripts\setup-surface.ps1 -User tv

  Le script peut être relancé sans risque : chaque étape remplace la précédente.

  Ce qu'il fait, dans l'ordre :
    1. Énergie : jamais de veille ni d'écran éteint sur secteur, rabat sans effet, pas de
       mot de passe au réveil, démarrage rapide désactivé (redémarrages complets).
    2. Windows Update : heures d'utilisation fixes, pour que les redémarrages de mise à
       jour tombent la nuit.
    3. Edge : stratégies pour le kiosque (pas d'écran de bienvenue, lecture automatique,
       pas de traduction ni de suggestions, pas de dialogue « restaurer les pages »).
       Elles s'appliquent à tous les profils Edge de la machine.
    4. Pare-feu : Node accessible depuis le réseau privé seulement, ports 8443 et 8081.
    5. Tâche « 11TV » : lance scripts\run-11tv.ps1 à l'ouverture de session de -User.
    6. Tâche « 11TV - redémarrage nocturne » : à -RebootTime, si la TV ne sert pas.
    7. Connexion automatique de -User, avec Autologon de Sysinternals (Microsoft) : le mot
       de passe est saisi dans la fenêtre d'Autologon et stocké chiffré par Windows. Ni ce
       script ni le dépôt ne le voient.

  Ce qu'il ne fait pas : créer le compte, choisir l'affichage « TV seule », se connecter
  aux services. Voir le README.

.PARAMETER User
  Compte local de la TV, qui ouvre la session automatiquement et fait tourner 11TV.

.PARAMETER RebootTime
  Début de la fenêtre de redémarrage nocturne (HH:mm). Si la TV sert encore, le redémarrage
  est retenté toutes les 15 minutes, et forcé 1 h 45 plus tard.

.PARAMETER ActiveHoursStart
  Début des heures d'utilisation (0-23) : Windows ne redémarre pas pour une mise à jour
  pendant ces heures.

.PARAMETER ActiveHoursEnd
  Fin des heures d'utilisation (0-23). Windows limite la plage à 18 heures.

.PARAMETER AutologonPath
  Chemin d'Autologon64.exe. Par défaut, scripts\tools\Autologon64.exe (dossier ignoré par git).

.PARAMETER SetNetworkPrivate
  Passe aussi le réseau actuel en profil « Privé » (nécessaire pour joindre 11TV depuis le
  téléphone). À n'utiliser que sur le Wi-Fi de la maison.

.PARAMETER DryRun
  Affiche les actions sans rien modifier.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$User,
  # Par défaut : le dépôt qui contient ce script.
  [string]$RepoDir,
  [ValidatePattern('^\d{2}:\d{2}$')][string]$RebootTime = '04:00',
  [ValidateRange(0, 23)][int]$ActiveHoursStart = 8,
  [ValidateRange(0, 23)][int]$ActiveHoursEnd = 2,
  [string]$AutologonPath,
  [switch]$SetNetworkPrivate,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
# Sous PowerShell 5.1, $PSScriptRoot est vide dans les valeurs par défaut des paramètres.
if (-not $RepoDir) { $RepoDir = Split-Path $PSScriptRoot -Parent }
if (-not $AutologonPath) { $AutologonPath = Join-Path $PSScriptRoot 'tools\Autologon64.exe' }
$ports = @(8443, 8081)

function Write-Section([string]$Title) {
  Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

# Exécute une action, ou se contente de la décrire en simulation.
function Invoke-Step([string]$Description, [scriptblock]$Action) {
  if ($DryRun) {
    Write-Host "  [simulation] $Description" -ForegroundColor DarkGray
    return
  }
  Write-Host "  $Description"
  & $Action
}

function Set-RegistryValue([string]$Path, [string]$Name, $Value, [string]$Type = 'DWord') {
  Invoke-Step "$Path : $Name = $Value" {
    # Pas de -Force sur une clé existante : il la recréerait, en effaçant ses autres valeurs.
    if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
    Set-ItemProperty -Path $Path -Name $Name -Value $Value -Type $Type
  }
}

function Invoke-PowerCfg([string]$Description, [string[]]$Arguments) {
  Invoke-Step $Description {
    & powercfg.exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "powercfg $($Arguments -join ' ') : échec" }
  }
}

# --- 0. Vérifications ---------------------------------------------------------------------
Write-Section 'Vérifications'

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin -and -not $DryRun) {
  throw 'Lancez ce script dans une console PowerShell ouverte en administrateur.'
}

if (-not (Get-LocalUser -Name $User -ErrorAction SilentlyContinue)) {
  throw "Compte local introuvable : $User. Créez-le d'abord (voir le README)."
}
$qualifiedUser = "$env:COMPUTERNAME\$User"
Write-Host "  Compte de la TV : $qualifiedUser"

$launcher = Join-Path $RepoDir 'scripts\run-11tv.ps1'
$nightly = Join-Path $RepoDir 'scripts\nightly-reboot.ps1'
$entry = Join-Path $RepoDir 'apps\server\dist\index.js'
if (-not (Test-Path $launcher)) { throw "Dépôt introuvable : $RepoDir" }
if (-not (Test-Path $entry)) {
  Write-Warning "Serveur non construit : lancez « pnpm install » puis « pnpm build » avant le redémarrage."
}
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not (Test-Path $node)) { throw 'Node.js introuvable : installez-le d''abord (voir le README).' }
Write-Host "  Dépôt : $RepoDir"
Write-Host "  Node : $node"

$rebootAt = [datetime]::ParseExact($RebootTime, 'HH:mm', $null)
$deadline = $rebootAt.AddMinutes(105).ToString('HH:mm')

# --- 1. Énergie ---------------------------------------------------------------------------
Write-Section 'Énergie'
Invoke-PowerCfg 'Jamais de mise en veille sur secteur' @('/change', 'standby-timeout-ac', '0')
Invoke-PowerCfg 'Jamais d''écran éteint sur secteur' @('/change', 'monitor-timeout-ac', '0')
Invoke-PowerCfg 'Jamais de veille prolongée sur secteur' @('/change', 'hibernate-timeout-ac', '0')
Invoke-PowerCfg 'Rabat fermé sur secteur : ne rien faire' @(
  '/setacvalueindex', 'SCHEME_CURRENT', 'SUB_BUTTONS', 'LIDACTION', '0')
Invoke-PowerCfg 'Pas de mot de passe au réveil' @(
  '/setacvalueindex', 'SCHEME_CURRENT', 'SUB_NONE', 'CONSOLELOCK', '0')
Invoke-PowerCfg 'Application du mode d''alimentation' @('/setactive', 'SCHEME_CURRENT')
# Désactive aussi le démarrage rapide : chaque redémarrage repart d'un système propre.
Invoke-PowerCfg 'Veille prolongée et démarrage rapide désactivés' @('/hibernate', 'off')

# --- 2. Windows Update --------------------------------------------------------------------
Write-Section 'Windows Update'
$span = ($ActiveHoursEnd - $ActiveHoursStart + 24) % 24
if ($span -gt 18) { throw "Heures d'utilisation trop longues ($span h) : Windows accepte 18 h au plus." }
$wu = 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'
Set-RegistryValue $wu 'SmartActiveHoursState' 0
Set-RegistryValue $wu 'ActiveHoursStart' $ActiveHoursStart
Set-RegistryValue $wu 'ActiveHoursEnd' $ActiveHoursEnd
Write-Host "  Pas de redémarrage de mise à jour entre ${ActiveHoursStart} h et ${ActiveHoursEnd} h."

# --- 3. Edge ------------------------------------------------------------------------------
Write-Section 'Stratégies Edge'
$edge = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'
$edgePolicies = [ordered]@{
  HideFirstRunExperience       = 1 # Pas d'écran de bienvenue
  AutoplayAllowed              = 1 # Musique et vidéos démarrent sans clic
  HideRestoreDialogEnabled     = 1 # Pas de « restaurer les pages » après un redémarrage
  TranslateEnabled             = 0
  StartupBoostEnabled          = 0 # Edge démarré par 11TV, pas par Windows
  BackgroundModeEnabled        = 0
  ShowRecommendationsEnabled   = 0
  PromotionalTabsEnabled       = 0
  EdgeShoppingAssistantEnabled = 0
}
foreach ($name in $edgePolicies.Keys) { Set-RegistryValue $edge $name $edgePolicies[$name] }

# --- 4. Pare-feu --------------------------------------------------------------------------
Write-Section 'Pare-feu'
# Windows crée des règles « node.exe » quand on répond à sa question : on retire celles qui
# ouvrent Node aux réseaux publics, puis on pose notre règle, limitée au réseau privé.
$publicRules = Get-NetFirewallApplicationFilter -Program $node -ErrorAction SilentlyContinue |
  Get-NetFirewallRule -ErrorAction SilentlyContinue |
  Where-Object { $_.Direction -eq 'Inbound' -and $_.Enabled -eq 'True' -and ($_.Profile -match 'Public|Any') }
foreach ($rule in $publicRules) {
  Invoke-Step "Désactivation de la règle « $($rule.DisplayName) » (réseaux publics)" {
    Disable-NetFirewallRule -Name $rule.Name
  }
}
Invoke-Step "Règle « 11TV » : Node, TCP $($ports -join ', '), réseau privé uniquement" {
  Get-NetFirewallRule -DisplayName '11TV' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName '11TV' -Direction Inbound -Action Allow -Protocol TCP `
    -LocalPort $ports -Program $node -Profile Private | Out-Null
}

# Seulement les réseaux qui mènent à Internet (le Wi-Fi de la maison), pas les VPN ou
# réseaux virtuels qui n'ont rien à voir avec le téléphone.
$profiles = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -eq 'Internet' }
foreach ($p in $profiles) {
  if ($p.NetworkCategory -eq 'Private') {
    Write-Host "  Réseau « $($p.Name) » : privé"
  } elseif ($SetNetworkPrivate) {
    Invoke-Step "Réseau « $($p.Name) » passé en profil privé" {
      Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private
    }
  } else {
    Write-Warning "Réseau « $($p.Name) » en profil $($p.NetworkCategory) : le téléphone ne pourra pas joindre 11TV. Relancez avec -SetNetworkPrivate sur le Wi-Fi de la maison."
  }
}

# --- 5. Démarrage de 11TV à l'ouverture de session ----------------------------------------
Write-Section 'Démarrage automatique'
Invoke-Step "Tâche « 11TV » : $launcher à l'ouverture de session de $User" {
  $taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $RepoDir `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $qualifiedUser
  # Droits ordinaires, dans la session de l'utilisateur : nécessaire pour la souris et le volume.
  $principal = New-ScheduledTaskPrincipal -UserId $qualifiedUser -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName '11TV' -Action $taskAction -Trigger $trigger -Principal $principal `
    -Settings $settings -Description 'Lance le serveur 11TV et le relance au besoin.' -Force | Out-Null
}

# --- 6. Redémarrage nocturne --------------------------------------------------------------
Write-Section 'Redémarrage nocturne'
Invoke-Step "Tâche « 11TV - redémarrage nocturne » : à $RebootTime si la TV ne sert pas, au plus tard à $deadline" {
  $taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$nightly`" -Deadline $deadline"
  $trigger = New-ScheduledTaskTrigger -Daily -At $rebootAt
  # Nouvel essai toutes les 15 minutes pendant 2 heures.
  $trigger.Repetition = (New-ScheduledTaskTrigger -Once -At $rebootAt `
      -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Hours 2)).Repetition
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  Register-ScheduledTask -TaskName '11TV - redémarrage nocturne' -Action $taskAction -Trigger $trigger `
    -Principal $principal -Settings $settings -Force `
    -Description 'Redémarre la Surface la nuit, si la TV ne sert pas.' | Out-Null
}

# --- 7. Connexion automatique -------------------------------------------------------------
Write-Section 'Connexion automatique'
if (Test-Path $AutologonPath) {
  Invoke-Step "Ouverture d'Autologon : saisissez le mot de passe de $User puis cliquez sur Enable" {
    Start-Process -FilePath $AutologonPath -ArgumentList '-accepteula' -Wait
  }
} else {
  Write-Warning @"
Autologon introuvable ($AutologonPath).
  1. Téléchargez Autologon sur le site de Microsoft :
     https://learn.microsoft.com/sysinternals/downloads/autologon
  2. Placez Autologon64.exe dans scripts\tools\ (dossier ignoré par git).
  3. Relancez ce script, ou lancez Autologon64.exe vous-même pour le compte $User.
"@
}

# --- Fin ----------------------------------------------------------------------------------
Write-Section 'Terminé'
if ($DryRun) {
  Write-Host 'Simulation : rien n''a été modifié. Relancez sans -DryRun pour appliquer.' -ForegroundColor Yellow
} else {
  Write-Host 'Configuration appliquée. Redémarrez la Surface pour vérifier le démarrage automatique.' -ForegroundColor Green
  Write-Host "Journaux : %LOCALAPPDATA%\11TV\logs (session $User) et %ProgramData%\11TV."
}
