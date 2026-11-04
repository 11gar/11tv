# 0007 – Démarrage automatique et robustesse

**Statut** : accepté (phase 4)

## Décision

- **Ouverture de session automatique** du compte local de la TV avec **Autologon**
  (Sysinternals). Le mot de passe est saisi dans sa fenêtre et stocké chiffré comme secret
  LSA. Ni le script ni le dépôt ne le voient.
- **Tâche planifiée à l'ouverture de session**, dans la session de l'utilisateur et avec des
  droits ordinaires : la souris et le volume (`SendInput`) ne fonctionnent pas depuis un
  service ni vers une fenêtre plus privilégiée.
- **Lanceur PowerShell** (`run-11tv.ps1`) plutôt que de compter sur la tâche seule :
  - il relance le serveur après un plantage, avec un délai croissant s'il plante en boucle ;
  - il détecte un serveur bloqué (`/api/health` muet trois fois de suite) ;
  - il nettoie un serveur orphelin d'un lancement précédent.

  Le serveur, lui, s'arrête net sur une exception non gérée plutôt que de continuer dans un
  état inconnu. Edge, détaché, survit à ces relances.

- **Redémarrage nocturne** par une tâche SYSTEM, de 4 h à 6 h, toutes les 15 minutes :
  - il redémarre si la TV est inactive (`idle` de `/api/health`) ;
  - sinon il attend le passage suivant, avec une échéance à 5 h 45 ;
  - il installe au passage les mises à jour Windows en attente ;
  - les **heures d'utilisation** (8 h – 2 h) empêchent Windows de redémarrer de lui-même en
    journée.
- **Journaux** : rotation par taille (10 Mo, 5 fichiers) faite par le serveur lui-même, à
  l'ouverture et toutes les heures. Pas de dépendance supplémentaire.
- **Script de configuration relisible** (`setup-surface.ps1`) :
  - un mode `-DryRun` qui décrit chaque action sans rien appliquer ;
  - on peut le relancer sans risque ;
  - chaque réglage est commenté.

## Alternatives écartées

- **Service Windows** (NSSM, node-windows) : session 0, sans accès au bureau de l'utilisateur.
- **Clés `Winlogon` (AutoAdminLogon / DefaultPassword)** : mot de passe en clair dans le
  registre.
- **Redémarrage nocturne à heure fixe sans condition** : couperait un film ou la musique.
- **Stratégies de groupe Windows Update** : absentes de Windows Home ; les heures
  d'utilisation suffisent.
