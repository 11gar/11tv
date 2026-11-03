import { describe, expect, it } from 'vitest';
import { formatDuration } from './SlideIntervalSettings';
import { moveItem } from './WallpaperSettings';

describe('moveItem', () => {
  it('déplace un élément vers le haut ou le bas', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('ne sort pas des bornes', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('formatDuration', () => {
  it('affiche secondes, minutes et heures', () => {
    expect(formatDuration(30)).toBe('30 s');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(90)).toBe('1 min 30 s');
    expect(formatDuration(3600)).toBe('1 h');
  });
});
