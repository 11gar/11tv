import type { ModuleInfo } from '@11tv/shared';
import { UserFacingError } from '../errors';
import type { Logger } from '../log';

/** Ce que le gestionnaire sait d'un module : de quoi l'afficher, le démarrer, l'arrêter. */
export interface ManagedModule {
  id: string;
  name: string;
  description: string;
  /** Faux si le module attend sa configuration (il ne peut pas démarrer). */
  configured: boolean;
  problem: string | null;
  start(): void;
  stop(): void;
}

/** Ce que le gestionnaire utilise des réglages. */
export interface ModuleSettings {
  disabledModules(): readonly string[];
  setDisabledModules(ids: string[]): Promise<void>;
}

/**
 * Allume et éteint les modules (cartes des outils externes, post-it…) depuis le téléphone.
 * Un module éteint ne tourne plus (plus de requêtes réseau) et n'affiche plus rien ; ses
 * données sont gardées pour quand on le rallume.
 */
export class ModuleManager {
  constructor(
    private readonly modules: readonly ManagedModule[],
    private readonly settings: ModuleSettings,
    private readonly log: Logger,
  ) {}

  isEnabled(id: string): boolean {
    return !this.settings.disabledModules().includes(id);
  }

  /** Allumé et en état de fonctionner. */
  isActive(id: string): boolean {
    const module = this.modules.find((m) => m.id === id);
    return module !== undefined && module.configured && this.isEnabled(id);
  }

  list(): ModuleInfo[] {
    return this.modules.map(({ id, name, description, configured, problem }) => ({
      id,
      name,
      description,
      enabled: this.isEnabled(id),
      configured,
      problem,
    }));
  }

  /** Démarre les modules allumés et configurés (au lancement du serveur). */
  startActive(): void {
    for (const module of this.modules) if (this.isActive(module.id)) module.start();
  }

  stopAll(): void {
    for (const module of this.modules) module.stop();
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const module = this.modules.find((m) => m.id === id);
    if (!module) throw new UserFacingError('Module inconnu');
    if (enabled === this.isEnabled(id)) return;

    const others = this.settings.disabledModules().filter((other) => other !== id);
    await this.settings.setDisabledModules(enabled ? others : [...others, id]);
    this.log.info({ module: id, enabled }, enabled ? 'Module allumé' : 'Module éteint');
    if (!module.configured) return;
    if (enabled) module.start();
    else module.stop();
  }
}
