# Module Me'Mories : Todos du jour

Carte affichée à gauche de l'écran d'accueil : les Todos ouverts de votre compte Me'Mories,
« Aujourd'hui » (retards compris) puis « Sans date », dans le style de l'application. Les
Todos à venir n'y figurent pas. Liste actualisée toutes les 30 minutes ; ceux de demain
apparaissent dès minuit.

La TV se connecte **avec votre compte Me'Mories**. Le module ne fait que lire vos Todos et
vos tags ; il n'écrit jamais rien.

Tout se règle dans un fichier de la Surface, `%LOCALAPPDATA%\11TV\modules\me-mories.json`,
jamais dans le dépôt.

## 1. La clé d'API et l'identifiant du projet

[Console Firebase](https://console.firebase.google.com), projet de Me'Mories : roue dentée →
**Paramètres du projet** → **Général** → **Vos applications** → l'application web →
**Configuration du SDK** → **Config**. Relevez `apiKey` et `projectId`.

Ce sont aussi `VITE_FIREBASE_API_KEY` et `VITE_FIREBASE_PROJECT_ID` du fichier
`.env.local` de Me'Mories.

## 2. Comment la TV se connecte

### Vous vous connectez à Me'Mories par e-mail et mot de passe

Utilisez les mêmes dans le fichier (étape 3) : `email` et `password`.

### Vous vous connectez avec Google

La TV ne peut pas ouvrir la fenêtre de connexion Google. Elle reprend à la place le **jeton
de renouvellement** d'une session Me'Mories déjà ouverte :

1. Ouvrez Me'Mories dans Edge ou Chrome, connecté à votre compte.
2. Ouvrez les outils de développement (**F12**), onglet **Console**.
3. Collez ceci puis validez (Edge peut demander de taper d'abord `allow pasting`) :
   ```js
   const db = await new Promise((ok) => {
     const r = indexedDB.open('firebaseLocalStorageDb');
     r.onsuccess = () => ok(r.result);
   });
   const rows = await new Promise((ok) => {
     const r = db.transaction('firebaseLocalStorage').objectStore('firebaseLocalStorage').getAll();
     r.onsuccess = () => ok(r.result);
   });
   rows.find((row) => row.value?.stsTokenManager)?.value.stsTokenManager.refreshToken;
   ```
   La console affiche le jeton, une longue chaîne entre guillemets (souvent `AMf-…`) :
   clic droit → **Copier la chaîne**, puis collez-le comme `refreshToken` à l'étape 3. Un
   résultat `undefined` signifie que la page n'est pas connectée à Me'Mories.

Le jeton reste valable tant que vous ne changez pas votre mot de passe Google et que vous ne
révoquez pas les sessions. Se déconnecter de Me'Mories dans le navigateur ne l'invalide pas.
S'il expire, la carte garde sa dernière liste et le journal indique « Jeton Me'Mories
expiré » : recopiez-en un.

## 3. Le fichier de configuration

Dans la session de la TV, dans PowerShell :

```bash
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\11TV\modules"
```

```bash
notepad "$env:LOCALAPPDATA\11TV\modules\me-mories.json"
```

Collez l'un des deux contenus, avec vos valeurs, puis enregistrez.

Compte e-mail :

```json
{
  "apiKey": "AIza…",
  "projectId": "me-mories-xxxxx",
  "email": "vous@exemple.fr",
  "password": "votre mot de passe Me'Mories"
}
```

Compte Google :

```json
{
  "apiKey": "AIza…",
  "projectId": "me-mories-xxxxx",
  "refreshToken": "AMf-vB…"
}
```

Options :

| Clé              | Rôle                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `refreshMinutes` | Intervalle d'actualisation (30 par défaut, 5 au minimum)                                                            |
| `referer`        | Si la clé d'API est restreinte à des sites (Google Cloud → Identifiants) : l'adresse de Me'Mories, ex. `https://…/` |

Le fichier est dans votre profil Windows, lisible par le seul compte de la TV. Il donne
accès à votre compte Me'Mories : ne le copiez pas ailleurs.

## 4. Redémarrer 11TV

Redémarrez la Surface, ou arrêtez le serveur (le lanceur le relance aussitôt) :

```bash
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*apps\server\dist\index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

La carte apparaît quelques secondes plus tard. Sinon :

```bash
Select-String -Path "$env:LOCALAPPDATA\11TV\logs\11tv.log" -Pattern "carte|Firebase|Firestore|Me.Mories" | Select-Object -Last 5
```

| Dans le journal ou sur la carte        | Cause probable                                                  |
| -------------------------------------- | --------------------------------------------------------------- |
| « Configuration du module invalide »   | Clé manquante, virgule ou guillemet mal placé dans le fichier   |
| « Identifiants Me'Mories refusés »     | E-mail ou mot de passe                                          |
| « Jeton Me'Mories expiré ou révoqué »  | Compte Google : recopiez un jeton (étape 2)                     |
| « Clé d'API Firebase refusée »         | `apiKey`, ou clé restreinte à des sites : renseignez `referer`  |
| « Me'Mories injoignable : liste de … » | Pas d'Internet : la carte garde la dernière liste et réessaiera |
