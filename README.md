# 11TV

Interface TV personnalisée pour une Surface Pro 8 branchée à la télé, pilotée depuis un
téléphone Android (PWA) sur le Wi-Fi local.

> **État : phases 1 à 4 terminées.** Écran d'accueil TV (fonds d'écran en fondu, heure),
> lancement de YouTube, YouTube Music, Disney+ et Prime Video depuis le téléphone,
> télécommande (trackpad, clavier, volume), musique qui continue à l'accueil, réglages
> (fonds d'écran, délai, PIN), PWA protégée par PIN, démarrage automatique et redémarrage
> nocturne de la Surface. Feuille de route en bas de page.

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
packages/web    code commun aux deux interfaces (WebSocket, fonds d'écran, style « verre »)
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

Au premier démarrage, la TV affiche un PIN d'appairage à 6 chiffres. Ensuite, dès qu'aucun
téléphone n'est connecté (déconnexion, session expirée), elle affiche un code à usage unique,
accepté en plus du PIN. Pour repartir de zéro : `pnpm pin:reset`, puis redémarrez le serveur.

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

Tout se fait dans la session du **compte local de la TV** (par exemple `tv`), sauf l'étape 6
qui demande une console administrateur. Créez ce compte au besoin : Paramètres → Comptes →
Autres utilisateurs → Ajouter un compte → « Je ne dispose pas des informations de connexion
de cette personne » → « Ajouter un utilisateur sans compte Microsoft ».

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
   pnpm s'installe **pour le seul compte qui lance cette commande** (dans
   `%APPDATA%\npm`) : lancez-la depuis la session de la TV, même s'il est déjà installé sur
   votre compte, puis ouvrez une nouvelle console. Si PowerShell refuse `pnpm` (« l'exécution
   de scripts est désactivée »), tapez `pnpm.cmd` à la place.
3. **Code** : clonez le dépôt, puis installez et construisez :
   ```bash
   pnpm.cmd install
   ```
   ```bash
   pnpm.cmd build
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
6. **Configuration de Windows** : téléchargez [Autologon](https://learn.microsoft.com/sysinternals/downloads/autologon)
   (Sysinternals, Microsoft) et placez `Autologon64.exe` dans `scripts\tools\`. Puis, dans
   une console PowerShell **ouverte en administrateur**, à la racine du dépôt, lisez d'abord
   ce que le script va faire (simulation, rien n'est modifié) :
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts\setup-surface.ps1 -User tv -DryRun
   ```
   puis appliquez (ajoutez `-SetNetworkPrivate` si le Wi-Fi de la maison est en profil
   public) :
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts\setup-surface.ps1 -User tv
   ```
   Autologon s'ouvre : saisissez le mot de passe du compte et cliquez sur **Enable**. Il
   est stocké chiffré par Windows, jamais dans le dépôt.
7. **Réseau** : dans les paramètres du Wi-Fi, désactivez les « Adresses matérielles
   aléatoires » : la box garde alors plus volontiers la même IP.
8. **Redémarrage** : la Surface ouvre la session seule, et 11TV démarre.
9. **Fonds d'écran** : ajoutez-les depuis le téléphone (Réglages), ou déposez des images
   (JPG, PNG, WebP, AVIF) dans `%LOCALAPPDATA%\11TV\wallpapers` ; la TV se met à jour seule.

### Ce que configure `setup-surface.ps1`

| Domaine        | Réglage                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Énergie        | Jamais de veille ni d'écran éteint sur secteur, rabat sans effet, démarrage rapide désactivé    |
| Windows Update | Heures d'utilisation de 8 h à 2 h : les redémarrages de mise à jour tombent la nuit             |
| Edge           | Pas d'écran de bienvenue ni de « restaurer les pages », lecture automatique, pas de suggestions |
| Pare-feu       | Node joignable sur les ports 8443 et 8081 depuis le réseau privé uniquement                     |
| Démarrage      | Tâche « 11TV » à l'ouverture de session : `scripts\run-11tv.ps1`                                |
| Nuit           | Tâche « 11TV - redémarrage nocturne » à 4 h, si la TV ne sert pas ; au plus tard à 5 h 45       |
| Connexion      | Ouverture de session automatique du compte de la TV (Autologon)                                 |

Le **lanceur** (`run-11tv.ps1`) coupe les notifications de la session, démarre le serveur et
le relance s'il s'arrête ou ne répond plus (vérification toutes les 30 s). Le **redémarrage
nocturne** attend que la TV soit sur l'accueil sans musique ; il installe au passage les
mises à jour Windows en attente.

### Mettre à jour

Depuis le téléphone : **Réglages → Mise à jour → Mettre à jour 11TV**. Le téléphone indique
si 11TV était déjà à jour, affiche l'erreur en cas d'échec, et se recharge tout seul sur la
nouvelle version.

Ou depuis la session de la TV, sans droits d'administrateur (`-Force` pour reconstruire
même sans nouveau code) :

```bash
powershell -ExecutionPolicy Bypass -File scripts\update.ps1
```

Le script récupère le code, réinstalle les dépendances (avec pnpm, ou via `npx` si pnpm
n'est pas installé pour ce compte), reconstruit, puis arrête le serveur : le lanceur le relance avec la nouvelle version quelques secondes plus tard.

### Journaux

| Fichier                                 | Contenu                            |
| --------------------------------------- | ---------------------------------- |
| `%LOCALAPPDATA%\11TV\logs\11tv.log`     | Serveur (10 Mo au plus, 5 anciens) |
| `%LOCALAPPDATA%\11TV\logs\launcher.log` | Démarrages et relances du serveur  |
| `%ProgramData%\11TV\nightly-reboot.log` | Décisions du redémarrage nocturne  |

## Utilisation

Le téléphone tient sur une seule page, sur les mêmes fonds d'écran que la TV :

| Élément             | Usage                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Horloge             | Un appui ramène la TV à l'écran d'accueil                                                       |
| Icônes des services | Lancent YouTube, YouTube Music, Disney+ ou Prime Video sur la TV                                |
| Trackpad            | Glisser : curseur · toucher : clic · deux doigts : défiler · toucher à deux doigts : clic droit |
| Volume + et −       | Volume de Windows (maintenir pour répéter) ; celui de la TV reste sur sa télécommande           |
| Clavier             | Texte envoyé au champ actif (cliquez-y d'abord avec le trackpad), Échap, Entrée, Espace, Tab…   |
| Pastille musique    | Lecture/pause ; un appui ailleurs ouvre le lecteur complet et les titres récents                |
| Roue dentée         | Réglages                                                                                        |

Les touches passent par Edge lui-même : elles fonctionnent même si Edge n'a pas le focus.
La souris et le volume passent par Windows (`SendInput`) : le serveur doit tourner dans la
session de l'utilisateur, pas comme service.

**Musique** : YouTube Music s'ouvre dans sa propre fenêtre. « Accueil » la met de côté sans
couper la lecture, et l'écran d'accueil affiche alors le titre en cours (pochette, titre,
artiste). Sur le téléphone, la pastille du bas ouvre le lecteur complet (précédent, lecture/pause,
suivant) et les titres écoutés récemment sur la TV, à relancer d'un appui. Lancer YouTube, Disney+ ou Prime Video met la musique en pause.

**Réglages** : ajout d'images (JPEG, PNG ou WebP ; elles sont réduites à 3840 px, converties
en WebP et débarrassées de leurs métadonnées, position GPS comprise), ordre, suppression,
délai de défilement, PIN permanent, sans redemander l'actuel (les autres téléphones sont
déconnectés), mise à jour de 11TV.

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

| Chemin               | Contenu                                         |
| -------------------- | ----------------------------------------------- |
| `settings.json`      | Réglages et empreinte du PIN                    |
| `sessions.json`      | Empreintes des jetons de session des téléphones |
| `music-history.json` | Titres écoutés récemment sur la TV              |
| `certs/`             | Autorité locale et certificat du serveur        |
| `wallpapers/`        | Fonds d'écran                                   |
| `thumbs/`            | Vignettes des fonds d'écran (régénérables)      |
| `edge-profile/`      | Profil Edge du kiosque (cookies des services)   |
| `logs/11tv.log`      | Journaux JSON                                   |

## Sécurité

- **PIN** haché avec scrypt ; 5 erreurs par adresse (20 au total) déclenchent un blocage dont
  la durée double, jusqu'à 15 minutes. Un téléphone déjà connecté peut le redéfinir sans
  l'actuel : sa session fait foi, et les autres téléphones sont déconnectés.
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
- [x] **Phase 3** : YouTube Music (dernière écoute, lancement, contrôles).
  - [x] Retour à l'accueil sans couper la musique (lecture dans une fenêtre réduite).
  - [x] Barre « En cours de lecture » sur la TV : pochette, titre, artiste.
- [x] **Phase 4** : démarrage automatique, redémarrage nocturne, robustesse.
