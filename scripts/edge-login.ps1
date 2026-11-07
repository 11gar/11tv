<#
.SYNOPSIS
  Ouvre le profil Edge de 11TV SANS port de debug, pour se connecter aux services.

.DESCRIPTION
  Google peut refuser une connexion quand le port de debug est ouvert. Ce script ouvre
  le même profil que le serveur, sans ce port, sur les pages de connexion. Les cookies
  restent dans le profil : la TV sera ensuite connectée.

  Le serveur 11TV doit être arrêté, et Edge fermé : sinon Edge transmet ces pages
  à l'instance existante (avec port de debug) au lieu d'en ouvrir une nouvelle.
#>
[CmdletBinding()]
param(
  [string]$ProfileDir = (Join-Path $env:LOCALAPPDATA '11TV\edge-profile')
)

$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

$running = Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" |
  Where-Object { $_.CommandLine -like "*$ProfileDir*" }
if ($running) {
  throw "Un Edge utilise déjà le profil 11TV. Arrêtez le serveur et fermez Edge (Alt+F4), puis relancez."
}

New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null
Start-Process -FilePath $edge -ArgumentList @(
  "--user-data-dir=$ProfileDir",
  '--no-first-run',
  '--no-default-browser-check',
  'https://accounts.google.com/',
  'https://music.youtube.com/',
  'https://www.disneyplus.com/login',
  'https://www.primevideo.com/'
)

Write-Host "Connectez-vous dans chaque onglet, puis fermez Edge et relancez 11TV."
