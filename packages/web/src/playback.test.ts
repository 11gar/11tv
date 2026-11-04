import type { NowPlaying } from '@11tv/shared';
import { describe, expect, it } from 'vitest';
import { estimatePosition, formatTime } from './playback';

const track: NowPlaying = {
  videoId: 'dQw4w9WgXcQ',
  title: 't',
  artist: 'a',
  artworkUrl: null,
  playing: true,
  positionSec: 10,
  durationSec: 213,
};

describe('formatTime', () => {
  it('formate en minutes, et en heures au-delà', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(75.9)).toBe('1:15');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(-3)).toBe('0:00');
  });
});

describe('estimatePosition', () => {
  it('avance en lecture, reste fixe en pause, ne dépasse pas la durée', () => {
    expect(estimatePosition(track, 2500)).toBe(12.5);
    expect(estimatePosition({ ...track, playing: false }, 2500)).toBe(10);
    expect(estimatePosition(track, 10 * 60_000)).toBe(213);
  });
});
