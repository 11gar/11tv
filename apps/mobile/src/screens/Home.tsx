import { SERVICES, type View } from '@11tv/shared';
import type { ScreenProps } from '../Shell';

function viewLabel(view: View): string {
  if (view === 'home') return 'Accueil';
  if (view === 'other') return 'Autre page';
  return SERVICES.find((s) => s.id === view)?.name ?? view;
}

const BROWSER_WARNINGS = {
  starting: 'Démarrage du navigateur sur la TV…',
  unavailable: 'Le navigateur de la TV est indisponible.',
} as const;

export function Home({ state, send }: ScreenProps) {
  const browserWarning =
    state && state.browser !== 'ready' ? BROWSER_WARNINGS[state.browser] : null;

  return (
    <div class="stack">
      <section class="now-playing">
        <span class="muted">Sur la TV</span>
        <strong>{state ? viewLabel(state.view) : '…'}</strong>
      </section>
      {browserWarning && <p class="warning">{browserWarning}</p>}

      <section class="services">
        {SERVICES.map((service) => (
          <button
            key={service.id}
            type="button"
            class={state?.view === service.id ? 'service service--active' : 'service'}
            style={{ '--accent': service.accent }}
            onClick={() => {
              send({ type: 'launch', service: service.id });
            }}
          >
            {service.name}
          </button>
        ))}
      </section>

      <button
        type="button"
        class="button button--secondary button--wide"
        disabled={state?.view === 'home'}
        onClick={() => {
          send({ type: 'home' });
        }}
      >
        Retour à l’accueil
      </button>
    </div>
  );
}
