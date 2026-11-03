import {
  SLIDE_INTERVAL_DEFAULT_SEC,
  SLIDE_INTERVAL_MAX_SEC,
  SLIDE_INTERVAL_MIN_SEC,
} from '@11tv/shared';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import type { Logger } from '../log';
import { JsonFile } from '../storage/json-file';

export const settingsSchema = z.object({
  version: z.literal(1),
  slideIntervalSec: z.number().int().min(SLIDE_INTERVAL_MIN_SEC).max(SLIDE_INTERVAL_MAX_SEC),
  /** Ordre choisi des fonds d'écran (noms de fichiers) ; les fichiers absents sont ignorés. */
  wallpaperOrder: z.array(z.string()),
  auth: z
    .object({
      pinHash: z.string(),
      /** Vrai tant qu'aucun téléphone ne s'est connecté avec le PIN généré. */
      pairingPending: z.boolean(),
    })
    .nullable(),
});

export type Settings = z.infer<typeof settingsSchema>;

export function defaultSettings(): Settings {
  return {
    version: 1,
    slideIntervalSec: SLIDE_INTERVAL_DEFAULT_SEC,
    wallpaperOrder: [],
    auth: null,
  };
}

/** Réglages en mémoire, persistés à chaque modification. */
export class SettingsService extends EventEmitter<{ change: [Settings] }> {
  private constructor(
    private readonly file: JsonFile<Settings>,
    private current: Settings,
  ) {
    super();
  }

  static async load(filePath: string, log: Logger): Promise<SettingsService> {
    const file = new JsonFile(filePath, settingsSchema, defaultSettings, log);
    return new SettingsService(file, await file.load());
  }

  get(): Readonly<Settings> {
    return this.current;
  }

  async update(change: (draft: Settings) => Settings): Promise<Settings> {
    const next = settingsSchema.parse(change(structuredClone(this.current)));
    await this.file.save(next);
    this.current = next;
    this.emit('change', next);
    return next;
  }
}
