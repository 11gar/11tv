# 0004 – Monorepo pnpm, serveur regroupé par esbuild

**Statut** : accepté (phase 1)

## Décision

- Workspace pnpm : `apps/*` (server, tv, mobile) et `packages/*` (shared, web).
- Les paquets internes exposent directement leurs sources TypeScript : pas d'étape de build
  intermédiaire. Vite, Vitest et tsx les compilent à la volée.
- Le serveur est regroupé par esbuild (`apps/server/build.mjs`) : les paquets `@11tv/*` sont
  inclus dans le bundle, les dépendances npm restent dans `node_modules`.
- `@11tv/shared` ne dépend de rien ; les schémas zod sont dans le sous-chemin
  `@11tv/shared/schemas`, importé par le serveur seulement (les bundles web passent de 104 à
  20 ko).
- Interfaces en Preact + Vite ; PWA par `vite-plugin-pwa` (Workbox, `generateSW`).

## Qualité

`pnpm check` : `tsc` strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`…), ESLint
`strictTypeChecked`, Prettier, Vitest. Le code spécifique à Windows est derrière des
interfaces (`BrowserController`, et `InputDriver` en phase 2) pour être testé avec des doublures.
