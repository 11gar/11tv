# Architecture de 11TV

## Vue d'ensemble

```
apps/server
  index.ts            assemblage : config, stores, TLS, navigateur, hub, serveurs HTTP
  config.ts           variables d'environnement validées par zod, chemins des données
  hub/state-hub.ts    cœur : commandes des clients -> navigateur, diffusion de l'état
  browser/            BrowserController (interface) et EdgeBrowser (CDP via playwright-core)
  input/              RemoteControl (télécommande -> touches CDP / souris), pilote SendInput
  music/              suivi et commandes de YouTube Music, historique, relais des pochettes
  auth/               PIN (scrypt), limiteur de tentatives, sessions, AuthService
  http/               lan-app (téléphone, HTTPS), tv-app (127.0.0.1), setup-app (certificat)
  tls/                autorité locale à contraintes de nom, certificat serveur
  net/                adresses privées, adresses de la machine sur le réseau local
  settings/, storage/ réglages persistés (JSON atomique validé)
  wallpapers/         dossier surveillé, ajout/ordre/suppression et vignettes (sharp)
  errors.ts           UserFacingError : message affiché tel quel sur le téléphone
packages/shared       types et catalogue des services (sans dépendance) + schémas zod
packages/web          commun aux deux interfaces : WebSocket, fonds d'écran, style « verre »
apps/tv, apps/mobile  interfaces Preact construites par Vite et servies par le serveur
```

## Flux principal

1. Le téléphone envoie `{ type: 'launch', service: 'disney-plus' }` sur le WebSocket.
2. `hub-socket` valide le message (zod), `StateHub` demande à `EdgeBrowser` de naviguer.
3. Edge charge le site ; l'événement `framenavigated` de CDP remonte l'URL.
4. `StateHub` en déduit la vue (`viewForUrl`) et pousse l'état complet à tous les clients.

L'état affiché vient donc de ce que fait vraiment Edge, pas de ce qui a été demandé.

YouTube Music suit un chemin à part : il a sa propre fenêtre Edge, affichée en plein écran
ou réduite, et la vue `youtube-music` correspond à cette fenêtre au premier plan.
`MusicService` interroge la page chaque seconde et ne rediffuse l'état qu'aux changements
visibles ; voir [l'ADR 0006](adr/0006-youtube-music.md).

## Trois serveurs HTTP

| Serveur     | Écoute             | Public                  | Protection                            |
| ----------- | ------------------ | ----------------------- | ------------------------------------- |
| `tv-app`    | `127.0.0.1:8080`   | Edge, sur la Surface    | boucle locale uniquement              |
| `lan-app`   | `0.0.0.0:8443` TLS | téléphone               | réseau privé, PIN, Origin, cookie     |
| `setup-app` | `0.0.0.0:8081`     | téléphone, installation | réseau privé ; ne sert rien de secret |

Séparer la TV du téléphone évite de faire confiance au certificat local sous Windows
(localhost est un contexte sécurisé) et rend impossible l'accès aux données réservées à la
TV (PIN d'appairage) depuis le réseau.

## Robustesse

- **Serveur** : lancé par `scripts/run-11tv.ps1` (tâche planifiée à l'ouverture de session),
  qui le relance s'il s'arrête ou si `/api/health` ne répond plus. Une exception non gérée
  arrête le serveur plutôt que de le laisser dans un état inconnu.
- **Nuit** : redémarrage de la Surface si la TV ne sert pas, mises à jour Windows comprises.
- **Mise à jour de 11TV** : `POST /api/update` (téléphone, session requise) lance
  `scripts/update.ps1`, un script fixe sans paramètre venant du téléphone. Il récupère le
  code ; s'il n'y a rien de nouveau, il s'arrête (code 3). Sinon il reconstruit et arrête le
  serveur, que le lanceur relance sur la nouvelle version. La sortie du script va dans
  `logs/update.log`, dont la fin est renvoyée au téléphone en cas d'échec.
- **Journaux** : rotation par taille faite par le serveur (10 Mo, 5 fichiers).
- **Edge** : boucle de réconciliation toutes les 5 s (port de debug -> connexion -> onglet).
  Edge est détaché du serveur : un redémarrage du serveur ne ferme pas le kiosque, ni la
  fenêtre de musique, retrouvée par son URL.
- **WebSocket** : ping de protocole côté serveur, message `heartbeat` pour le client, délai
  de reconnexion exponentiel avec une part aléatoire, reconnexion immédiate au réveil du téléphone.
- **IP dynamique** : vérifiée chaque minute ; le certificat est réémis et rechargé à chaud
  (`setSecureContext`), le QR code d'appairage est recalculé.
- **Fichiers** : écriture atomique et sérialisée ; un fichier corrompu est mis de côté et
  remplacé par les valeurs par défaut. Les modifications de réglages sont mises en file :
  deux commandes simultanées ne s'écrasent pas.
- **Fonds d'écran** : écrits sous un nom temporaire puis renommés (la TV ne voit jamais une
  image à moitié écrite) ; cache de libvips désactivé, sinon Windows verrouille les fichiers.
- **Sessions révoquées** (changement de PIN) : vérifiées à chaque message et à chaque
  heartbeat ; le WebSocket est fermé avec le code 4401.

## Décisions

Les choix structurants sont détaillés dans [adr/](adr/) :

1. [Pilotage d'Edge par CDP](adr/0001-pilotage-edge-cdp.md)
2. [HTTPS local par autorité à contraintes de nom](adr/0002-https-autorite-locale.md)
3. [État complet poussé par WebSocket](adr/0003-etat-complet-websocket.md)
4. [Monorepo pnpm et serveur regroupé par esbuild](adr/0004-monorepo-et-build.md)
5. [Entrées clavier et souris](adr/0005-entrees-clavier-souris.md)
6. [YouTube Music (phase 3)](adr/0006-youtube-music.md)
7. [Démarrage automatique et robustesse (phase 4)](adr/0007-demarrage-automatique.md)
