import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Logger } from '../log';
import type { CardModule } from './card-module';
import { createMeMoriesModule, ME_MORIES_MODULE_ID } from './me-mories';

type ModuleFactory = (config: unknown, log: Logger) => CardModule;

/**
 * Modules connus. Pour en ajouter un : un dossier `cards/<module>` qui exporte sa fabrique,
 * sa carte dans `TvCard` (packages/shared/src/cards.ts) et son affichage dans
 * apps/tv/src/cards. Un module n'est actif que si son fichier de configuration existe.
 */
const CATALOG: Record<string, ModuleFactory> = {
  [ME_MORIES_MODULE_ID]: createMeMoriesModule,
};

function describeError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues
      .map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join(' ; ');
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Charge les modules configurés : `<dir>/<module>.json`. Un fichier absent désactive le
 * module ; un fichier invalide est signalé dans le journal sans empêcher le démarrage.
 */
export async function loadCardModules(
  dir: string,
  log: Logger,
  catalog: Record<string, ModuleFactory> = CATALOG,
): Promise<CardModule[]> {
  const modules: CardModule[] = [];
  for (const [id, create] of Object.entries(catalog)) {
    const file = path.join(dir, `${id}.json`);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.error({ module: id, err }, 'Configuration du module illisible');
      }
      continue;
    }
    try {
      // Fichier écrit à la main sous Windows : un éventuel BOM est retiré.
      const json = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
      const module = create(JSON.parse(json), log);
      modules.push(module);
      log.info({ module: id }, 'Module de carte activé');
    } catch (err) {
      log.error(
        { module: id, file, details: describeError(err) },
        'Configuration du module invalide',
      );
    }
  }
  return modules;
}
