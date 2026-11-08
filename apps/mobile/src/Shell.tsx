import {
  getService,
  POSTITS_MODULE_ID,
  type AppState,
  type ClientMessage,
  type ServiceId,
  type VolumeAction,
} from '@11tv/shared';
import { ServiceIcon, useAppSocket, Wallpapers } from '@11tv/web';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { fetchSession } from './api';
import { Clock } from './components/Clock';
import { GearIcon, KeyboardIcon, VolumeDownIcon, VolumeUpIcon } from './components/icons';
import { KeyboardPanel } from './components/KeyboardPanel';
import { NowPlayingPill } from './components/NowPlayingPill';
import { PostItComposer } from './components/PostItComposer';
import { RepeatButton } from './components/RepeatButton';
import { Sheet } from './components/Sheet';
import { Trackpad } from './components/Trackpad';
import { consumeUpdateNotice } from './components/UpdateSettings';
import { haptic } from './hooks/use-repeat';
import { Music } from './screens/Music';
import { Settings } from './screens/Settings';

/** Ordre des icônes, trois par ligne. */
const SERVICE_ORDER: readonly ServiceId[] = [
  'prime-video',
  'youtube-music',
  'youtube',
  'disney-plus',
  'twitch',
  'browser',
];

type Panel = 'settings' | 'keyboard' | 'music' | 'postits';

const PANEL_TITLES: Record<Panel, string> = {
  settings: 'Réglages',
  keyboard: 'Clavier',
  music: 'Musique',
  postits: 'Post-it',
};

/** Ce que reçoivent les panneaux : l'état et un envoi qui prévient si la Surface est injoignable. */
export interface ScreenProps {
  state: AppState | null;
  send: (message: ClientMessage) => void;
  notify: (message: string) => void;
}

interface Props {
  onSessionLost: () => void;
}

const BROWSER_WARNINGS = {
  starting: 'Démarrage du navigateur…',
  unavailable: 'Navigateur de la TV indisponible',
} as const;

/**
 * Tout tient sur une page, comme l'écran de la TV : horloge (un appui ramène la TV à
 * l'accueil), services, trackpad avec ses boutons, et la musique en bas. Réglages, clavier et
 * lecteur complet s'ouvrent dans des panneaux.
 */
export function Shell({ onSessionLost }: Props) {
  const { state, status, error, send: rawSend } = useAppSocket<AppState>();
  const [panel, setPanel] = useState<Panel | null>(null);
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

  // Page rechargée après une mise à jour lancée depuis les réglages.
  useEffect(() => {
    const notice = consumeUpdateNotice();
    if (notice) notify(notice);
  }, [notify]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const closePanel = useCallback(() => {
    setPanel(null);
  }, []);
  const volume = (action: VolumeAction) => () => {
    send({ type: 'volume', action });
  };

  const screen: ScreenProps = { state, send, notify };
  const pointerAvailable = state?.pointerAvailable ?? true;
  // Le bouton post-it disparaît quand le module est éteint (Réglages → Modules).
  const postItsOn = state?.modules.find((m) => m.id === POSTITS_MODULE_ID)?.enabled ?? true;
  const notice =
    status !== 'open'
      ? 'Hors ligne'
      : state && state.browser !== 'ready'
        ? BROWSER_WARNINGS[state.browser]
        : null;

  return (
    <div class="shell">
      <div class="backdrop">
        <Wallpapers images={state?.wallpapers ?? []} intervalSec={state?.slideIntervalSec ?? 30} />
      </div>

      <main class="home">
        {postItsOn && (
          <button
            type="button"
            class="postit-fab"
            aria-label="Coller un post-it sur la TV"
            onClick={() => {
              haptic();
              setPanel('postits');
            }}
          >
            <span class="postit-fab__note" aria-hidden="true">
              +
            </span>
            {(state?.postIts.length ?? 0) > 0 && (
              <span class="postit-fab__count">{state?.postIts.length}</span>
            )}
          </button>
        )}
        <button
          type="button"
          class="clock-button"
          aria-label="Ramener la TV à l’accueil"
          onClick={() => {
            haptic();
            send({ type: 'home' });
          }}
        >
          <Clock />
        </button>
        {notice && <p class="notice glass">{notice}</p>}

        <nav class="services" aria-label="Services">
          {SERVICE_ORDER.map(getService).map((service) => (
            <button
              key={service.id}
              type="button"
              class={
                state?.view === service.id ? 'service-icon service-icon--active' : 'service-icon'
              }
              aria-label={service.name}
              onClick={() => {
                haptic();
                send({ type: 'launch', service: service.id });
                // Le navigateur vide attend une adresse : le clavier s'ouvre directement.
                if (service.id === 'browser') setPanel('keyboard');
              }}
            >
              <ServiceIcon id={service.id} />
            </button>
          ))}
        </nav>

        <section class="remote" aria-label="Télécommande">
          {pointerAvailable ? (
            <Trackpad send={send} />
          ) : (
            <div class="trackpad glass trackpad--off">Souris indisponible sur la Surface</div>
          )}
          <div class="remote__buttons">
            <button
              type="button"
              class="square-button glass"
              aria-label="Réglages"
              onClick={() => {
                setPanel('settings');
              }}
            >
              <GearIcon />
            </button>
            <RepeatButton
              class="square-button glass"
              label="Monter le volume"
              onPress={volume('up')}
            >
              <VolumeUpIcon />
            </RepeatButton>
            <RepeatButton
              class="square-button glass"
              label="Baisser le volume"
              onPress={volume('down')}
            >
              <VolumeDownIcon />
            </RepeatButton>
            <button
              type="button"
              class="square-button glass"
              aria-label="Clavier"
              onClick={() => {
                setPanel('keyboard');
              }}
            >
              <KeyboardIcon />
            </button>
          </div>
        </section>

        <NowPlayingPill
          music={state?.music}
          video={state?.video}
          send={send}
          onOpen={() => {
            setPanel('music');
          }}
        />
      </main>

      {panel && (
        <Sheet title={PANEL_TITLES[panel]} onClose={closePanel}>
          {panel === 'settings' && <Settings {...screen} onLogout={onSessionLost} />}
          {panel === 'keyboard' && <KeyboardPanel send={send} />}
          {panel === 'music' && <Music {...screen} />}
          {panel === 'postits' && <PostItComposer {...screen} />}
        </Sheet>
      )}

      {toast && (
        <div key={toast.id} class="toast glass glass--strong" role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
