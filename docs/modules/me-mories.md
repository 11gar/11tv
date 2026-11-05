# Module Me'Mories : Todos à venir

Carte affichée à gauche de l'écran d'accueil : les Todos ouverts et datés de votre compte
Me'Mories (« Aujourd'hui », retards compris, puis « À venir »), dans le style de
l'application. Liste actualisée toutes les 30 minutes.

La TV lit vos Todos avec **son propre compte**, en lecture seule : elle ne voit ni vos
Memories, ni votre profil, et ne peut rien modifier.

## 1. Firebase : le compte de la TV

Dans la [console Firebase](https://console.firebase.google.com), projet de Me'Mories :

1. **Authentication → Sign-in method** : vérifiez que **E-mail/Mot de passe** est activé.
2. **Authentication → Users → Ajouter un utilisateur** : une adresse dédiée (elle n'a pas à
   exister, par exemple `tv@me-mories.invalid`) et un mot de passe long et aléatoire.
3. Notez deux **UID** dans cette liste : celui du compte TV, et celui de **votre** compte
   Me'Mories.

## 2. Firestore : autoriser la lecture

1. **Déployez les règles** de Me'Mories, qui acceptent les lecteurs autorisés
   (`firestore.rules`, fonction `isReader`). Depuis le dossier de Me'Mories :
   ```bash
   npx firebase deploy --only firestore:rules
   ```
2. **Firestore Database → Données** : dans `users` → _votre UID_, ajoutez une collection
   `readers`, avec un document dont l'**identifiant est l'UID du compte TV** (aucun champ
   nécessaire). Pour retirer l'accès à la TV, supprimez ce document.

## 3. La Surface : le fichier de configuration

**Paramètres du projet → Général → Vos applications** : relevez la clé d'API (`apiKey`)
et l'identifiant du projet (`projectId`).

Dans la session de la TV, créez `%LOCALAPPDATA%\11TV\modules\me-mories.json` (le fichier
n'est jamais dans le dépôt) :

```json
{
  "apiKey": "AIza…",
  "projectId": "me-mories-xxxxx",
  "ownerUid": "UID de votre compte Me'Mories",
  "email": "tv@me-mories.invalid",
  "password": "mot de passe du compte TV"
}
```

Options :

| Clé              | Rôle                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `refreshMinutes` | Intervalle d'actualisation (30 par défaut, 5 au minimum)                                                            |
| `referer`        | Si la clé d'API est restreinte à des sites (Google Cloud → Identifiants) : l'adresse de Me'Mories, ex. `https://…/` |

Redémarrez ensuite 11TV (ou la Surface). Le journal (`%LOCALAPPDATA%\11TV\logs\11tv.log`)
indique « Module de carte activé », ou la raison d'un refus.

## En cas de problème

| Sur la carte ou dans le journal          | Cause probable                                                  |
| ---------------------------------------- | --------------------------------------------------------------- |
| Pas de carte, « Configuration invalide » | Clé manquante ou mal écrite dans `me-mories.json`               |
| « Identifiants Me'Mories refusés »       | E-mail ou mot de passe du compte TV                             |
| « Clé d'API Firebase refusée »           | `apiKey`, ou clé restreinte à des sites : renseignez `referer`  |
| « Accès refusé par Firestore »           | Règles non déployées, ou document `readers/<UID TV>` absent     |
| « Me'Mories injoignable : liste de … »   | Pas d'Internet : la carte garde la dernière liste et réessaiera |
