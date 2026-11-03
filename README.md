# 11TV

Interface TV personnalisée pour une Surface Pro 8 branchée à la télé, pilotée depuis un
téléphone Android (PWA) sur le Wi-Fi local.

> **État : phase 2.** Écran d'accueil TV (fonds d'écran en fondu, date et heure), lancement
> de YouTube, YouTube Music, Disney+ et Prime Video depuis le téléphone, télécommande
> (pavé, clavier, trackpad, volume), réglages (fonds d'écran, délai, PIN), PWA protégée par
> PIN. Feuille de route en bas de page.

## Sommaire

- [Fonctionnement](#fonctionnement)
- [Développement](#développement)
- [Installation sur la Surface](#installation-sur-la-surface)
- [Utilisation](#utilisation)
- [Installation sur le téléphone](#installation-sur-le-téléphone)
- [Configuration](#configuration)
- [Sécurité](#sécurité)
- [Feuille de route](#feuille-de-route)

## Fonctionnement

```
Téléphone (PWA) ──HTTPS/WSS :8443──► Serveur Node ──CDP 127.0.0.1:9222──► Edge (kiosque)
                                       │  ▲                                   │
                                       │  └──── WS ws://127.0.0.1:8080 ◄──────┘ écran TV
                                       └─ HTTP :8081 : page d'installation du certificat
```

- Le **serveur** (Fastify) lance Edge en mode kiosque et le pilote via le protocole DevTools
  (CDP) : lancer un service revient à naviguer l'onglet vers son URL, « Accueil » le ramène
  sur l'écran TV.
- L'**écran TV** est servi en HTTP sur `127.0.0.1` uniquement ; le **téléphone** passe par un
  serveur HTTPS exposé au réseau local et protégé par PIN.
- Tout l'état est poussé par WebSocket ; les clients se reconnectent seuls.

Détails et justification des choix : [docs/architecture.md](docs/architecture.md) et
[docs/adr/](docs/adr/).

```
apps/server     serveur Node (TypeScript, Fastify)
apps/tv         écran d'accueil TV (Preact)
apps/mobile     PWA du téléphone (Preact, vite-plugin-pwa)
packages/shared types, services, schémas zod (serveur uniquement)
packages/web    code commun aux deux interfaces (WebSocket avec reconnexion)
scripts/        scripts PowerShell pour la Surface
docs/           architecture et décisions
```

## Développement

Prérequis : Windows, Node.js 24 ou plus, pnpm 10, Edge.

```bash
pnpm install
```

```bash
copy .env.example .env
```

Le fichier `.env` d'exemple met les données dans `.data/` et ouvre Edge dans une fenêtre
d'application plutôt qu'en kiosque.

```bash
pnpm build
```

```bash
pnpm dev
```

`pnpm dev` lance le serveur (rechargé à chaque modification) qui sert les interfaces
construites. Pour travailler sur une interface avec rechargement à chaud, lancez en plus
`pnpm dev:tv` (http://localhost:5173) ou `pnpm dev:mobile` (http://localhost:5174) : Vite
relaie l'API et le WebSocket vers le serveur.

Au premier démarrage, la TV affiche un PIN d'appairage à 6 chiffres. Pour en regénérer un :
`pnpm pin:reset`, puis redémarrez le serveur.

| Commande         | Rôle                                                  |
| ---------------- | ----------------------------------------------------- |
| `pnpm check`     | Types, lint, formatage et tests (à lancer avant push) |
| `pnpm test`      | Tests Vitest                                          |
| `pnpm lint`      | ESLint (typescript-eslint strict)                     |
| `pnpm format`    | Prettier                                              |
| `pnpm build`     | Construit les interfaces et le serveur                |
| `pnpm start`     | Lance le serveur construit                            |
| `pnpm pin:reset` | Supprime le PIN et les sessions                       |

## Installation sur la Surface

> Le démarrage automatique (connexion de session, tâche planifiée, redémarrage nocturne)
> arrive en phase 4 avec `scripts/setup-surface.ps1`. En attendant, le serveur se lance à la main.

1. **Écran** : Paramètres → Système → Écran → « Afficher uniquement sur 2 » (la TV seule).
2. **Logiciels** : installez Node.js LTS et Git, puis pnpm :
   ```bash
   winget install --id OpenJS.NodeJS.LTS -e
   ```
   ```bash
   winget install --id Git.Git -e
   ```
   ```bash
   npm install -g pnpm@10
   ```
3. **Code** : clonez le dépôt, puis installez et construisez :
   ```bash
   pnpm install
   ```
   ```bash
   pnpm build
   ```
4. **Phase 0, vérifications** : lancez le script et suivez la liste affichée (DRM, HDCP,
   connexion Google, mode kiosque) :
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts\phase0-check.ps1
   ```
5. **Comptes** : connectez-vous à Google (YouTube Music), Disney+ et Prime Video dans le
   profil Edge de 11TV. Si Google refuse la connexion, fermez Edge et lancez :
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts\edge-login.ps1
   ```
6. **Réseau** : le Wi-Fi doit être en profil **Privé** (Paramètres → Réseau et Internet →
   Wi-Fi → votre réseau → Type de profil réseau). Désactivez aussi les « Adresses matérielles
   aléatoires » pour ce réseau : la box garde alors plus volontiers la même IP.
7. **Lancement** : `pnpm start`. Windows demande d'autoriser Node sur le pare-feu :
   cochez **Réseaux privés uniquement**.
8. **Fonds d'écran** : ajoutez-les depuis le téléphone (Réglages), ou déposez des images
   (JPG, PNG, WebP, AVIF) dans `%LOCALAPPDATA%\11TV\wallpapers` ; la TV se met à jour seule.

## Utilisation

**Accueil** : lance un service sur la TV ou revient à l'écran d'accueil.

**Télécommande**, en trois modes :

| Mode     | Usage                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Pavé     | Flèches (maintenir pour répéter), OK, Retour (Échap), Lecture (Espace), Précédent (page précédente), élément suivant/précédent (Tab) |
| Trackpad | Glisser : curseur · toucher : clic · deux doigts : défiler · toucher à deux doigts : clic droit                                      |
| Clavier  | Cliquez d'abord dans le champ de recherche (trackpad), puis tapez et envoyez                                                         |

Le volume (−, muet, +) pilote le volume de Windows ; celui de la TV reste sur sa télécommande.

Les touches passent par Edge lui-même : elles fonctionnent même si Edge n'a pas le focus.
La souris et le volume passent par Windows (`SendInput`) : le serveur doit tourner dans la
session de l'utilisateur, pas comme service.

**Réglages** : ajout d'images (JPEG, PNG ou WebP ; elles sont réduites à 3840 px, converties
en WebP et débarrassées de leurs métadonnées, position GPS comprise), ordre, suppression,
délai de défilement, changement de PIN (les autres téléphones sont déconnectés).

## Installation sur le téléphone

1. Le téléphone doit être sur le même Wi-Fi que la Surface.
2. Scannez le QR code affiché sur la TV (ou ouvrez `http://<IP de la Surface>:8081/`) et
   téléchargez le certificat.
3. Installez-le : Paramètres → Sécurité et confidentialité → Plus de paramètres de sécurité →
   Chiffrement et identifiants → Installer un certificat → **Certificat CA** (le chemin varie
   selon les marques). Vérifiez que l'empreinte correspond à celle affichée sur la TV.
4. Ouvrez l'adresse HTTPS indiquée sur la TV (`https://<IP>:8443/`) dans Chrome, saisissez le
   PIN, puis menu ⋮ → **Ajouter à l'écran d'accueil**.

**Limites connues sous Android**

- Android peut afficher en permanence « Le réseau peut être surveillé » après l'ajout d'un
  certificat CA utilisateur.
- Les serveurs de Google ne peuvent pas joindre une IP privée : Chrome installe un raccourci
  qui s'ouvre en plein écran, mais l'app peut ne pas apparaître dans le tiroir d'applications.
- **Sans IP fixe**, si la box attribue une autre adresse à la Surface, le certificat est
  réémis automatiquement mais l'app installée pointe vers l'ancienne adresse : rouvrez la
  nouvelle adresse et réinstallez le raccourci. Le nom `<nom-du-pc>.local` est aussi inclus
  dans le certificat et peut fonctionner si votre Android résout le mDNS.

## Configuration

Toutes les options passent par des variables d'environnement (ou le fichier `.env` à la
racine), validées au démarrage : voir [.env.example](.env.example). Sur la Surface, les
valeurs par défaut conviennent.

Données (jamais dans le dépôt), dans `%LOCALAPPDATA%\11TV\` :

| Chemin          | Contenu                                         |
| --------------- | ----------------------------------------------- |
| `settings.json` | Réglages et empreinte du PIN                    |
| `sessions.json` | Empreintes des jetons de session des téléphones |
| `certs/`        | Autorité locale et certificat du serveur        |
| `wallpapers/`   | Fonds d'écran                                   |
| `thumbs/`       | Vignettes des fonds d'écran (régénérables)      |
| `edge-profile/` | Profil Edge du kiosque (cookies des services)   |
| `logs/11tv.log` | Journaux JSON                                   |

## Sécurité

- **PIN** haché avec scrypt ; 5 erreurs par adresse (20 au total) déclenchent un blocage dont
  la durée double, jusqu'à 15 minutes.
- **Sessions** : jeton aléatoire dans un cookie `__Host-`, `HttpOnly`, `Secure`,
  `SameSite=Strict`, 90 jours glissants ; seule son empreinte SHA-256 est stockée.
- **Réseau** : toute requête hors réseau privé est refusée ; l'écran TV et le port CDP
  n'écoutent que sur `127.0.0.1` ; l'en-tête `Origin` est vérifié sur l'API et le WebSocket.
- **Certificats** : l'autorité locale porte des _contraintes de nom_ critiques. Elle ne peut
  signer que pour `localhost`, `*.local` et les plages IP privées : même volée, sa clé ne
  permettrait pas d'intercepter le trafic Internet du téléphone.
- **Identifiants des services** : ils restent dans le profil Edge. Rien n'est stocké par 11TV.

## Feuille de route

- [x] **Phase 1** : serveur, écran d'accueil TV, lancement des services, retour à l'accueil,
      PWA avec PIN.
- [x] **Phase 2** : télécommande (pavé, OK, retour, clavier, trackpad), réglages des fonds
      d'écran et du délai, changement de PIN.
- [ ] **Phase 3** : YouTube Music (dernière écoute, lancement, contrôles).
- [ ] **Phase 4** : démarrage automatique, redémarrage nocturne, robustesse.
