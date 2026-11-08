# 0009 – Vidéos en arrière-plan

**Statut** : accepté

## Contexte

Revenir à l'accueil depuis YouTube, Twitch ou un autre service ramenait l'onglet principal
sur l'écran TV : la vidéo s'arrêtait. YouTube Music, lui, continuait déjà, grâce à sa
fenêtre à part ([ADR 0006](0006-youtube-music.md)).

## Décision

- **Fenêtre des services** : les services (YouTube, Twitch, Disney+, Prime Video, le
  navigateur vide) s'ouvrent dans une fenêtre Edge dédiée, créée réduite comme celle de la
  musique, puis affichée en plein écran. L'onglet principal reste sur l'accueil.
  - **Accueil** réduit la fenêtre des services (et celle de la musique) : la lecture
    continue. L'accueil n'est pas rechargé.
  - **Relancer un service** navigue la même fenêtre : l'ancienne vidéo s'arrête d'elle-même.
  - Après un redémarrage du serveur, les fenêtres sont retrouvées par leur URL : l'accueil,
    YouTube Music, et l'onglet restant pour les services.
- **Suivi de lecture** (`VideoService`), sur le modèle de la musique : la page est
  interrogée chaque seconde. Le média suivi est un `<video>` ou `<audio>` chargé et audible
  (les aperçus muets des pages d'accueil ne comptent pas), celui qui joue d'abord. Titre et
  chaîne viennent de `navigator.mediaSession`, sinon du titre de la page et du nom du
  service. Les images de YouTube et de Twitch passent par le relais des pochettes ; sans
  image, les cartes montrent l'icône du service.
- **Une seule source de son** : lancer un service met la musique en pause, ouvrir la
  musique met la vidéo en pause, et relancer l'une depuis le téléphone met l'autre en pause.
- **Cartes « en cours »** : la carte de l'accueil TV et la pastille du téléphone montrent ce
  qui joue (la vidéo d'abord), sinon ce qui est en pause (la vidéo d'abord). Pour une vidéo,
  le bouton de la pastille met en pause ou relance, et un appui ailleurs la ramène sur la TV.
- **Redémarrage nocturne** : une vidéo qui joue en arrière-plan compte comme une utilisation.

## Alternatives

- **Accueil dans une fenêtre par-dessus la vidéo** : symétrique, mais l'onglet principal
  changerait de rôle à chaque lancement, et les fonds d'écran tourneraient dans une fenêtre
  souvent cachée.
- **Commandes propres à chaque site** (API du lecteur YouTube, boutons de Twitch…) : plus
  riches (suivant, précédent), mais à maintenir site par site. L'élément média et la
  `mediaSession` fonctionnent partout pour lecture/pause.
