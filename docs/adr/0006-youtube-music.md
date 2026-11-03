# 0006 – YouTube Music

**Statut** : proposé (phase 3)

## Décision prévue

- **Historique** : `youtubei.js` (Node), requête interne `FEmusic_history`, derrière une
  interface `MusicHistoryProvider`.
- **Authentification** : aucun identifiant stocké par 11TV. Les cookies de session Google sont
  lus au moment voulu dans le profil Edge du kiosque, via CDP (`Storage.getCookies`), et gardés
  en mémoire seulement. Edge les rafraîchit lui-même.
- **Lecture** : onglet « musique » en arrière-plan, pour que l'accueil reste affiché. Contrôles
  par script injecté qui appelle l'API du lecteur `#movie_player` ; l'état remonte par
  `Runtime.addBinding`. Replis : raccourcis clavier via CDP, puis touches média.

## Alternatives

- **ytmusicapi** (Python) : `get_history()` très mature, mais un second runtime et de l'IPC ;
  son OAuth demande désormais un client Google personnel. Gardé en repli derrière l'interface
  si youtubei.js casse.
