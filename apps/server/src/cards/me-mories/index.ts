import type { Logger } from '../../log';
import { PollingCardModule, type CardModule } from '../card-module';
import { FirebaseReader } from './firebase-reader';
import { meMoriesConfigSchema } from './config';
import { toTodosData } from './todos';

export const ME_MORIES_MODULE_ID = 'me-mories';

/**
 * Carte « Todos à venir » de Me'Mories, à gauche de l'écran d'accueil, actualisée toutes
 * les 30 minutes (réglable). Lecture seule : ce module n'écrit jamais dans Firestore.
 */
export function createMeMoriesModule(rawConfig: unknown, log: Logger): CardModule {
  const config = meMoriesConfigSchema.parse(rawConfig);
  const reader = new FirebaseReader(config);
  return new PollingCardModule({
    id: ME_MORIES_MODULE_ID,
    kind: 'me-mories-todos',
    slot: 'left',
    intervalMs: config.refreshMinutes * 60 * 1000,
    log,
    fetch: async () => {
      const [todos, tags] = await Promise.all([
        reader.query('todos', { field: 'status', equals: 'todo' }),
        reader.query('tags'),
      ]);
      return toTodosData(todos, tags);
    },
  });
}
