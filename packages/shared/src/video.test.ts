import { describe, expect, it } from 'vitest';
import type { NowPlaying } from './music';
import { activeNowPlaying, type VideoNowPlaying } from './video';

const music = (playing: boolean): NowPlaying => ({
  videoId: null,
  title: 'Titre',
  artist: 'Artiste',
  artworkUrl: null,
  playing,
  positionSec: 0,
  durationSec: 0,
});
const video = (playing: boolean): VideoNowPlaying => ({ ...music(playing), service: 'twitch' });

describe('activeNowPlaying', () => {
  it('montre ce qui joue', () => {
    expect(activeNowPlaying(music(true), video(false))?.kind).toBe('music');
    expect(activeNowPlaying(music(false), video(true))?.kind).toBe('video');
  });

  it('montre la vidéo en pause plutôt que la musique en pause', () => {
    expect(activeNowPlaying(music(false), video(false))?.kind).toBe('video');
    expect(activeNowPlaying(music(false), null)?.kind).toBe('music');
    expect(activeNowPlaying(null, null)).toBeNull();
  });
});
