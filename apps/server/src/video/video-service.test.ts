import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { ArtworkProxy } from '../music/artwork';
import { cleanDocumentTitle, type VideoSnapshot } from './video-page';
import { VideoService, toCurrent } from './video-service';

const silentLogger = pino({ level: 'silent' });

const snapshot = (overrides: Partial<VideoSnapshot> = {}): VideoSnapshot => ({
  url: 'https://www.youtube.com/watch?v=abc',
  documentTitle: '(3) Un clip - YouTube',
  title: 'Un clip',
  artist: 'Une chaîne',
  artwork: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
  hasMedia: true,
  playing: true,
  position: 12,
  duration: 200,
  ...overrides,
});

class FakePage {
  hasVideo = true;
  next: unknown = snapshot();
  readonly scripts: string[] = [];
  evaluateInVideo(script: string): Promise<unknown> {
    this.scripts.push(script);
    return Promise.resolve(script.includes('documentTitle') ? this.next : true);
  }
}

describe('cleanDocumentTitle', () => {
  it('retire le compteur de notifications et le nom du site', () => {
    expect(cleanDocumentTitle('(3) Un clip - YouTube', 'YouTube')).toBe('Un clip');
    expect(cleanDocumentTitle('zerator - Twitch', 'Twitch')).toBe('zerator');
    expect(cleanDocumentTitle('Une page', null)).toBe('Une page');
  });
});

describe('toCurrent', () => {
  it('reprend la mediaSession, et le service d’après l’URL', () => {
    expect(toCurrent(snapshot(), 0)).toMatchObject({
      service: 'youtube',
      title: 'Un clip',
      artist: 'Une chaîne',
      playing: true,
    });
  });

  it('se rabat sur le titre de la page et le nom du service', () => {
    const current = toCurrent(
      snapshot({
        url: 'https://www.twitch.tv/zerator',
        documentTitle: 'zerator - Twitch',
        title: '',
        artist: '',
        artwork: null,
      }),
      0,
    );
    expect(current).toMatchObject({ service: 'twitch', title: 'zerator', artist: 'Twitch' });
  });

  it('ne montre rien sans média audible (page d’accueil d’un service)', () => {
    expect(toCurrent(snapshot({ hasMedia: false }), 0)).toBeNull();
  });
});

describe('VideoService', () => {
  it('suit la lecture, relaie l’image et ne rediffuse qu’aux changements visibles', async () => {
    const page = new FakePage();
    let now = 1_000;
    const service = new VideoService(page, new ArtworkProxy(), silentLogger, () => now);
    let changes = 0;
    service.on('change', () => changes++);

    await service.poll();
    expect(changes).toBe(1);
    expect(service.playing).toBe(true);
    expect(service.state()).toMatchObject({
      service: 'youtube',
      title: 'Un clip',
      positionSec: 12,
      durationSec: 200,
    });
    expect(service.state()?.artworkUrl).toMatch(/^\/api\/music\/artwork\//);

    // Une seconde plus tard, une seconde plus loin : rien de visible n'a changé.
    now += 1_000;
    page.next = snapshot({ position: 13 });
    await service.poll();
    expect(changes).toBe(1);

    page.next = snapshot({ position: 13, playing: false });
    await service.poll();
    expect(changes).toBe(2);
    expect(service.playing).toBe(false);

    page.hasVideo = false;
    await service.poll();
    expect(service.state()).toBeNull();
    expect(changes).toBe(3);
  });

  it('met en pause seulement ce qui joue, et signale l’absence de vidéo', async () => {
    const page = new FakePage();
    const service = new VideoService(page, new ArtworkProxy(), silentLogger);
    await service.pause();
    expect(page.scripts).toEqual([]);

    await service.poll();
    await service.pause();
    expect(page.scripts.some((s) => s.includes('m.pause()'))).toBe(true);

    page.hasVideo = false;
    await expect(service.playPause()).rejects.toThrow('Aucune vidéo en cours');
  });
});
