import { createHash } from 'node:crypto';
import sharp from 'sharp';

/** Hôtes d'où viennent les pochettes de YouTube Music. Rien d'autre n'est relayé. */
const ALLOWED_HOSTS = ['ytimg.com', 'googleusercontent.com', 'ggpht.com'];
const MAX_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 5_000;
const CACHE_ENTRIES = 40;

export const ARTWORK_ROUTE = '/api/music/artwork/';

export function isAllowedArtworkUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === 'https:' &&
      ALLOWED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

/** Clé publique d'une pochette : les clients ne voient jamais l'URL d'origine. */
export function artworkKey(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 24);
}

export interface Artwork {
  type: string;
  body: Buffer;
}

const ARTWORK_SIZE = 512;

/**
 * Pochette carrée : les miniatures des clips YouTube sont en 4:3 avec des bandes noires
 * (format « letterbox »). On les retire, puis on recadre au centre. Une image déjà carrée
 * (pochette d'album) est seulement redimensionnée.
 */
async function squareArtwork(input: Buffer): Promise<Artwork> {
  const { width, height } = await sharp(input).metadata();
  const letterboxed = height > 0 && Math.abs(width / height - 4 / 3) < 0.01;
  const source = letterboxed
    ? await sharp(input).trim({ background: '#000', threshold: 24 }).toBuffer()
    : input;
  const body = await sharp(source)
    .resize(ARTWORK_SIZE, ARTWORK_SIZE, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();
  return { type: 'image/webp', body };
}

/**
 * Relais des pochettes : les pages TV et téléphone n'autorisent que leurs propres images
 * (CSP), et le téléphone n'a pas forcément accès à Internet par le même chemin. Seules les
 * URL enregistrées (titre en cours, historique) sont servies : ce n'est pas un proxy ouvert.
 */
export class ArtworkProxy {
  private readonly known = new Map<string, string>();
  private readonly cache = new Map<string, Artwork>();

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /** Enregistre une URL et renvoie le chemin local à donner aux clients, ou null. */
  register(url: string | null): string | null {
    if (!url || !isAllowedArtworkUrl(url)) return null;
    const key = artworkKey(url);
    this.known.set(key, url);
    return `${ARTWORK_ROUTE}${key}`;
  }

  /** Oublie les URL qui ne sont plus affichées nulle part. */
  retain(urls: Iterable<string | null>): void {
    const keep = new Set([...urls].filter((u) => u !== null).map(artworkKey));
    for (const key of this.known.keys()) {
      if (!keep.has(key)) {
        this.known.delete(key);
        this.cache.delete(key);
      }
    }
  }

  async get(key: string): Promise<Artwork | null> {
    const url = this.known.get(key);
    if (!url) return null;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const res = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'error',
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return null;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) return null;

    const artwork = await squareArtwork(body).catch(() => ({ type, body }));
    this.cache.set(key, artwork);
    if (this.cache.size > CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return artwork;
  }
}
