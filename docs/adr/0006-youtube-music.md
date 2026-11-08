# 0006 – YouTube Music

**Statut** : accepté (phase 3)

## Décision

- **Fenêtre dédiée** : YouTube Music vit dans sa propre fenêtre Edge, créée réduite par CDP
  (`Target.createTarget` avec `newWindow` et `windowState: minimized`). Un simple onglet
  ne convient pas : en kiosque comme en mode application, Edge ouvre de toute façon une
  nouvelle fenêtre, non plein écran.
  - **Afficher** la musique : fenêtre en plein écran (`Browser.setWindowBounds`), par-dessus
    le kiosque. En développement, elle reprend la position de la fenêtre d'application.
  - **Accueil** : la fenêtre est réduite et l'onglet principal revient devant. La lecture
    continue : une page réduite reste « visible » pour Chromium et n'est pas ralentie
    (vérifié en kiosque, captures d'écran à l'appui).
  - Avant d'afficher la musique, la vidéo en cours se met en pause (voir l'ADR 0009). Lancer
    un autre service met la musique en pause.
  - Après un redémarrage du serveur, la fenêtre est retrouvée par son URL et son état.
- **Suivi de lecture** : la page est interrogée chaque seconde par `page.evaluate`
  (fonctionne fenêtre réduite) : `navigator.mediaSession.metadata` pour le titre, l'artiste
  et la pochette, l'élément `<video>` pour la lecture, la position et la durée, l'URL pour
  les identifiants. L'état n'est rediffusé qu'aux changements visibles (titre, pause, saut) ;
  les clients avancent la position eux-mêmes. Plus simple et plus robuste qu'un script
  injecté avec `Runtime.addBinding`, qui serait à réinjecter à chaque navigation.
- **Contrôles** : API du lecteur `#movie_player` (`playVideo`, `pauseVideo`, `nextVideo`,
  `previousVideo`), avec repli sur les boutons de la barre de lecture.
- **Pochettes** : relayées par le serveur local (`/api/music/artwork/<clé>`), car les pages
  n'autorisent que leurs propres images (CSP). Seules les URL connues (titre en cours,
  historique) sur les hôtes d'images de Google sont servies : ce n'est pas un proxy ouvert.
- **Dernière écoute** : historique local des titres écoutés sur la TV (après 10 s
  d'écoute, 20 titres, `music-history.json`), avec reprise en un appui depuis le téléphone.
- **Pastille « En cours de lecture »** sur l'écran d'accueil TV : en bas au centre, en verre
  translucide, avec la pochette, le titre, l'artiste et l'état lecture/pause. Elle
  s'efface après 5 minutes de pause et se décale de quelques pixels toutes les 10 minutes
  (marquage des écrans). Le téléphone a la même pastille, qui ouvre le lecteur complet.
- **Pochettes carrées** : les miniatures de clips (4:3 avec bandes noires) sont rognées puis
  recadrées en 512 × 512 par sharp, dans le relais.

## Alternatives

- **youtubei.js** (historique du compte Google, requête `FEmusic_history`) : prévu au départ.
  Écarté pour l'instant : il faut lire les cookies Google du profil et signer les requêtes,
  pour une API interne qui change souvent. L'historique local couvre l'usage sur la TV ; ce
  module reste possible plus tard derrière une interface si l'historique du compte manque.
- **ytmusicapi** (Python) : un second runtime et de l'IPC ; son OAuth demande désormais un
  client Google personnel.
- **Onglet unique** (YouTube Music dans l'onglet principal) : revenir à l'accueil couperait
  la musique.
