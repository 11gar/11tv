import type { BrowserStatus } from '@11tv/shared';
import type { EventEmitter } from 'node:events';

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
}

export class BrowserUnavailableError extends Error {
  constructor() {
    super('Le navigateur n’est pas disponible');
    this.name = 'BrowserUnavailableError';
  }
}
