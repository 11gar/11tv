/** Modules activables depuis le téléphone (Réglages → Modules). */

export const POSTITS_MODULE_ID = 'post-its';
export const MODULE_ID_PATTERN = /^[a-z0-9-]{1,40}$/;

export interface ModuleInfo {
  id: string;
  name: string;
  description: string;
  /** Activé dans les réglages (par défaut : oui). */
  enabled: boolean;
  /** Faux si le module attend sa configuration sur la Surface (identifiants…). */
  configured: boolean;
  /** Pourquoi le module ne peut pas fonctionner, à afficher sous son nom ; null s'il va bien. */
  problem: string | null;
}
