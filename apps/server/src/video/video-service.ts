import { getService, serviceForUrl, type ServiceId, type VideoNowPlaying } from '@11tv/shared';
import { EventEmitter } from 'node:events';
import type { BrowserController } from '../browser/browser-controller';
import { UserFacingError } from '../errors';
import type { Logger } from '../log';
import type { ArtworkProxy } from '../music/artwork';
import {
  VIDEO_PAUSE_SCRIPT,
  VIDEO_PLAY_PAUSE_SCRIPT,
  VIDEO_SNAPSHOT_SCRIPT,
  cleanDocumentTitle,
  videoSnapshotSchema,
} from './video-page';

const POLL_INTERVAL_MS = 1_000;
/** Écart toléré entre la position attendue et la position lue avant de rediffuser (saut). */
const SEEK_TOLERANCE_SEC = 2;

interface Current {
  service: ServiceId | null;
  title: string;
  artist: string;
  artwork: string | null;
  playing: boolean;
  position: number;
  duration: number;
  /** Instant de la mesure de `position`. */
  at: number;
}

export type VideoBrowser = Pick<BrowserController, 'hasVideo' | 'evaluateInVideo'>;

/**
 * Suit la lecture dans la fenêtre des services (interrogée chaque seconde, ce qui fonctionne
 * aussi fenêtre réduite) et la met en pause ou la relance. Fonctionne pour tout site qui lit
 * une vidéo : le titre vient de `navigator.mediaSession`, sinon du titre de la page. N'émet
 * `change` que si quelque chose de visible change ; les clients avancent la position.
 */
export class VideoService extends EventEmitter<{ change: [] }> {
  private current: Current | null = null;
  private timer: NodeJS.Timeout | null = null;
  private polling = false;

  constructor(
    private readonly browser: VideoBrowser,
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

  state(): VideoNowPlaying | null {
    const c = this.current;
    if (!c) return null;
    const elapsed = c.playing ? (this.now() - c.at) / 1000 : 0;
    const position = c.duration > 0 ? Math.min(c.position + elapsed, c.duration) : c.position;
    return {
      videoId: null,
      service: c.service,
      title: c.title,
      artist: c.artist,
      artworkUrl: this.artwork.register(c.artwork),
      playing: c.playing,
      positionSec: Math.round(position * 10) / 10,
      durationSec: Math.round(c.duration),
    };
  }

  async playPause(): Promise<void> {
    const found = this.browser.hasVideo
      ? await this.browser.evaluateInVideo(VIDEO_PLAY_PAUSE_SCRIPT)
      : false;
    if (found !== true) throw new UserFacingError('Aucune vidéo en cours');
    this.log.info('Lecture/pause de la vidéo');
    // Laisse le lecteur réagir, puis rafraîchit l'état sans attendre la prochaine seconde.
    setTimeout(() => void this.poll(), 300);
  }

  /** Met en pause sans erreur s'il n'y a rien à mettre en pause (avant la musique). */
  async pause(): Promise<void> {
    if (!this.browser.hasVideo || !this.playing) return;
    await this.browser.evaluateInVideo(VIDEO_PAUSE_SCRIPT).catch(() => undefined);
    await this.poll();
  }

  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const next = await this.read();
      if (next === 'unknown') return;
      const prev = this.current;
      this.current = next;
      if (hasVisibleChange(prev, next)) this.emit('change');
    } finally {
      this.polling = false;
    }
  }

  private async read(): Promise<Current | null | 'unknown'> {
    if (!this.browser.hasVideo) return null;
    let raw: unknown;
    try {
      raw = await this.browser.evaluateInVideo(VIDEO_SNAPSHOT_SCRIPT);
    } catch {
      // Page en cours de navigation : on garde l'état précédent.
      return 'unknown';
    }
    const parsed = videoSnapshotSchema.safeParse(raw);
    if (!parsed.success) return 'unknown';
    return toCurrent(parsed.data, this.now());
  }
}

/** Lecture décrite par la page, ou null s'il n'y a pas de média audible. */
export function toCurrent(
  s: {
    url: string;
    documentTitle: string;
    title: string;
    artist: string;
    artwork: string | null;
    hasMedia: boolean;
    playing: boolean;
    position: number;
    duration: number;
  },
  at: number,
): Current | null {
  if (!s.hasMedia) return null;
  const service = serviceForUrl(s.url);
  const serviceName = service ? getService(service).name : null;
  return {
    service,
    title: firstFilled(
      s.title,
      cleanDocumentTitle(s.documentTitle, serviceName),
      serviceName,
      'Vidéo',
    ),
    artist: firstFilled(s.artist, serviceName, hostOf(s.url)),
    artwork: s.artwork,
    playing: s.playing,
    position: s.position,
    duration: s.duration,
    at,
  };
}

/** Premier texte non vide (les sites laissent souvent la mediaSession vide). */
function firstFilled(...texts: (string | null)[]): string {
  for (const text of texts) {
    const trimmed = text?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function hasVisibleChange(prev: Current | null, next: Current | null): boolean {
  if (!prev || !next) return prev !== next;
  if (
    prev.service !== next.service ||
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
