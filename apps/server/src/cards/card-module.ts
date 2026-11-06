import type { TvCard } from '@11tv/shared';
import { EventEmitter } from 'node:events';
import type { Logger } from '../log';

/**
 * Contrat d'un module de carte : un outil externe (Me'Mories…) isolé dans son dossier,
 * avec sa configuration, son accès réseau et sa mise en forme. Le reste de 11TV ne connaît
 * que ce contrat ; un module en panne n'affecte ni les autres, ni la TV.
 */
export interface CardModule {
  readonly id: string;
  start(): void;
  stop(): void;
  /** Carte à afficher, ou null tant que rien n'a été chargé. */
  card(): TvCard | null;
  on(event: 'change', listener: () => void): this;
}

type CardOf<K extends TvCard['kind']> = Extract<TvCard, { kind: K }>;

export interface PollingCardOptions<K extends TvCard['kind']> {
  id: string;
  kind: K;
  slot: CardOf<K>['slot'];
  intervalMs: number;
  log: Logger;
  /** Récupère les données ; une exception garde les précédentes et note l'erreur. */
  fetch: () => Promise<CardOf<K>['data']>;
}

/**
 * Module qui s'actualise à intervalle fixe. Les données d'un échec ne remplacent jamais
 * les dernières réussies : la TV garde une carte lisible pendant une coupure d'Internet.
 */
export class PollingCardModule<K extends TvCard['kind']>
  extends EventEmitter<{ change: [] }>
  implements CardModule
{
  readonly id: string;
  private current: CardOf<K> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly options: PollingCardOptions<K>) {
    super();
    this.id = options.id;
  }

  start(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.options.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  card(): TvCard | null {
    return this.current;
  }

  /** Actualise tout de suite (au démarrage, puis à chaque intervalle). */
  async refresh(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const { id, kind, slot, log } = this.options;
    try {
      const data = await this.options.fetch();
      // Les options sont ajoutées par le serveur au moment de l’envoi (index.ts).
      this.current = {
        id,
        kind,
        slot,
        data,
        updatedAt: Date.now(),
        error: null,
        options: {},
      } as CardOf<K>;
      log.debug({ module: id }, 'Carte actualisée');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ module: id, err }, 'Actualisation de la carte impossible');
      // Rien encore chargé : pas de carte vide sur la TV, seulement le journal.
      if (!this.current) return;
      this.current = { ...this.current, error: message };
    } finally {
      this.running = false;
    }
    this.emit('change');
  }
}
