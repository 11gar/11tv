import type { BrowserStatus } from '@11tv/shared';
import type { EventEmitter } from 'node:events';
import { UserFacingError } from '../errors';

/**
 * Ce qui est devant sur la TV : l'onglet principal (l'accueil), la fenêtre des services
 * (YouTube, Twitch, Disney+…) ou celle de YouTube Music.
 */
export type Foreground = 'main' | 'video' | 'music';

/** Onglet qui a navigué : l'accueil ou la fenêtre des services. */
export type NavigationTarget = 'main' | 'video';

export interface BrowserEvents {
  status: [BrowserStatus];
  /** URL après chaque navigation (y compris interne au site), et l'onglet concerné. */
  navigated: [string, NavigationTarget];
  foreground: [Foreground];
}

/** Ce dont le reste du serveur a besoin du navigateur ; implémenté par EdgeBrowser. */
export interface BrowserController extends EventEmitter<BrowserEvents> {
  readonly status: BrowserStatus;
  readonly foreground: Foreground;
  /** Vrai si la fenêtre de YouTube Music existe (affichée ou réduite). */
  readonly hasMusic: boolean;
  /** Vrai si la fenêtre des services existe (affichée ou réduite). */
  readonly hasVideo: boolean;
  start(): void;
  stop(): Promise<void>;
  /** Navigue l'onglet principal (l'accueil), ramené devant. */
  navigate(url: string): Promise<void>;
  /**
   * Ouvre `url` dans la fenêtre des services, créée au besoin, et l'affiche en plein écran.
   * Revenir à l'accueil la réduit sans couper la lecture.
   */
  openVideo(url: string): Promise<void>;
  /** Ramène devant la fenêtre des services, telle qu'on l'a laissée. */
  showVideo(): Promise<void>;
  /**
   * Affiche la fenêtre de YouTube Music, créée au besoin sur `url`. Avec `reload`, une
   * fenêtre existante navigue vers `url` ; sinon elle est simplement ramenée devant.
   */
  showMusic(url: string, reload: boolean): Promise<void>;
  /** Ramène l'accueil devant ; musique et vidéo continuent dans leurs fenêtres réduites. */
  showMain(): Promise<void>;
  /** Évalue une expression dans la page de YouTube Music ; `undefined` sans fenêtre. */
  evaluateInMusic(expression: string): Promise<unknown>;
  /** Évalue une expression dans la fenêtre des services ; `undefined` sans fenêtre. */
  evaluateInVideo(expression: string): Promise<unknown>;
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
