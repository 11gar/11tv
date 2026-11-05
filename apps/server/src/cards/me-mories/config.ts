import { z } from 'zod';

/**
 * Configuration du module Me'Mories : fichier `modules/me-mories.json` du dossier de
 * données (sur la Surface : %LOCALAPPDATA%\11TV\modules\me-mories.json), jamais dans le
 * dépôt. La TV se connecte avec le compte Me'Mories dont elle affiche les Todos : soit par
 * e-mail et mot de passe, soit par un jeton de renouvellement (compte Google), voir
 * docs/modules/me-mories.md.
 */
export const meMoriesConfigSchema = z
  .object({
    /** Clé d'API web du projet Firebase (Paramètres du projet → Vos applications). */
    apiKey: z.string().min(1),
    projectId: z.string().regex(/^[a-z0-9-]+$/, 'identifiant de projet Firebase attendu'),
    /** Compte e-mail et mot de passe. */
    email: z.email().optional(),
    password: z.string().min(1).optional(),
    /** Ou, pour un compte Google : jeton de renouvellement copié depuis Me'Mories. */
    refreshToken: z.string().min(20).optional(),
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
  })
  .refine((c) => (c.email !== undefined && c.password !== undefined) || c.refreshToken, {
    message: 'indiquez « email » et « password », ou « refreshToken »',
  });

export type MeMoriesConfig = z.infer<typeof meMoriesConfigSchema>;
