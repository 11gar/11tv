import {
  getService,
  serviceForUrl,
  type AppState,
  type ClientMessage,
  type PairingInfo,
  type ServerMessage,
  type TvState,
  type View,
  type Wallpaper,
} from '@11tv/shared';
import type { BrowserController } from '../browser/browser-controller';
import type { Logger } from '../log';

export type ClientRole = 'tv' | 'remote';

export interface HubClient {
  role: ClientRole;
  send(message: ServerMessage | ServerMessage<TvState>): void;
}

export interface HubSources {
  browser: BrowserController;
  homeUrl: string;
  slideIntervalSec: () => number;
  wallpapers: () => Wallpaper[];
  pairing: () => PairingInfo | null;
}

/** Ce qu'affiche l'onglet principal, d'après son URL. */
export function viewForUrl(url: string, homeUrl: string): View {
  if (url.startsWith(homeUrl)) return 'home';
  return serviceForUrl(url) ?? 'other';
}

/**
 * Point central : reçoit les commandes des clients, pilote le navigateur et pousse l'état
 * complet à chaque changement. La TV reçoit une vue enrichie (fonds d'écran, appairage) que
 * le téléphone ne voit pas.
 */
export class StateHub {
  private readonly clients = new Set<HubClient>();
  private view: View = 'home';

  constructor(
    private readonly sources: HubSources,
    private readonly log: Logger,
  ) {
    sources.browser.on('status', () => {
      this.broadcast();
    });
    sources.browser.on('navigated', (url) => {
      const view = viewForUrl(url, sources.homeUrl);
      if (view === this.view) return;
      this.view = view;
      this.log.debug({ view, url }, 'Vue changée');
      this.broadcast();
    });
  }

  addClient(client: HubClient): () => void {
    this.clients.add(client);
    this.sendState(client);
    return () => this.clients.delete(client);
  }

  get remoteCount(): number {
    return [...this.clients].filter((c) => c.role === 'remote').length;
  }

  async handle(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'launch': {
        const service = getService(message.service);
        this.log.info({ service: service.id }, 'Lancement d’un service');
        await this.sources.browser.navigate(service.url);
        return;
      }
      case 'home':
        this.log.info('Retour à l’accueil');
        await this.sources.browser.navigate(this.sources.homeUrl);
        return;
    }
  }

  /** À appeler quand une source externe change (réglages, fonds d'écran, appairage). */
  broadcast(): void {
    for (const client of this.clients) this.sendState(client);
  }

  private appState(): AppState {
    return {
      view: this.view,
      browser: this.sources.browser.status,
      slideIntervalSec: this.sources.slideIntervalSec(),
    };
  }

  private sendState(client: HubClient): void {
    const state = this.appState();
    if (client.role === 'tv') {
      client.send({
        type: 'state',
        state: { ...state, wallpapers: this.sources.wallpapers(), pairing: this.sources.pairing() },
      });
    } else {
      client.send({ type: 'state', state });
    }
  }
}
