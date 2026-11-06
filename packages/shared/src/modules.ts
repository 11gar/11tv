/** Modules activables depuis le téléphone (Réglages → Modules). */

export const POSTITS_MODULE_ID = 'post-its';
export const MODULE_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
export const MODULE_OPTION_KEY_PATTERN = /^[a-zA-Z0-9]{1,40}$/;

/** Valeurs d'options d'un module, par clé. */
export type ModuleOptionValues = Record<string, number>;

/**
 * Option d'un module, à choisir dans une liste (Réglages → Modules → roue crantée). Chaque
 * module déclare les siennes ; le serveur refuse toute valeur hors de la liste.
 */
export interface ModuleOption {
  key: string;
  label: string;
  /** Phrase d'aide sous l'option. */
  help?: string;
  choices: { value: number; label: string }[];
  value: number;
}

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
  /** Options réglables ; vide si le module n'en a pas (pas de roue crantée). */
  options: ModuleOption[];
}
