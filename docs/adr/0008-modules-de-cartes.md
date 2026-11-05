# 0008 – Modules de cartes pour les outils externes

**Statut** : accepté

## Contexte

L'écran d'accueil affiche des informations venues d'outils personnels (d'abord les Todos de
Me'Mories). D'autres suivront. Chaque outil a ses accès, son format de données et son
style : rien de tout cela ne doit se mélanger au reste de 11TV, ni d'un outil à l'autre.

## Décision

- **Un module par outil, dans son propre dossier**, de bout en bout :
  - serveur : `apps/server/src/cards/<module>/` (configuration, accès réseau, mise en forme) ;
  - données : une carte dans l'union `TvCard` (`packages/shared/src/cards.ts`) ;
  - TV : `apps/tv/src/cards/<module>/` (composant et feuille de style préfixée).
- **Un contrat étroit** (`CardModule`) : `start`, `stop`, `card()` et un évènement `change`.
  Le hub ne connaît que ce contrat. `PollingCardModule` couvre le cas courant d'une
  actualisation périodique.
- **Activé par sa configuration** : `%LOCALAPPDATA%\11TV\modules\<module>.json`, validée
  par le schéma du module. Fichier absent : module inactif. Fichier invalide : erreur dans
  le journal, le reste démarre normalement. Les identifiants ne sont jamais dans le dépôt.
- **Pannes contenues** : une actualisation qui échoue garde les dernières données, avec une
  mention discrète sur la carte. Rien chargé encore : pas de carte du tout.
- **Données personnelles réservées à la TV** : les cartes passent dans `TvState`, jamais
  dans l'état envoyé aux téléphones.
- **Emplacements nommés** (`left`, `right`) de part et d'autre de l'horloge. Chaque carte
  déclare le sien.

## Me'Mories

- **Compte dédié à la TV en lecture seule**, plutôt qu'un compte de service : un compte de
  service a tous les droits sur le projet, et sa clé sur la Surface serait un risque
  disproportionné. Le compte TV ne lit que les Todos et les tags d'un seul utilisateur.
  Son mot de passe, stocké dans le fichier de configuration du module, ne donne accès qu'à
  cette lecture.
- **Autorisation explicite** dans Firestore : `users/{uid}/readers/{uidTV}`, collection que
  seule la console Firebase peut écrire.
- **API REST** (Identity Toolkit, Firestore) plutôt que le SDK Firebase : deux requêtes
  simples, aucune dépendance, et le jeton reste en mémoire.
- **Actualisation toutes les 30 minutes** (réglable). La TV calcule elle-même « aujourd'hui
  » et « en retard » : les libellés changent à minuit sans attendre l'actualisation.
