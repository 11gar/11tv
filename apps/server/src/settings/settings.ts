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
  /**
   * Modules éteints depuis le téléphone. On retient ceux qui sont éteints plutôt qu'allumés :
   * un module ajouté plus tard démarre allumé.
   */
  disabledModules: z.array(z.string()).default([]),
  /** Options choisies pour chaque module ; une option absente prend sa valeur par défaut. */
  moduleOptions: z.record(z.string(), z.record(z.string(), z.number())).default({}),
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
    disabledModules: [],
    moduleOptions: {},
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

  /**
   * Applique une modification. Les modifications sont sérialisées : chacune part de l'état
   * laissé par la précédente, sinon deux mises à jour simultanées (ordre des fonds d'écran et
   * délai, par exemple) s'écraseraient.
   */
  update(change: (draft: Settings) => Settings): Promise<Settings> {
    const task = this.queue.then(async () => {
      const next = settingsSchema.parse(change(structuredClone(this.current)));
      await this.file.save(next);
      this.current = next;
      this.emit('change', next);
      return next;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  private queue: Promise<unknown> = Promise.resolve();
}
