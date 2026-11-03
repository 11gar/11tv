# 0005 – Entrées clavier et souris

**Statut** : accepté (phase 2)

## Décision

- **Touches et texte** : `page.keyboard.press` et `page.keyboard.insertText` de Playwright,
  c'est-à-dire `Input.dispatchKeyEvent` / `Input.insertText` de CDP. Elles arrivent dans la
  page même si Edge n'a pas le focus Windows, et le navigateur les traite comme de vraies
  actions de l'utilisateur (le plein écran vidéo fonctionne).
- **Trackpad** : `SendInput` de `user32.dll` via **koffi**, sans compilation native, pour un
  vrai curseur visible et le survol. Côté téléphone, les gestes sont interprétés par
  `TrackpadGestures` (module pur, testé) et les déplacements cumulés sont envoyés une fois par
  image affichée (environ 60 par seconde).
- **Focus** : seul le clavier en dépend, et il passe par CDP. Un clic `SendInput` active de
  lui-même la fenêtre qu'il touche ; aucun `SetForegroundWindow` n'est donc nécessaire.
- **Volume** : touches `VK_VOLUME_UP/DOWN/MUTE` via `SendInput`, qui pilotent le volume de
  Windows (avec son affichage à l'écran). Le volume de la TV n'est pas accessible (pas de
  HDMI-CEC sur la Surface).
- Hors Windows, ou si `user32.dll` ne se charge pas, un `NullInputDriver` prend le relais et
  l'état indique `pointerAvailable: false` : le téléphone masque le trackpad.

## Alternatives écartées

- **nut.js** : binaires précompilés devenus payants.
- **robotjs** : n'est plus maintenu, demande une compilation native.
- **PowerShell `SendInput`** : 100 à 300 ms par appel si on lance un processus à chaque
  événement. Un processus PowerShell permanent piloté par stdin reste un repli possible.

## Limites

- `SendInput` est bloqué par l'UIPI si une fenêtre plus privilégiée (administrateur, UAC) est
  au premier plan, et quand la session est verrouillée (journalisé en avertissement).
- Les déplacements relatifs suivent l'accélération du pointeur de Windows (« Améliorer la
  précision du pointeur »).
