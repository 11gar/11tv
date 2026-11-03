# 0002 – HTTPS local par autorité de certification à contraintes de nom

**Statut** : accepté (phase 1)

## Contexte

Une PWA installable avec service worker exige HTTPS. La Surface n'a pas d'IP fixe (pas
d'accès à la configuration de la box).

## Décision

Le serveur crée une autorité locale (ECDSA P-256, 10 ans) avec une extension
**NameConstraints critique** : `localhost`, `*.local`, `10/8`, `172.16/12`, `192.168/16`,
`127/8`. Il émet un certificat serveur (397 jours) pour ses adresses actuelles et
`<nom-du-pc>.local`, réémis automatiquement si une adresse change ou à l'approche de l'échéance.

Le certificat public de l'autorité est servi en HTTP (port 8081) pour l'installation sur le
téléphone ; son empreinte est affichée sur la TV pour vérification.

## Alternatives écartées

- **mkcert** : autorité sans contraintes. Sa clé, présente sur la Surface, permettrait
  d'intercepter tout le trafic HTTPS du téléphone.
- **Certificat public (Let's Encrypt, Tailscale)** : nécessite un domaine ou un service
  externe, contraire à « rien sur Internet ».
- **Drapeau Chrome `unsafely-treat-insecure-origin-as-secure`** : fragile, à refaire à chaque
  mise à jour, désactive des protections.

## Conséquences

- La clé de l'autorité reste sur la Surface (nécessaire pour suivre l'IP) ; les contraintes
  limitent les dégâts en cas de fuite.
- Sans IP fixe, un changement d'adresse change l'origine de la PWA : il faut la rouvrir et la
  réinstaller. Une réservation DHCP supprimerait ce problème.
- L'extension DER est encodée à la main (`tls/der.ts`) car `@peculiar/x509` ne gère pas les
  plages IP ; un test la relit avec un décodeur ASN.1 indépendant.
