import type { BrowserStatus } from '@11tv/shared';
import type { EventEmitter } from 'node:events';
import { UserFacingError } from '../errors';

/** Ce qui est devant sur la TV : l'onglet principal, ou la fenêtre de YouTube Music. */
export type Foreground = 'main' | 'music';

export interface BrowserEvents {
  status: [BrowserStatus];
  /** URL de l'onglet principal après chaque navigation (y compris interne au site). */
  navigated: [string];
  foreground: [Foreground];
}

/** Ce dont le reste du serveur a besoin du navigateur ; implémenté par EdgeBrowser. */
export interface BrowserController extends EventEmitter<BrowserEvents> {
  readonly status: BrowserStatus;
  readonly foreground: Foreground;
  /** Vrai si la fenêtre de YouTube Music existe (affichée ou réduite). */
  readonly hasMusic: boolean;
  start(): void;
  stop(): Promise<void>;
  /** Navigue l'onglet principal, ramené devant. */
  navigate(url: string): Promise<void>;
  /**
   * Affiche la fenêtre de YouTube Music, créée au besoin sur `url`. Avec `reload`, une
   * fenêtre existante navigue vers `url` ; sinon elle est simplement ramenée devant.
   */
  showMusic(url: string, reload: boolean): Promise<void>;
  /** Ramène l'onglet principal devant ; la musique continue dans sa fenêtre réduite. */
  showMain(): Promise<void>;
  /** Évalue une expression dans la page de YouTube Music ; `undefined` sans fenêtre. */
  evaluateInMusic(expression: string): Promise<unknown>;
  /** Page précédente de ce qui est devant. */
  goBack(): Promise<void>;
  /**
   * Touche envoyée par CDP à ce qui est devant (noms Playwright : « ArrowUp », « Shift+Tab »…).
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
