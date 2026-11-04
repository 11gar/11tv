import type { AppState, ClientMessage } from '@11tv/shared';
import { useAppSocket } from '@11tv/web';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { fetchSession } from './api';
import { MiniPlayer } from './components/MiniPlayer';
import { Home } from './screens/Home';
import { Music } from './screens/Music';
import { Remote } from './screens/Remote';
import { Settings } from './screens/Settings';

type Tab = 'home' | 'remote' | 'music' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Accueil', icon: '⌂' },
  { id: 'remote', label: 'Télécommande', icon: '✥' },
  { id: 'music', label: 'Musique', icon: '♫' },
  { id: 'settings', label: 'Réglages', icon: '⚙' },
];

const TAB_STORAGE_KEY = '11tv.tab';

function loadTab(): Tab {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((t) => t.id === saved) ? (saved as Tab) : 'home';
  } catch {
    return 'home';
  }
}

function saveTab(tab: Tab): void {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Stockage indisponible (navigation privée…) : l'onglet ne sera simplement pas retenu.
  }
}

/** Ce que reçoivent les écrans : l'état et un envoi qui prévient si la Surface est injoignable. */
export interface ScreenProps {
  state: AppState | null;
  send: (message: ClientMessage) => void;
  notify: (message: string) => void;
}

interface Props {
  onSessionLost: () => void;
}

export function Shell({ onSessionLost }: Props) {
  const { state, status, error, send: rawSend } = useAppSocket<AppState>();
  const [tab, setTab] = useState<Tab>(loadTab);
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null);

  const notify = useCallback((message: string) => {
    setToast((prev) => ({ message, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const send = useCallback(
    (message: ClientMessage) => {
      if (!rawSend(message)) notify('Pas de connexion avec la Surface.');
    },
    [rawSend, notify],
  );

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
    if (error) notify(error.message);
  }, [error, notify]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const screen: ScreenProps = { state, send, notify };
  const nowPlaying = state?.music.nowPlaying ?? null;
  const showMiniPlayer = nowPlaying !== null && tab !== 'music';
  const selectTab = (next: Tab) => {
    setTab(next);
    saveTab(next);
  };

  return (
    <div class={showMiniPlayer ? 'shell shell--mini-player' : 'shell'}>
      <header class="shell__header">
        <h1 class="shell__title">11TV</h1>
        <span class={`dot dot--${status}`} title={status === 'open' ? 'Connecté' : 'Hors ligne'} />
      </header>

      <main class="shell__content">
        {tab === 'home' && <Home {...screen} />}
        {tab === 'remote' && <Remote {...screen} />}
        {tab === 'music' && <Music {...screen} />}
        {tab === 'settings' && <Settings {...screen} onLogout={onSessionLost} />}
      </main>

      {showMiniPlayer && (
        <MiniPlayer
          nowPlaying={nowPlaying}
          onAction={(action) => {
            send({ type: 'music', action });
          }}
          onOpen={() => {
            selectTab('music');
          }}
        />
      )}

      <nav class="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            class={t.id === tab ? 'tabbar__item tabbar__item--active' : 'tabbar__item'}
            onClick={() => {
              selectTab(t.id);
            }}
          >
            <span class="tabbar__icon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && (
        <div key={toast.id} class="toast" role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
