import {
  getService,
  musicTrackUrl,
  POSTITS_MODULE_ID,
  serviceForUrl,
  type AppState,
  type BrowserStatus,
  type ClientMessage,
  type PairingInfo,
  type ServerMessage,
  type TvCard,
  type TvState,
  type View,
  type Wallpaper,
} from '@11tv/shared';
import type { BrowserController } from '../browser/browser-controller';
import { UserFacingError } from '../errors';
import type { RemoteControl } from '../input/remote-control';
import type { Logger } from '../log';
import type { MusicService } from '../music/music-service';
import type { ModuleManager } from '../modules/module-manager';
import type { PostItBoard } from '../postits/board';

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

export type HubMusic = Pick<MusicService, 'state' | 'control' | 'pause' | 'playing'>;

export type HubPostIts = Pick<PostItBoard, 'list' | 'add' | 'remove' | 'clear'>;

export type HubModules = Pick<ModuleManager, 'list' | 'setEnabled' | 'isActive'>;

export interface HubDeps {
  browser: BrowserController;
  music: HubMusic;
  remote: Pick<
    RemoteControl,
    'pointerAvailable' | 'key' | 'text' | 'back' | 'move' | 'click' | 'scroll' | 'volume'
  >;
  settings: HubSettings;
  wallpapers: HubWallpapers;
  postIts: HubPostIts;
  modules: HubModules;
  homeUrl: string;
  pairing: () => PairingInfo | null;
  /** Cartes des modules externes, réservées à la TV. */
  cards: () => TvCard[];
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
  /** Ce qu'affiche l'onglet principal (la fenêtre de musique peut être devant). */
  private mainView: View = 'home';

  constructor(
    private readonly deps: HubDeps,
    private readonly log: Logger,
  ) {
    deps.browser.on('status', () => {
      this.broadcast();
    });
    deps.browser.on('foreground', () => {
      this.broadcast();
    });
    deps.browser.on('navigated', (url) => {
      const view = viewForUrl(url, deps.homeUrl);
      if (view === this.mainView) return;
      this.mainView = view;
      this.log.debug({ view, url }, 'Vue changée');
      this.broadcast();
    });
  }

  private get view(): View {
    return this.deps.browser.foreground === 'music' ? 'youtube-music' : this.mainView;
  }

  addClient(client: HubClient): () => void {
    this.clients.add(client);
    this.sendState(client);
    return () => this.clients.delete(client);
  }

  get remoteCount(): number {
    return [...this.clients].filter((c) => c.role === 'remote').length;
  }

  /** Résumé pour les scripts locaux : la TV est-elle en train de servir à quelque chose ? */
  health(): { browser: BrowserStatus; view: View; musicPlaying: boolean; idle: boolean } {
    const musicPlaying = this.deps.music.playing;
    const view = this.view;
    return {
      browser: this.deps.browser.status,
      view,
      musicPlaying,
      idle: view === 'home' && !musicPlaying,
    };
  }

  async handle(message: ClientMessage): Promise<void> {
    const { browser, music, remote, settings, wallpapers } = this.deps;
    switch (message.type) {
      case 'launch': {
        const service = getService(message.service);
        this.log.info({ service: service.id }, 'Lancement d’un service');
        if (service.id === 'youtube-music') return this.openMusic(service.url, false);
        // Pas deux sons à la fois : la musique se met en pause quand on lance une vidéo.
        await music.pause();
        return browser.navigate(service.url);
      }
      case 'home':
        this.log.info('Retour à l’accueil');
        // La musique continue : seule sa fenêtre est réduite.
        if (this.mainView === 'home') return browser.showMain();
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

      case 'music':
        return music.control(message.action);
      case 'play-track':
        this.log.info({ videoId: message.videoId }, 'Lecture d’un titre');
        return this.openMusic(musicTrackUrl(message.videoId, message.playlistId), true);

      case 'add-postit':
        if (!this.deps.modules.isActive(POSTITS_MODULE_ID)) {
          throw new UserFacingError('Les post-it sont éteints (Réglages → Modules)');
        }
        this.log.info({ color: message.color }, 'Post-it collé');
        await this.deps.postIts.add(message.text, message.color);
        return;
      case 'remove-postit':
        return this.deps.postIts.remove(message.id);
      case 'clear-postits':
        return this.deps.postIts.clear();

      case 'set-module-enabled':
        return this.deps.modules.setEnabled(message.id, message.enabled);
      case 'set-slide-interval':
        return settings.setSlideInterval(message.seconds);
      case 'delete-wallpaper':
        if (!wallpapers.has(message.id)) throw new UserFacingError('Ce fond d’écran n’existe plus');
        return wallpapers.remove(message.id);
      case 'reorder-wallpapers':
        return wallpapers.reorder(message.order);
    }
  }

  /**
   * Affiche YouTube Music. L'onglet principal revient d'abord à l'accueil : une vidéo qui y
   * jouait s'arrête, et c'est l'accueil qu'on retrouvera en réduisant la musique.
   */
  private async openMusic(url: string, reload: boolean): Promise<void> {
    if (this.mainView !== 'home') await this.deps.browser.navigate(this.deps.homeUrl);
    await this.deps.browser.showMusic(url, reload);
  }

  /** À appeler quand une source externe change (réglages, fonds d'écran, appairage, musique). */
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
      music: this.deps.music.state(),
      // Éteints, les post-it restent dans postits.json mais ne s'affichent plus.
      postIts: this.deps.modules.isActive(POSTITS_MODULE_ID) ? this.deps.postIts.list() : [],
      modules: this.deps.modules.list(),
    };
  }

  private sendState(client: HubClient): void {
    const state = this.appState();
    if (client.role === 'tv') {
      client.send({
        type: 'state',
        state: { ...state, pairing: this.deps.pairing(), cards: this.deps.cards() },
      });
    } else {
      client.send({ type: 'state', state });
    }
  }
}
