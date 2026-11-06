import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../log';
import { ModuleManager, type ManagedModule } from './module-manager';

const log = { info: vi.fn() } as unknown as Logger;

/** Module factice, avec ses fonctions de démarrage et d'arrêt observables. */
function fakeModule(id: string, configured = true) {
  const start = vi.fn();
  const stop = vi.fn();
  const module: ManagedModule = {
    id,
    name: id,
    description: '',
    configured,
    problem: configured ? null : 'À configurer',
    start,
    stop,
  };
  return { module, start, stop };
}

function setup(disabled: string[] = []) {
  let current = disabled;
  const setDisabledModules = vi.fn((ids: string[]) => {
    current = ids;
    return Promise.resolve();
  });
  let options: Record<string, Record<string, number>> = {};
  const setModuleOptions = vi.fn((id: string, values: Record<string, number>) => {
    options = { ...options, [id]: values };
    return Promise.resolve();
  });
  const postIts = fakeModule('post-its');
  const memories = fakeModule('me-mories');
  memories.module.options = [
    {
      key: 'pageSeconds',
      label: 'Temps par page',
      choices: [5, 10, 30].map((value) => ({ value, label: `${String(value)} s` })),
      default: 10,
    },
  ];
  const later = fakeModule('plus-tard', false);
  const manager = new ModuleManager(
    [postIts.module, memories.module, later.module],
    {
      disabledModules: () => current,
      setDisabledModules,
      moduleOptions: () => options,
      setModuleOptions,
    },
    log,
  );
  return { manager, setDisabledModules, setModuleOptions, postIts, memories, later };
}

describe('ModuleManager', () => {
  it('allume par défaut, ne démarre que les modules allumés et configurés', () => {
    const { manager, postIts, memories, later } = setup(['me-mories']);
    manager.startActive();
    expect(postIts.start).toHaveBeenCalled();
    expect(memories.start).not.toHaveBeenCalled();
    expect(later.start).not.toHaveBeenCalled();
    expect(manager.list().map((m) => [m.id, m.enabled, m.configured])).toEqual([
      ['post-its', true, true],
      ['me-mories', false, true],
      ['plus-tard', true, false],
    ]);
    expect(manager.isActive('plus-tard')).toBe(false);
  });

  it('éteint et rallume un module, et le retient dans les réglages', async () => {
    const { manager, setDisabledModules, memories } = setup();
    await manager.setEnabled('me-mories', false);
    expect(memories.stop).toHaveBeenCalled();
    expect(setDisabledModules).toHaveBeenLastCalledWith(['me-mories']);
    expect(manager.isActive('me-mories')).toBe(false);

    await manager.setEnabled('me-mories', true);
    expect(memories.start).toHaveBeenCalled();
    expect(setDisabledModules).toHaveBeenLastCalledWith([]);

    setDisabledModules.mockClear();
    await manager.setEnabled('me-mories', true); // Déjà allumé : rien à faire.
    expect(setDisabledModules).not.toHaveBeenCalled();
  });

  it('règle une option parmi les choix proposés, et refuse le reste', async () => {
    const { manager, setModuleOptions } = setup();
    expect(manager.optionValues('me-mories')).toEqual({ pageSeconds: 10 });
    expect(manager.list()[0]?.options).toEqual([]);

    await manager.setOption('me-mories', 'pageSeconds', 30);
    expect(setModuleOptions).toHaveBeenLastCalledWith('me-mories', { pageSeconds: 30 });
    expect(manager.list()[1]?.options[0]?.value).toBe(30);

    await expect(manager.setOption('me-mories', 'pageSeconds', 7)).rejects.toThrow(
      'Valeur non proposée',
    );
    await expect(manager.setOption('me-mories', 'inconnue', 5)).rejects.toThrow('Option inconnue');
  });

  it('refuse un module inconnu', async () => {
    await expect(setup().manager.setEnabled('inconnu', false)).rejects.toThrow('Module inconnu');
  });
});
