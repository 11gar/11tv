# 0005 – Entrées clavier et souris

**Statut** : proposé (phase 2)

## Décision prévue

- **Touches et texte** : `Input.dispatchKeyEvent` et `Input.insertText` via CDP. Elles
  arrivent dans la page même si Edge n'a pas le focus Windows, et le navigateur les traite
  comme de vraies actions de l'utilisateur (le plein écran vidéo fonctionne).
- **Trackpad** : `SendInput` de `user32.dll` via **koffi**, sans compilation native, pour un
  vrai curseur visible et le survol. Mouvements regroupés à 60 Hz. Avant un clic, Edge est
  ramené au premier plan (`Page.bringToFront`, `SetForegroundWindow`).
- **Volume** : touches `VK_VOLUME_UP/DOWN/MUTE` via `SendInput`, qui pilotent le volume de
  Windows. Le volume de la TV n'est pas accessible (pas de HDMI-CEC sur la Surface).

## Alternatives écartées

- **nut.js** : binaires précompilés devenus payants.
- **robotjs** : n'est plus maintenu, demande une compilation native.
- **PowerShell `SendInput`** : 100 à 300 ms par appel si on lance un processus à chaque
  événement. Un processus PowerShell permanent piloté par stdin reste un repli possible.
