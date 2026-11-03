import { SERVICES, type AppState, type View } from '@11tv/shared';
import { useAppSocket } from '@11tv/web';
import { useEffect, useState } from 'preact/hooks';
import { fetchSession, logout } from '../api';

interface Props {
  onSessionLost: () => void;
}

function viewLabel(view: View): string {
  if (view === 'home') return 'Accueil';
  if (view === 'other') return 'Autre page';
  return SERVICES.find((s) => s.id === view)?.name ?? view;
}

const BROWSER_WARNINGS = {
  starting: 'Démarrage du navigateur sur la TV…',
  unavailable: 'Le navigateur de la TV est indisponible.',
} as const;

export function Home({ onSessionLost }: Props) {
  const { state, status, error, send } = useAppSocket<AppState>();
  const [toast, setToast] = useState<string | null>(null);

  // Un WebSocket refusé (session expirée, PIN changé) se voit comme une simple coupure :
  // on vérifie la session pour savoir s'il faut revenir à l'écran du PIN.
  useEffect(() => {
    if (status !== 'closed') return;
    fetchSession()
      .then((ok) => {
        if (!ok) onSessionLost();
      })
      .catch(() => undefined);
  }, [status, onSessionLost]);

  useEffect(() => {
    if (!error) return;
    setToast(error.message);
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [error]);

  const run = (ok: boolean) => {
    if (!ok) setToast('Pas de connexion avec la Surface.');
  };

  const browserWarning =
    state && state.browser !== 'ready' ? BROWSER_WARNINGS[state.browser] : null;

  return (
    <main class="home">
      <header class="home__header">
        <h1 class="home__title">11TV</h1>
        <span class={`dot dot--${status}`} title={status === 'open' ? 'Connecté' : 'Hors ligne'} />
      </header>

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
              run(send({ type: 'launch', service: service.id }));
            }}
          >
            {service.name}
          </button>
        ))}
      </section>

      <button
        type="button"
        class="button button--home"
        disabled={state?.view === 'home'}
        onClick={() => {
          run(send({ type: 'home' }));
        }}
      >
        Retour à l’accueil
      </button>

      <footer class="home__footer">
        <button
          type="button"
          class="link"
          onClick={() => {
            void logout().finally(onSessionLost);
          }}
        >
          Se déconnecter
        </button>
      </footer>

      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
