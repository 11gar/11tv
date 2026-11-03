import type { BrowserStatus } from '@11tv/shared';
import type { EventEmitter } from 'node:events';
import { UserFacingError } from '../errors';

export interface BrowserEvents {
  status: [BrowserStatus];
  /** URL de l'onglet principal après chaque navigation (y compris interne au site). */
  navigated: [string];
}

/** Ce dont le reste du serveur a besoin du navigateur ; implémenté par EdgeBrowser. */
export interface BrowserController extends EventEmitter<BrowserEvents> {
  readonly status: BrowserStatus;
  start(): void;
  stop(): Promise<void>;
  navigate(url: string): Promise<void>;
  goBack(): Promise<void>;
  /**
   * Touche envoyée à la page par CDP (noms Playwright : « ArrowUp », « Shift+Tab »…).
   * Elle arrive même si Edge n'a pas le focus Windows.
   */
  pressKey(key: string): Promise<void>;
  /** Texte inséré dans le champ actif, comme une saisie clavier. */
  insertText(text: string): Promise<void>;
}

export class BrowserUnavailableError extends UserFacingError {
  constructor() {
    super('Le navigateur n’est pas disponible');
    this.name = 'BrowserUnavailableError';
  }
}
