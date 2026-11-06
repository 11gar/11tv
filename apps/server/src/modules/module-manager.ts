import type { ModuleInfo, ModuleOption, ModuleOptionValues } from '@11tv/shared';
import { UserFacingError } from '../errors';
import type { Logger } from '../log';

/** Option déclarée par un module : sa liste de choix et sa valeur par défaut. */
export type ModuleOptionDef = Omit<ModuleOption, 'value'> & { default: number };

/** Ce que le gestionnaire sait d'un module : de quoi l'afficher, le démarrer, l'arrêter. */
export interface ManagedModule {
  id: string;
  name: string;
  description: string;
  /** Faux si le module attend sa configuration (il ne peut pas démarrer). */
  configured: boolean;
  problem: string | null;
  options?: readonly ModuleOptionDef[];
  start(): void;
  stop(): void;
}

/** Ce que le gestionnaire utilise des réglages. */
export interface ModuleSettings {
  disabledModules(): readonly string[];
  setDisabledModules(ids: string[]): Promise<void>;
  moduleOptions(): Readonly<Record<string, ModuleOptionValues>>;
  setModuleOptions(id: string, values: ModuleOptionValues): Promise<void>;
}

/**
 * Allume et éteint les modules (cartes des outils externes, post-it…) depuis le téléphone,
 * et règle leurs options. Un module éteint ne tourne plus (plus de requêtes réseau) et
 * n'affiche plus rien ; ses données sont gardées pour quand on le rallume.
 */
export class ModuleManager {
  constructor(
    private readonly modules: readonly ManagedModule[],
    private readonly settings: ModuleSettings,
    private readonly log: Logger,
  ) {}

  private find(id: string): ManagedModule {
    const module = this.modules.find((m) => m.id === id);
    if (!module) throw new UserFacingError('Module inconnu');
    return module;
  }

  isEnabled(id: string): boolean {
    return !this.settings.disabledModules().includes(id);
  }

  /** Allumé et en état de fonctionner. */
  isActive(id: string): boolean {
    const module = this.modules.find((m) => m.id === id);
    return module !== undefined && module.configured && this.isEnabled(id);
  }

  /**
   * Valeurs des options d'un module. Une valeur enregistrée qui ne fait plus partie des choix
   * (le module a changé de liste) retombe sur la valeur par défaut.
   */
  optionValues(id: string): ModuleOptionValues {
    const module = this.modules.find((m) => m.id === id);
    const saved = this.settings.moduleOptions()[id] ?? {};
    const values: ModuleOptionValues = {};
    for (const option of module?.options ?? []) {
      const value = saved[option.key];
      values[option.key] =
        value !== undefined && option.choices.some((c) => c.value === value)
          ? value
          : option.default;
    }
    return values;
  }

  list(): ModuleInfo[] {
    return this.modules.map(({ id, name, description, configured, problem, options = [] }) => {
      const values = this.optionValues(id);
      return {
        id,
        name,
        description,
        enabled: this.isEnabled(id),
        configured,
        problem,
        options: options.map(({ default: fallback, ...option }) => ({
          ...option,
          value: values[option.key] ?? fallback,
        })),
      };
    });
  }

  /** Démarre les modules allumés et configurés (au lancement du serveur). */
  startActive(): void {
    for (const module of this.modules) if (this.isActive(module.id)) module.start();
  }

  stopAll(): void {
    for (const module of this.modules) module.stop();
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const module = this.find(id);
    if (enabled === this.isEnabled(id)) return;

    const others = this.settings.disabledModules().filter((other) => other !== id);
    await this.settings.setDisabledModules(enabled ? others : [...others, id]);
    this.log.info({ module: id, enabled }, enabled ? 'Module allumé' : 'Module éteint');
    if (!module.configured) return;
    if (enabled) module.start();
    else module.stop();
  }

  async setOption(id: string, key: string, value: number): Promise<void> {
    const option = this.find(id).options?.find((o) => o.key === key);
    if (!option) throw new UserFacingError('Option inconnue');
    if (!option.choices.some((c) => c.value === value)) {
      throw new UserFacingError('Valeur non proposée pour cette option');
    }
    await this.settings.setModuleOptions(id, { ...this.optionValues(id), [key]: value });
    this.log.info({ module: id, key, value }, 'Option de module modifiée');
  }
}
