import { describe, expect, it } from 'vitest';
import { isWallpaperFile, orderWallpapers } from './library';

describe('orderWallpapers', () => {
  it('respecte l’ordre choisi puis classe le reste par ordre alphabétique', () => {
    expect(orderWallpapers(['c.jpg', 'a.jpg', 'b.jpg', 'd.jpg'], ['d.jpg', 'b.jpg'])).toEqual([
      'd.jpg',
      'b.jpg',
      'a.jpg',
      'c.jpg',
    ]);
  });

  it('ignore les fichiers de l’ordre qui n’existent plus', () => {
    expect(orderWallpapers(['a.jpg'], ['supprimé.jpg', 'a.jpg'])).toEqual(['a.jpg']);
  });
});

describe('isWallpaperFile', () => {
  it('ne garde que les images', () => {
    expect(isWallpaperFile('plage.JPG')).toBe(true);
    expect(isWallpaperFile('photo.webp')).toBe(true);
    expect(isWallpaperFile('notes.txt')).toBe(false);
    expect(isWallpaperFile('desktop.ini')).toBe(false);
  });
});
