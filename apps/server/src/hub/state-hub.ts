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
import { UserFacingError } from '../errors';
import type { RemoteControl } from '../input/remote-control';
import type { Logger } from '../log';

export type ClientRole = 'tv' | 'remote';

export interface HubClient {
  role: ClientRole;
  send(message: ServerMessage | ServerMessage<TvState>): void;
}

/** Ce que le hub utilise des réglages et des fonds d'écran (interfaces étroites, testables). */
export interface HubSettings {
  slideIntervalSec(): number;
  setSlideInterval(seconds: number): Promise<void>;
}

export interface HubWallpapers {
  list(): Wallpaper[];
  has(id: string): boolean;
  remove(id: string): Promise<void>;
  reorder(order: readonly string[]): Promise<void>;
}

export interface HubDeps {
  browser: BrowserController;
  remote: Pick<
    RemoteControl,
    'pointerAvailable' | 'key' | 'text' | 'back' | 'move' | 'click' | 'scroll' | 'volume'
  >;
  settings: HubSettings;
  wallpapers: HubWallpapers;
  homeUrl: string;
  pairing: () => PairingInfo | null;
}

/** Ce qu'affiche l'onglet principal, d'après son URL. */
export function viewForUrl(url: string, homeUrl: string): View {
  if (url.startsWith(homeUrl)) return 'home';
  return serviceForUrl(url) ?? 'other';
}

/**
 * Point central : reçoit les commandes des clients, les transmet au navigateur, à la
 * télécommande ou aux réglages, et pousse l'état complet à chaque changement. La TV reçoit
 * en plus les informations d'appairage, que le téléphone ne voit jamais.
 */
export class StateHub {
  private readonly clients = new Set<HubClient>();
  private view: View = 'home';

  constructor(
    private readonly deps: HubDeps,
    private readonly log: Logger,
  ) {
    deps.browser.on('status', () => {
      this.broadcast();
    });
    deps.browser.on('navigated', (url) => {
      const view = viewForUrl(url, deps.homeUrl);
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
    const { browser, remote, settings, wallpapers } = this.deps;
    switch (message.type) {
      case 'launch': {
        const service = getService(message.service);
        this.log.info({ service: service.id }, 'Lancement d’un service');
        return browser.navigate(service.url);
      }
      case 'home':
        this.log.info('Retour à l’accueil');
        return browser.navigate(this.deps.homeUrl);
      case 'history-back':
        return remote.back();

      case 'key':
        return remote.key(message.key);
      case 'text':
        return remote.text(message.text, message.submit);
      case 'pointer-move':
        remote.move(message.dx, message.dy);
        return;
      case 'pointer-click':
        remote.click(message.button);
        return;
      case 'pointer-scroll':
        remote.scroll(message.dy);
        return;
      case 'volume':
        remote.volume(message.action);
        return;

      case 'set-slide-interval':
        return settings.setSlideInterval(message.seconds);
      case 'delete-wallpaper':
        if (!wallpapers.has(message.id)) throw new UserFacingError('Ce fond d’écran n’existe plus');
        return wallpapers.remove(message.id);
      case 'reorder-wallpapers':
        return wallpapers.reorder(message.order);
    }
  }

  /** À appeler quand une source externe change (réglages, fonds d'écran, appairage). */
  broadcast(): void {
    for (const client of this.clients) this.sendState(client);
  }

  private appState(): AppState {
    return {
      view: this.view,
      browser: this.deps.browser.status,
      slideIntervalSec: this.deps.settings.slideIntervalSec(),
      wallpapers: this.deps.wallpapers.list(),
      pointerAvailable: this.deps.remote.pointerAvailable,
    };
  }

  private sendState(client: HubClient): void {
    const state = this.appState();
    if (client.role === 'tv') {
      client.send({ type: 'state', state: { ...state, pairing: this.deps.pairing() } });
    } else {
      client.send({ type: 'state', state });
    }
  }
}
