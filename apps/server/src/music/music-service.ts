import {
  PLAYLIST_ID_PATTERN,
  VIDEO_ID_PATTERN,
  type MusicAction,
  type MusicState,
  type NowPlaying,
} from '@11tv/shared';
import { EventEmitter } from 'node:events';
import type { BrowserController } from '../browser/browser-controller';
import { UserFacingError } from '../errors';
import type { Logger } from '../log';
import type { ArtworkProxy } from './artwork';
import type { MusicHistory } from './history';
import {
  CONTROL_SCRIPTS,
  PAUSE_SCRIPT,
  SNAPSHOT_SCRIPT,
  idsFromUrl,
  snapshotSchema,
} from './youtube-music-page';

const POLL_INTERVAL_MS = 1_000;
/** Un titre entre dans l'historique après ce temps d'écoute. */
const RECORD_AFTER_SEC = 10;
/** Écart toléré entre la position attendue et la position lue avant de rediffuser (saut). */
const SEEK_TOLERANCE_SEC = 2;

interface Current {
  videoId: string | null;
  playlistId: string | null;
  title: string;
  artist: string;
  artwork: string | null;
  playing: boolean;
  position: number;
  duration: number;
  /** Instant de la mesure de `position`. */
  at: number;
}

export type MusicBrowser = Pick<BrowserController, 'hasMusic' | 'evaluateInMusic'>;

/**
 * Suit la lecture dans la fenêtre YouTube Music (interrogée chaque seconde, ce qui fonctionne
 * aussi fenêtre réduite), la pilote, et tient l'historique des titres écoutés sur la TV.
 * N'émet `change` que si quelque chose de visible change : les clients avancent eux-mêmes
 * la position pendant la lecture.
 */
export class MusicService extends EventEmitter<{ change: [] }> {
  private current: Current | null = null;
  private recordedVideoId: string | null = null;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    private readonly browser: MusicBrowser,
    private readonly history: MusicHistory,
    private readonly artwork: ArtworkProxy,
    private readonly log: Logger,
    private readonly now: () => number = Date.now,
  ) {
    super();
  }

  start(): void {
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get playing(): boolean {
    return this.current?.playing ?? false;
  }

  state(): MusicState {
    return {
      nowPlaying: this.nowPlaying(),
      recent: this.history.list().map((t) => ({
        videoId: t.videoId,
        playlistId: t.playlistId,
        title: t.title,
        artist: t.artist,
        artworkUrl: this.artwork.register(t.artwork),
      })),
    };
  }

  async control(action: MusicAction): Promise<void> {
    if (!this.browser.hasMusic) throw new UserFacingError('YouTube Music n’est pas ouvert');
    const found = await this.browser.evaluateInMusic(CONTROL_SCRIPTS[action]);
    if (found !== true) throw new UserFacingError('Le lecteur de YouTube Music ne répond pas');
    this.log.info({ action }, 'Commande musique');
    // Laisse le lecteur réagir, puis rafraîchit l'état sans attendre la prochaine seconde.
    setTimeout(() => void this.poll(), 300);
  }

  /** Met en pause sans erreur s'il n'y a rien à mettre en pause (avant un autre service). */
  async pause(): Promise<void> {
    if (!this.browser.hasMusic || !this.playing) return;
    await this.browser.evaluateInMusic(PAUSE_SCRIPT).catch(() => undefined);
    await this.poll();
  }

  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      this.update(await this.read());
      await this.maybeRecord();
    } finally {
      this.polling = false;
    }
  }

  private async read(): Promise<Current | null | 'unknown'> {
    if (!this.browser.hasMusic) return null;
    let raw: unknown;
    try {
      raw = await this.browser.evaluateInMusic(SNAPSHOT_SCRIPT);
    } catch {
      // Page en cours de navigation : on garde l'état précédent.
      return 'unknown';
    }
    const parsed = snapshotSchema.safeParse(raw);
    if (!parsed.success) return 'unknown';
    const s = parsed.data;
    if (!s.title) return null;
    const ids = idsFromUrl(s.url);
    return {
      videoId: ids.videoId && VIDEO_ID_PATTERN.test(ids.videoId) ? ids.videoId : null,
      playlistId:
        ids.playlistId && PLAYLIST_ID_PATTERN.test(ids.playlistId) ? ids.playlistId : null,
      title: s.title,
      artist: s.artist,
      artwork: s.artwork,
      playing: s.playing,
      position: s.position,
      duration: s.duration,
      at: this.now(),
    };
  }

  private update(next: Current | null | 'unknown'): void {
    if (next === 'unknown') return;
    const prev = this.current;
    this.current = next;
    if (hasVisibleChange(prev, next)) this.emit('change');
  }

  private async maybeRecord(): Promise<void> {
    const c = this.current;
    if (!c?.videoId || !c.playing || c.position < RECORD_AFTER_SEC) return;
    if (this.recordedVideoId === c.videoId) return;
    this.recordedVideoId = c.videoId;
    await this.history.record({
      videoId: c.videoId,
      playlistId: c.playlistId,
      title: c.title,
      artist: c.artist,
      artwork: c.artwork,
      playedAt: this.now(),
    });
    this.artwork.retain([c.artwork, ...this.history.list().map((t) => t.artwork)]);
    this.emit('change');
  }

  private nowPlaying(): NowPlaying | null {
    const c = this.current;
    if (!c) return null;
    const elapsed = c.playing ? (this.now() - c.at) / 1000 : 0;
    const position = c.duration > 0 ? Math.min(c.position + elapsed, c.duration) : c.position;
    return {
      videoId: c.videoId,
      title: c.title,
      artist: c.artist,
      artworkUrl: this.artwork.register(c.artwork),
      playing: c.playing,
      positionSec: Math.round(position * 10) / 10,
      durationSec: Math.round(c.duration),
    };
  }
}

export function hasVisibleChange(prev: Current | null, next: Current | null): boolean {
  if (!prev || !next) return prev !== next;
  if (
    prev.videoId !== next.videoId ||
    prev.title !== next.title ||
    prev.artist !== next.artist ||
    prev.artwork !== next.artwork ||
    prev.playing !== next.playing ||
    Math.round(prev.duration) !== Math.round(next.duration)
  ) {
    return true;
  }
  const expected = prev.position + (prev.playing ? (next.at - prev.at) / 1000 : 0);
  return Math.abs(next.position - expected) > SEEK_TOLERANCE_SEC;
}
