import type { UpdateStatus } from '@11tv/shared';
import { useEffect, useState } from 'preact/hooks';
import { fetchUpdateStatus, startUpdate } from '../api';

const POLL_MS = 2000;
/** Au-delà, la Surface ne revient pas : on arrête d'attendre. */
const RESTART_TIMEOUT_MS = 3 * 60 * 1000;
const NOTICE_KEY = '11tv-update-installed';

/** Message à afficher une fois la page rechargée sur la nouvelle version. */
export function consumeUpdateNotice(): string | null {
  try {
    if (!sessionStorage.getItem(NOTICE_KEY)) return null;
    sessionStorage.removeItem(NOTICE_KEY);
    return '11TV a été mis à jour.';
  } catch {
    return null;
  }
}

/**
 * « restarting » : le serveur s'est arrêté pendant la mise à jour, c'est-à-dire qu'une
 * nouvelle version a été installée et que le lanceur la démarre.
 */
type View = UpdateStatus | { state: 'restarting'; since: number } | { state: 'lost' };

function describe(view: View | null): string {
  switch (view?.state) {
    case undefined:
      return '';
    case 'unavailable':
      return view.message;
    case 'idle':
      return 'Récupère la dernière version, la construit puis relance 11TV (1 à 2 minutes).';
    case 'running':
      return 'Mise à jour en cours… La TV reste utilisable pendant ce temps.';
    case 'restarting':
      return 'Nouvelle version installée : redémarrage de 11TV…';
    case 'up-to-date':
      return '11TV est déjà à jour.';
    case 'failed':
      return 'La mise à jour a échoué :';
    case 'lost':
      return 'La Surface ne répond plus. Vérifiez la TV, ou redémarrez la Surface.';
  }
}

export function UpdateSettings() {
  const [view, setView] = useState<View | null>(null);
  const waiting = view?.state === 'running' || view?.state === 'restarting';

  useEffect(() => {
    fetchUpdateStatus()
      .then(setView)
      .catch(() => {
        // Sans cela, le bouton resterait grisé sans explication.
        setView({ state: 'unavailable', message: 'État de la mise à jour illisible.' });
      });
  }, []);

  // Suivi pendant la mise à jour, puis pendant le redémarrage du serveur.
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      fetchUpdateStatus()
        .then((next) => {
          if (view.state === 'restarting' && next.state !== 'running') {
            // Nouveau serveur : la page se recharge sur la nouvelle interface.
            try {
              sessionStorage.setItem(NOTICE_KEY, '1');
            } catch {
              /* Sans stockage, pas de message après le rechargement. */
            }
            window.location.reload();
            return;
          }
          setView(next);
        })
        .catch(() => {
          setView((prev) => {
            if (prev?.state === 'restarting') {
              return Date.now() - prev.since > RESTART_TIMEOUT_MS ? { state: 'lost' } : prev;
            }
            return { state: 'restarting', since: Date.now() };
          });
        });
    }, POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [waiting, view]);

  const launch = async () => {
    if (
      !window.confirm(
        'Mettre à jour 11TV ? Le serveur redémarre si une nouvelle version est installée.',
      )
    ) {
      return;
    }
    try {
      setView(await startUpdate());
    } catch {
      setView({
        state: 'failed',
        finishedAt: Date.now(),
        message: 'Impossible de joindre la Surface.',
      });
    }
  };

  return (
    <section class="card">
      <h2 class="card__title">Mise à jour</h2>
      <p class={view?.state === 'failed' || view?.state === 'lost' ? 'form-error' : 'muted'}>
        {describe(view)}
      </p>
      {view?.state === 'failed' && <pre class="update-log">{view.message}</pre>}
      <button
        type="button"
        class="button"
        disabled={!view || view.state === 'unavailable' || waiting}
        onClick={() => void launch()}
      >
        {waiting ? 'Mise à jour…' : 'Mettre à jour 11TV'}
      </button>
    </section>
  );
}
