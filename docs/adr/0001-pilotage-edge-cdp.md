# 0001 – Pilotage d'Edge par le protocole DevTools (CDP)

**Statut** : accepté (phase 1), kiosque remplacé par le plein écran (novembre 2026)

## Contexte

Il faut passer de l'accueil à un service puis revenir, depuis le téléphone, avec Edge en
kiosque sur Windows 11 Famille (sans accès attribué).

## Décision

Un seul Edge en `--kiosk --edge-kiosk-type=fullscreen`, avec un profil dédié et
`--remote-debugging-port=9222` (écoute en boucle locale). Le serveur s'y attache avec
`playwright-core` (`connectOverCDP`) et navigue l'onglet principal.

Edge est lancé par le serveur et non par Playwright : `chromium.launch()` ajoute
`--enable-automation`, détecté par Google et les plateformes de streaming.

## Alternatives écartées

- **Gestion de fenêtres** (plusieurs Edge, `SetForegroundWindow`) : Windows limite le passage
  au premier plan, ordre des fenêtres imprévisible, profils partagés entre processus.
- **Extension Edge** : à installer et maintenir, aucun gain par rapport à CDP.

## Conséquences

- Navigation déterministe, état réel remonté par `framenavigated`.
- CDP servira aussi aux phases 2 et 3 (touches clavier, script injecté dans YouTube Music).
- Risque : Google peut refuser une connexion avec le port ouvert. Parade : `edge-login.ps1`.
- Risque : les options du kiosque peuvent changer avec Edge. La version est visible dans les
  journaux ; repli possible sur `--start-fullscreen`.

## Révision : plein écran plutôt que kiosque

Le kiosque d'Edge efface cookies et stockage à chaque fermeture, même avec un profil
dédié (vérifié : un cookie déposé disparaît à la relance en `--kiosk`, reste en
`--start-fullscreen`). Le redémarrage nocturne déconnectait donc tous les services. Edge est
désormais lancé en `--start-fullscreen --hide-crash-restore-bubble`. On perd le verrouillage
du kiosque (F11 sur un clavier branché à la Surface sort du plein écran), sans conséquence
pour une TV pilotée depuis le téléphone.
