import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ArtworkProxy, isAllowedArtworkUrl } from './artwork';
import { MusicHistory } from './history';
import { MusicService, type MusicBrowser } from './music-service';
import {
  CONTROL_SCRIPTS,
  SNAPSHOT_SCRIPT,
  idsFromUrl,
  type PageSnapshot,
} from './youtube-music-page';

const log = pino({ level: 'silent' });
const ART = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg';

class FakeMusicPage implements MusicBrowser {
  hasMusic = true;
  snapshot: PageSnapshot = {
    url: 'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RDAMVMdQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    artwork: ART,
    playing: true,
    position: 0,
    duration: 213,
  };
  readonly scripts: string[] = [];
  evaluateInMusic(expression: string): Promise<unknown> {
    if (expression === SNAPSHOT_SCRIPT) return Promise.resolve({ ...this.snapshot });
    this.scripts.push(expression);
    return Promise.resolve(true);
  }
}

async function setup() {
  const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-music-'));
  const history = await MusicHistory.load(path.join(dir, 'music-history.json'), log);
  const page = new FakeMusicPage();
  let now = 0;
  const music = new MusicService(page, history, new ArtworkProxy(), log, () => now);
  let changes = 0;
  music.on('change', () => changes++);
  return {
    music,
    page,
    history,
    dir,
    changes: () => changes,
    advance: (ms: number) => {
      now += ms;
      page.snapshot.position += page.snapshot.playing ? ms / 1000 : 0;
    },
  };
}

describe('MusicService', () => {
  it('expose le titre en cours avec une pochette relayée en local', async () => {
    const { music } = await setup();
    await music.poll();
    const { nowPlaying } = music.state();
    expect(nowPlaying).toMatchObject({
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      playing: true,
      durationSec: 213,
    });
    expect(nowPlaying?.artworkUrl).toMatch(/^\/api\/music\/artwork\/[0-9a-f]{24}$/);
    expect(JSON.stringify(nowPlaying)).not.toContain('ytimg');
  });

  it('ne rediffuse pas à chaque seconde, seulement sur un vrai changement', async () => {
    const { music, page, changes, advance } = await setup();
    await music.poll();
    expect(changes()).toBe(1);
    for (let i = 0; i < 5; i++) {
      advance(1000);
      await music.poll();
    }
    expect(changes()).toBe(1);

    page.snapshot.playing = false;
    await music.poll();
    expect(changes()).toBe(2);

    page.snapshot.position = 120; // saut dans le morceau
    await music.poll();
    expect(changes()).toBe(3);
  });

  it('avance la position entre deux mesures pendant la lecture', async () => {
    const { music, page, advance } = await setup();
    await music.poll();
    advance(4000);
    page.snapshot.position -= 4; // la page n'a pas encore été relue
    expect(music.state().nowPlaying?.positionSec).toBe(4);
  });

  it('ajoute un titre à l’historique après 10 s d’écoute, sans doublon', async () => {
    const { music, history, advance, dir } = await setup();
    await music.poll();
    expect(history.list()).toHaveLength(0);
    advance(11_000);
    await music.poll();
    advance(5_000);
    await music.poll();
    expect(music.state().recent).toEqual([
      expect.objectContaining({
        videoId: 'dQw4w9WgXcQ',
        playlistId: 'RDAMVMdQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
      }),
    ]);

    const reloaded = await MusicHistory.load(path.join(dir, 'music-history.json'), log);
    expect(reloaded.list()).toHaveLength(1);
  });

  it('n’affiche rien sans fenêtre de musique ni titre', async () => {
    const { music, page } = await setup();
    page.snapshot.title = '';
    await music.poll();
    expect(music.state().nowPlaying).toBeNull();
    page.hasMusic = false;
    await expect(music.control('next')).rejects.toThrow('YouTube Music n’est pas ouvert');
  });

  it('transmet les commandes au lecteur, et ne met en pause que ce qui joue', async () => {
    const { music, page } = await setup();
    await music.control('play-pause');
    expect(page.scripts).toEqual([CONTROL_SCRIPTS['play-pause']]);

    await music.poll();
    await music.pause();
    expect(page.scripts).toHaveLength(2);
    page.snapshot.playing = false;
    await music.poll();
    await music.pause();
    expect(page.scripts).toHaveLength(2);
  });
});

describe('MusicHistory', () => {
  it('remonte un titre réécouté et limite la taille', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-history-'));
    const history = await MusicHistory.load(path.join(dir, 'h.json'), log);
    const track = (n: number) => ({
      videoId: `video${String(n).padStart(6, '0')}`,
      playlistId: null,
      title: `Titre ${String(n)}`,
      artist: 'Artiste',
      artwork: null,
      playedAt: n,
    });
    for (let i = 0; i < 25; i++) await history.record(track(i));
    await history.record(track(10));
    expect(history.list()).toHaveLength(20);
    expect(history.list()[0]?.videoId).toBe('video000010');
    expect(history.list().filter((t) => t.videoId === 'video000010')).toHaveLength(1);
  });

  it('ignore un identifiant invalide', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-history-'));
    const history = await MusicHistory.load(path.join(dir, 'h.json'), log);
    await history.record({
      videoId: '../../etc',
      playlistId: null,
      title: 't',
      artist: 'a',
      artwork: null,
      playedAt: 0,
    });
    expect(history.list()).toHaveLength(0);
  });
});

describe('Pochettes', () => {
  it('n’accepte que les hôtes d’images de YouTube, en HTTPS', () => {
    expect(isAllowedArtworkUrl(ART)).toBe(true);
    expect(isAllowedArtworkUrl('https://lh3.googleusercontent.com/abc=w544-h544')).toBe(true);
    expect(isAllowedArtworkUrl('http://i.ytimg.com/vi/x.jpg')).toBe(false);
    expect(isAllowedArtworkUrl('https://evil.example/ytimg.com.jpg')).toBe(false);
    expect(isAllowedArtworkUrl('https://ytimg.com.evil.example/x.jpg')).toBe(false);
    expect(isAllowedArtworkUrl('http://192.168.1.1/')).toBe(false);
  });

  it('ne sert que les URL enregistrées, et met l’image en cache', async () => {
    let fetches = 0;
    const fakeFetch = (() => {
      fetches++;
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } }),
      );
    }) as typeof fetch;
    const proxy = new ArtworkProxy(fakeFetch);
    expect(await proxy.get('0123456789abcdef01234567')).toBeNull();

    const route = proxy.register(ART);
    const key = route?.split('/').at(-1) ?? '';
    expect((await proxy.get(key))?.type).toBe('image/jpeg');
    await proxy.get(key);
    expect(fetches).toBe(1);

    proxy.retain([]);
    expect(await proxy.get(key)).toBeNull();
  });

  it('retire les bandes noires des miniatures de clips et rend une pochette carrée', async () => {
    // Miniature 4:3 : image rouge 16:9 entre deux bandes noires de 60 px.
    const thumbnail = await sharp({
      create: { width: 640, height: 480, channels: 3, background: '#000' },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 640, height: 360, channels: 3, background: '#e01010' },
          })
            .png()
            .toBuffer(),
          top: 60,
          left: 0,
        },
      ])
      .jpeg()
      .toBuffer();
    const fakeFetch = (() =>
      Promise.resolve(
        new Response(new Uint8Array(thumbnail), { headers: { 'content-type': 'image/jpeg' } }),
      )) as typeof fetch;
    const proxy = new ArtworkProxy(fakeFetch);
    const key = proxy.register(ART)?.split('/').at(-1) ?? '';
    const artwork = await proxy.get(key);
    expect(artwork?.type).toBe('image/webp');

    const { data, info } = await sharp(artwork?.body).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([512, 512]);
    // Le haut de l'image n'est plus noir : la bande a disparu (bord de 4 px toléré, JPEG).
    expect(data[(4 * 512 + 256) * info.channels]).toBeGreaterThan(150);
  });

  it('refuse ce qui n’est pas une image', async () => {
    const fakeFetch = (() =>
      Promise.resolve(
        new Response('<html>', { headers: { 'content-type': 'text/html' } }),
      )) as typeof fetch;
    const proxy = new ArtworkProxy(fakeFetch);
    const key = proxy.register(ART)?.split('/').at(-1) ?? '';
    expect(await proxy.get(key)).toBeNull();
  });
});

describe('idsFromUrl', () => {
  it('lit le titre et la playlist d’une URL YouTube Music uniquement', () => {
    expect(idsFromUrl('https://music.youtube.com/watch?v=abc&list=PL1')).toEqual({
      videoId: 'abc',
      playlistId: 'PL1',
    });
    expect(idsFromUrl('https://www.youtube.com/watch?v=abc')).toEqual({
      videoId: null,
      playlistId: null,
    });
  });
});
