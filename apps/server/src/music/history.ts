import { MUSIC_HISTORY_MAX, PLAYLIST_ID_PATTERN, VIDEO_ID_PATTERN } from '@11tv/shared';
import { z } from 'zod';
import type { Logger } from '../log';
import { JsonFile } from '../storage/json-file';

const storedTrackSchema = z.object({
  videoId: z.string().regex(VIDEO_ID_PATTERN),
  playlistId: z.string().regex(PLAYLIST_ID_PATTERN).nullable(),
  title: z.string().max(500),
  artist: z.string().max(500),
  /** URL d'origine de la pochette (relayée par ArtworkProxy). */
  artwork: z.string().max(2000).nullable(),
  playedAt: z.number(),
});

const historyFileSchema = z.object({ tracks: z.array(storedTrackSchema) });

export type StoredTrack = z.infer<typeof storedTrackSchema>;

/**
 * Titres écoutés sur la TV, du plus récent au plus ancien, sans doublon. Réécouter un titre
 * le remonte en tête.
 */
export class MusicHistory {
  private constructor(
    private readonly file: JsonFile<z.infer<typeof historyFileSchema>>,
    private tracks: StoredTrack[],
  ) {}

  static async load(filePath: string, log: Logger): Promise<MusicHistory> {
    const file = new JsonFile(filePath, historyFileSchema, () => ({ tracks: [] }), log);
    const { tracks } = await file.load();
    return new MusicHistory(file, tracks);
  }

  list(): readonly StoredTrack[] {
    return this.tracks;
  }

  async record(track: StoredTrack): Promise<void> {
    const parsed = storedTrackSchema.safeParse(track);
    if (!parsed.success) return;
    this.tracks = [parsed.data, ...this.tracks.filter((t) => t.videoId !== track.videoId)].slice(
      0,
      MUSIC_HISTORY_MAX,
    );
    await this.file.save({ tracks: this.tracks });
  }
}
