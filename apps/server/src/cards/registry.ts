import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ME_MORIES_PAGE_SECONDS, ME_MORIES_PAGE_SECONDS_DEFAULT } from '@11tv/shared';
import type { Logger } from '../log';
import type { ModuleOptionDef } from '../modules/module-manager';
import type { CardModule } from './card-module';
import { createMeMoriesModule, ME_MORIES_MODULE_ID } from './me-mories';

export interface CardModuleEntry {
  id: string;
  /** Nom et description affichés dans Réglages → Modules. */
  name: string;
  description: string;
  /** Options réglables depuis le téléphone, passées à la carte (TvCard.options). */
  options?: readonly ModuleOptionDef[];
  create: (config: unknown, log: Logger) => CardModule;
}

/**
 * Modules connus. Pour en ajouter un : un dossier `cards/<module>` qui exporte sa fabrique,
 * sa carte dans `TvCard` (packages/shared/src/cards.ts), son affichage dans
 * apps/tv/src/cards, et une entrée ici. Un module ne fonctionne que si son fichier de
 * configuration existe ; il s'allume et s'éteint depuis le téléphone.
 */
const CATALOG: CardModuleEntry[] = [
  {
    id: ME_MORIES_MODULE_ID,
    name: 'Me’Mories',
    description: 'Todos du jour et sans date, à gauche de l’accueil',
    options: [
      {
        key: ME_MORIES_PAGE_SECONDS,
        label: 'Temps par page',
        help: 'Quand les Todos ne tiennent pas sur une carte, les pages défilent.',
        choices: [5, 10, 15, 20, 30, 45, 60].map((s) => ({ value: s, label: `${String(s)} s` })),
        default: ME_MORIES_PAGE_SECONDS_DEFAULT,
      },
    ],
    create: createMeMoriesModule,
  },
];

/** Module du catalogue, avec son instance si sa configuration est valide. */
export interface LoadedCardModule {
  entry: CardModuleEntry;
  module: CardModule | null;
  /** Pourquoi le module ne peut pas démarrer ; null s'il est prêt. */
  problem: string | null;
}

function describeError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues
      .map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join(' ; ');
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Charge les modules configurés : `<dir>/<module>.json`. Un fichier absent laisse le module
 * en attente de configuration ; un fichier invalide est signalé sans empêcher le démarrage.
 */
export async function loadCardModules(
  dir: string,
  log: Logger,
  catalog: readonly CardModuleEntry[] = CATALOG,
): Promise<LoadedCardModule[]> {
  const loaded: LoadedCardModule[] = [];
  for (const entry of catalog) {
    const file = path.join(dir, `${entry.id}.json`);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch (err) {
      const missing = (err as NodeJS.ErrnoException).code === 'ENOENT';
      if (!missing) log.error({ module: entry.id, err }, 'Configuration du module illisible');
      loaded.push({
        entry,
        module: null,
        problem: missing
          ? `À configurer sur la Surface : modules\\${entry.id}.json`
          : 'Configuration illisible',
      });
      continue;
    }
    try {
      // Fichier écrit à la main sous Windows : un éventuel BOM est retiré.
      const json = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
      loaded.push({ entry, module: entry.create(JSON.parse(json), log), problem: null });
      log.info({ module: entry.id }, 'Module de carte prêt');
    } catch (err) {
      const details = describeError(err);
      log.error({ module: entry.id, file, details }, 'Configuration du module invalide');
      loaded.push({ entry, module: null, problem: `Configuration invalide : ${details}` });
    }
  }
  return loaded;
}
