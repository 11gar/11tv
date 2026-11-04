import type { Wallpaper } from '@11tv/shared';
import { randomBytes } from 'node:crypto';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Logger } from '../log';
import type { SettingsService } from '../settings/settings';
import type { WallpaperLibrary } from './library';

// Le cache de libvips garde les fichiers sources ouverts : sous Windows, un fond d'écran dont
// on vient de générer la vignette ne pourrait plus être supprimé (EBUSY).
sharp.cache(false);

/** Taille maximale stockée : de quoi couvrir une TV 4K, sans agrandir les petites images. */
const MAX_WIDTH = 3840;
const MAX_HEIGHT = 2160;
const THUMB_WIDTH = 480;
const THUMB_HEIGHT = 270;
/** Garde-fou contre les images piégées (« bombes de décompression »). */
const MAX_INPUT_PIXELS = 120_000_000;

export class InvalidImageError extends Error {
  constructor() {
    super('Image illisible ou format non pris en charge');
    this.name = 'InvalidImageError';
  }
}

function newWallpaperId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.webp`;
}

/**
 * Ajout, suppression et ordre des fonds d'écran. Les images envoyées sont réencodées
 * (WebP, orientation EXIF appliquée, métadonnées supprimées, dont la position GPS).
 */
export class WallpaperManager {
  constructor(
    private readonly library: WallpaperLibrary,
    private readonly settings: SettingsService,
    private readonly thumbsDir: string,
    private readonly log: Logger,
  ) {}

  async add(input: Buffer): Promise<Wallpaper> {
    const id = newWallpaperId();
    const target = path.join(this.library.dir, id);
    // Fichier temporaire sans extension d'image : la TV ne voit jamais une image à moitié écrite.
    const tmp = `${target}.tmp`;
    try {
      await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(tmp);
    } catch (err) {
      await rm(tmp, { force: true });
      this.log.warn({ err }, 'Image refusée');
      throw new InvalidImageError();
    }
    await rename(tmp, target);
    await this.library.scan();
    // La nouvelle image va en dernier, après celles déjà affichées.
    const order = [...this.currentOrder().filter((name) => name !== id), id];
    await this.settings.update((s) => ({ ...s, wallpaperOrder: order }));
    this.log.info({ id }, 'Fond d’écran ajouté');
    const wallpaper = this.library
      .list(this.settings.get().wallpaperOrder)
      .find((w) => w.id === id);
    if (!wallpaper) throw new Error('Fond d’écran introuvable après ajout');
    return wallpaper;
  }

  exists(id: string): boolean {
    return this.library.has(id);
  }

  /** Chemin de l'image ; `id` doit avoir été vérifié avec `exists`. */
  imagePath(id: string): string {
    return this.library.pathOf(id);
  }

  async remove(id: string): Promise<void> {
    const file = this.library.pathOf(id);
    await rm(file);
    await rm(this.thumbPath(id), { force: true });
    await this.library.scan();
    await this.settings.update((s) => ({
      ...s,
      wallpaperOrder: s.wallpaperOrder.filter((name) => name !== id),
    }));
    this.log.info({ id }, 'Fond d’écran supprimé');
  }

  /** Nouvel ordre ; les ids inconnus sont ignorés, les fonds absents de la liste vont à la fin. */
  async reorder(order: readonly string[]): Promise<void> {
    const known = order.filter((id) => this.library.has(id));
    await this.settings.update((s) => ({ ...s, wallpaperOrder: [...new Set(known)] }));
  }

  /** Chemin de la vignette, générée à la première demande puis conservée. */
  async thumbnail(id: string): Promise<string> {
    const source = this.library.pathOf(id);
    const thumb = this.thumbPath(id);
    const [sourceStat, thumbStat] = await Promise.all([
      stat(source),
      stat(thumb).catch(() => null),
    ]);
    if (thumbStat && thumbStat.mtimeMs >= sourceStat.mtimeMs) return thumb;

    await mkdir(this.thumbsDir, { recursive: true });
    const tmp = `${thumb}.tmp`;
    await sharp(source, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: THUMB_WIDTH, height: THUMB_HEIGHT, fit: 'cover' })
      .webp({ quality: 75 })
      .toFile(tmp);
    await rename(tmp, thumb);
    return thumb;
  }

  private thumbPath(id: string): string {
    return path.join(this.thumbsDir, `${id}.webp`);
  }

  /** Ordre affiché actuellement (y compris les fichiers déposés à la main). */
  private currentOrder(): string[] {
    return this.library.list(this.settings.get().wallpaperOrder).map((w) => w.id);
  }
}
