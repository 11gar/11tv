<#
.SYNOPSIS
  Phase 0 de 11TV : vérifie sur la Surface ce qui peut remettre en cause l'architecture.

.DESCRIPTION
  Ce script ne modifie rien sur le système. Il :
    1. vérifie qu'Edge est installé et affiche sa version ;
    2. lance Edge avec le profil dédié de 11TV et le port de debug (comme le fera le serveur) ;
    3. vérifie que le protocole DevTools (CDP) répond ;
    4. ouvre les pages de diagnostic et les services à tester ;
    5. affiche la liste des points à contrôler à la main.

  Arrêtez le serveur 11TV avant de lancer ce script (il utilise le même profil Edge).

.PARAMETER Kiosk
  Teste le mode kiosque plein écran sur YouTube (Alt+F4 pour quitter).

.PARAMETER ProfileDir
  Profil Edge à utiliser. Par défaut, celui du serveur : %LOCALAPPDATA%\11TV\edge-profile.
#>
[CmdletBinding()]
param(
  [switch]$Kiosk,
  [string]$ProfileDir = (Join-Path $env:LOCALAPPDATA '11TV\edge-profile'),
  [int]$DebugPort = 9222
)

$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

Write-Host "`n=== 11TV - Phase 0 : vérifications ===`n" -ForegroundColor Cyan

# 1. Edge
if (-not (Test-Path $edge)) { throw "Edge introuvable : $edge" }
$version = (Get-Item $edge).VersionInfo.ProductVersion
Write-Host "[OK] Edge $version"

# 2. Lancement avec le profil dédié et le port de debug
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
$common = @(
  "--user-data-dir=$ProfileDir",
  "--remote-debugging-port=$DebugPort",
  '--no-first-run',
  '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required'
)
if ($Kiosk) {
  $edgeArgs = $common + @('--kiosk', 'https://www.youtube.com/', '--edge-kiosk-type=fullscreen')
  Write-Host "[..] Lancement en mode kiosque (Alt+F4 pour quitter)"
} else {
  $pages = @(
    'edge://gpu',
    'edge://media-internals',
    'https://www.disneyplus.com/',
    'https://www.primevideo.com/',
    'https://music.youtube.com/'
  )
  $edgeArgs = $common + @('--new-window') + $pages
  Write-Host "[..] Lancement d'Edge avec les pages de test"
}
Start-Process -FilePath $edge -ArgumentList $edgeArgs

# 3. CDP
$cdp = $null
foreach ($i in 1..15) {
  Start-Sleep -Seconds 1
  try {
    $cdp = Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json/version" -TimeoutSec 2
    break
  } catch { }
}
if ($cdp) {
  Write-Host "[OK] Le port de debug répond : $($cdp.Browser)" -ForegroundColor Green
} else {
  Write-Host "[KO] Le port de debug ne répond pas. Un Edge utilisait-il déjà ce profil ?" -ForegroundColor Red
}

# 4. Points à vérifier à la main
Write-Host @"

=== À vérifier à la main (notez les résultats) ===

Affichage et son
  [ ] Paramètres > Système > Écran : « Afficher uniquement sur 2 », résolution native de la TV.
  [ ] Le son sort bien par la TV (icône du haut-parleur > sortie HDMI).

DRM et qualité (onglets ouverts)
  [ ] edge://gpu : « Video Decode » est « Hardware accelerated ».
  [ ] Connectez-vous à Disney+ et Prime Video, lancez un film :
      - la vidéo s'affiche (pas d'écran noir = HDCP de l'adaptateur OK) ;
      - edge://media-internals > lecteur actif : notez la résolution (ex. 1920x1080).
  [ ] Si écran noir ou erreur de lecture : tester un autre adaptateur USB-C > HDMI (HDCP 2.2).

Comptes
  [ ] La connexion Google sur music.youtube.com fonctionne AVEC le port de debug.
      Si Google refuse (« navigateur non sécurisé ») : fermez Edge et lancez
      scripts\edge-login.ps1, qui ouvre le même profil sans port de debug.

Mode kiosque (relancez avec -Kiosk)
  [ ] Edge s'ouvre en plein écran, sans barre d'adresse.
  [ ] Testez aussi https://www.youtube.com/tv (interface TV, sans doute refusée sur PC : normal).

"@
