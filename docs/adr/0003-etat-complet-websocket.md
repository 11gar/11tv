# 0003 – État complet poussé par WebSocket

**Statut** : accepté (phase 1)

## Décision

- Un WebSocket natif (`@fastify/websocket`) par client. Messages client validés par zod
  (`@11tv/shared/schemas`), messages serveur typés.
- Le serveur pousse **l'état complet** à chaque changement plutôt que des différences : il
  tient en quelques centaines d'octets, et un client qui se reconnecte est resynchronisé
  sans logique particulière.
- La TV reçoit une vue enrichie (`TvState` : fonds d'écran, appairage) que le téléphone ne
  reçoit jamais.
- Détection des connexions mortes dans les deux sens : ping de protocole (serveur) et message
  `heartbeat` toutes les 15 s (client, qui coupe après 40 s de silence).

## Alternatives écartées

- **Socket.IO** : protocole et dépendance en plus pour des fonctions (salles, repli HTTP)
  inutiles ici.
- **SSE + POST** : suffisant pour la phase 1, mais le trackpad (phase 2) demande un canal
  bidirectionnel à faible latence.

## Conséquences

Quand l'état grossira (phase 3 : lecture en cours), les messages à haute fréquence
(position de lecture) pourront passer par un type de message dédié, sans changer le principe.
