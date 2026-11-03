import { mkdtemp, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsService } from '../settings/settings';
import { WallpaperLibrary } from './library';
import { InvalidImageError, WallpaperManager } from './manager';

const log = pino({ level: 'silent' });

/** Image JPEG de test, avec des métadonnées EXIF qui doivent disparaître. */
function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#3d7bff' } })
    .withMetadata({ exif: { IFD0: { Copyright: 'secret' } } })
    .jpeg()
    .toBuffer();
}

describe('WallpaperManager', () => {
  let dir: string;
  let library: WallpaperLibrary;
  let settings: SettingsService;
  let manager: WallpaperManager;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), '11tv-wallpapers-'));
    library = new WallpaperLibrary(path.join(dir, 'wallpapers'), log);
    await library.init(() => undefined);
    settings = await SettingsService.load(path.join(dir, 'settings.json'), log);
    manager = new WallpaperManager(library, settings, path.join(dir, 'thumbs'), log);
    return () => {
      library.close();
    };
  });

  it('réencode en WebP, réduit à 3840 px et supprime les métadonnées', async () => {
    const added = await manager.add(await jpeg(5000, 2000));
    expect(added.id).toMatch(/\.webp$/);

    const meta = await sharp(path.join(dir, 'wallpapers', added.id)).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(3840);
    expect(meta.exif).toBeUndefined();
  });

  it('n’agrandit pas une petite image', async () => {
    const added = await manager.add(await jpeg(800, 600));
    const meta = await sharp(path.join(dir, 'wallpapers', added.id)).metadata();
    expect(meta.width).toBe(800);
  });

  it('ajoute en dernier, réordonne et supprime', async () => {
    const a = await manager.add(await jpeg(100, 100));
    const b = await manager.add(await jpeg(100, 100));
    expect(settings.get().wallpaperOrder).toEqual([a.id, b.id]);

    await manager.reorder([b.id, 'inconnu.webp', a.id]);
    expect(settings.get().wallpaperOrder).toEqual([b.id, a.id]);

    await manager.remove(b.id);
    expect(settings.get().wallpaperOrder).toEqual([a.id]);
    expect(await readdir(path.join(dir, 'wallpapers'))).toEqual([a.id]);
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    await expect(manager.add(Buffer.from('pas une image'))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    expect(await readdir(path.join(dir, 'wallpapers'))).toEqual([]);
  });

  it('génère la vignette une fois puis la réutilise', async () => {
    const added = await manager.add(await jpeg(1920, 1080));
    const thumb = await manager.thumbnail(added.id);
    const meta = await sharp(thumb).metadata();
    expect([meta.width, meta.height]).toEqual([480, 270]);

    const first = (await stat(thumb)).mtimeMs;
    await manager.thumbnail(added.id);
    expect((await stat(thumb)).mtimeMs).toBe(first);
  });

  it('supprime une image juste après avoir généré sa vignette (verrou Windows)', async () => {
    const added = await manager.add(await jpeg(1920, 1080));
    await manager.thumbnail(added.id);
    await manager.remove(added.id);
    expect(await readdir(path.join(dir, 'wallpapers'))).toEqual([]);
    expect(await readdir(path.join(dir, 'thumbs'))).toEqual([]);
  });

  it('refuse les chemins hors du dossier', async () => {
    await expect(manager.thumbnail('../settings.json')).rejects.toThrow();
    await expect(manager.remove('../settings.json')).rejects.toThrow();
  });
});
