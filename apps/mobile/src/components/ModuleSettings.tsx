import type { ClientMessage, ModuleInfo } from '@11tv/shared';
import { haptic } from '../hooks/use-repeat';

interface Props {
  modules: readonly ModuleInfo[];
  send: (message: ClientMessage) => void;
}

/** Allumer ou éteindre chaque module (Me'Mories, post-it, et les suivants). */
export function ModuleSettings({ modules, send }: Props) {
  if (modules.length === 0) return null;
  return (
    <section class="card">
      <h2 class="card__title">Modules</h2>
      <ul class="module-list">
        {modules.map((module) => {
          // Pas encore configuré : rien à allumer, on explique quoi faire.
          const blocked = !module.configured;
          const on = module.enabled && !blocked;
          return (
            <li key={module.id} class="module-row">
              <div class="module-row__text">
                <span class="module-row__name">{module.name}</span>
                <span class="muted module-row__description">{module.description}</span>
                {module.problem && <span class="module-row__problem">{module.problem}</span>}
              </div>
              <button
                type="button"
                role="switch"
                class="switch"
                aria-checked={on}
                aria-label={`${module.name} : ${on ? 'allumé' : 'éteint'}`}
                disabled={blocked}
                onClick={() => {
                  haptic();
                  send({ type: 'set-module-enabled', id: module.id, enabled: !module.enabled });
                }}
              >
                <span class="switch__thumb" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
