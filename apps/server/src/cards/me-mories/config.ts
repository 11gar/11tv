import { z } from 'zod';

/**
 * Configuration du module Me'Mories : fichier `modules/me-mories.json` du dossier de
 * données (sur la Surface : %LOCALAPPDATA%\11TV\modules\me-mories.json), jamais dans le
 * dépôt. Le compte est un compte dédié à la TV, en lecture seule sur les Todos et les tags
 * du propriétaire (voir docs/modules/me-mories.md).
 */
export const meMoriesConfigSchema = z.object({
  /** Clé d'API web du projet Firebase (Paramètres du projet → Vos applications). */
  apiKey: z.string().min(1),
  projectId: z.string().regex(/^[a-z0-9-]+$/, 'identifiant de projet Firebase attendu'),
  /** UID du compte Me'Mories dont on affiche les Todos (Authentication → Utilisateurs). */
  ownerUid: z.string().regex(/^[A-Za-z0-9]{1,128}$/, 'UID Firebase attendu'),
  /** Compte de la TV, créé dans Firebase Authentication (e-mail et mot de passe). */
  email: z.email(),
  password: z.string().min(1),
  /**
   * À renseigner si la clé d'API est restreinte à des sites web (Google Cloud → Identifiants) :
   * l'adresse de Me'Mories, envoyée comme en-tête Referer.
   */
  referer: z.url().optional(),
  refreshMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .default(30),
});

export type MeMoriesConfig = z.infer<typeof meMoriesConfigSchema>;
