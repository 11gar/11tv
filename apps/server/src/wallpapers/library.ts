import type { Wallpaper } from '@11tv/shared';
import { watch, type FSWatcher } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '../log';

const IMAGE_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};
const IMAGE_EXTENSIONS = new Set(Object.keys(IMAGE_TYPES));

export function wallpaperContentType(file: string): string {
  return IMAGE_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

export const WALLPAPER_ROUTE = '/wallpapers/';
export const WALLPAPER_API_ROUTE = '/api/wallpapers/';

/** Fichiers dans l'ordre choisi, puis les autres par ordre alphabétique. */
export function orderWallpapers(files: string[], order: readonly string[]): string[] {
  const available = new Set(files);
  const ordered = order.filter((name) => available.has(name));
  const placed = new Set(ordered);
  const rest = files.filter((name) => !placed.has(name)).sort((a, b) => a.localeCompare(b, 'fr'));
  return [...ordered, ...rest];
}

export function isWallpaperFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());
}

/** Dossier des fonds d'écran, surveillé pour que la TV se mette à jour sans redémarrage. */
export class WallpaperLibrary {
  private files: string[] = [];
  private watcher: FSWatcher | null = null;
  private debounce: NodeJS.Timeout | null = null;

  constructor(
    readonly dir: string,
    private readonly log: Logger,
  ) {}

  async init(onChange: () => void): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await this.scan();
    this.watcher = watch(this.dir, () => {
      if (this.debounce) clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        void this.scan().then(onChange);
      }, 300);
    });
  }

  list(order: readonly string[]): Wallpaper[] {
    return orderWallpapers(this.files, order).map((name) => ({
      id: name,
      url: `${WALLPAPER_ROUTE}${encodeURIComponent(name)}`,
      thumbUrl: `${WALLPAPER_API_ROUTE}${encodeURIComponent(name)}/thumb`,
    }));
  }

  /**
   * Vrai si `id` est un fond d'écran connu. C'est la seule validation nécessaire avant de
   * construire un chemin : un id inconnu (« ../settings.json ») est rejeté.
   */
  has(id: string): boolean {
    return this.files.includes(id);
  }

  pathOf(id: string): string {
    if (!this.has(id)) throw new Error(`Fond d’écran inconnu : ${id}`);
    return path.join(this.dir, id);
  }

  close(): void {
    this.watcher?.close();
    if (this.debounce) clearTimeout(this.debounce);
  }

  /** Relit le dossier tout de suite, sans attendre la surveillance de fichiers. */
  async scan(): Promise<void> {
    try {
      const entries = await readdir(this.dir, { withFileTypes: true });
      this.files = entries.filter((e) => e.isFile() && isWallpaperFile(e.name)).map((e) => e.name);
      this.log.debug({ count: this.files.length }, 'Fonds d’écran chargés');
    } catch (err) {
      this.log.error({ err }, 'Lecture du dossier des fonds d’écran impossible');
    }
  }
}
