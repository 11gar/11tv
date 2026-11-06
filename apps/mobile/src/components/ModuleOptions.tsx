import type { ClientMessage, ModuleInfo } from '@11tv/shared';

interface Props {
  module: ModuleInfo;
  send: (message: ClientMessage) => void;
  onBack: () => void;
}

/** Page d'options d'un module, ouverte par sa roue crantée dans Réglages → Modules. */
export function ModuleOptions({ module, send, onBack }: Props) {
  return (
    <div class="stack">
      <button type="button" class="back-link" onClick={onBack}>
        ‹ Retour
      </button>
      <section class="card">
        <h2 class="card__title">{module.name}</h2>
        <p class="muted">{module.description}</p>
        {module.options.map((option) => (
          <label key={option.key} class="field">
            <span class="muted">{option.label}</span>
            <select
              class="input"
              value={String(option.value)}
              onChange={(e) => {
                send({
                  type: 'set-module-option',
                  id: module.id,
                  key: option.key,
                  value: Number(e.currentTarget.value),
                });
              }}
            >
              {option.choices.map((choice) => (
                <option key={choice.value} value={String(choice.value)}>
                  {choice.label}
                </option>
              ))}
            </select>
            {option.help && <span class="muted module-option__help">{option.help}</span>}
          </label>
        ))}
      </section>
    </div>
  );
}
