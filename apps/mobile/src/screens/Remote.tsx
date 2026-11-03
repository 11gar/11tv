import type { RemoteKey, VolumeAction } from '@11tv/shared';
import { useState } from 'preact/hooks';
import { KeyboardPanel } from '../components/KeyboardPanel';
import { RepeatButton } from '../components/RepeatButton';
import { Trackpad } from '../components/Trackpad';
import { haptic } from '../hooks/use-repeat';
import type { ScreenProps } from '../Shell';

type Mode = 'pad' | 'trackpad' | 'keyboard';

const MODES: { id: Mode; label: string }[] = [
  { id: 'pad', label: 'Pavé' },
  { id: 'trackpad', label: 'Trackpad' },
  { id: 'keyboard', label: 'Clavier' },
];

export function Remote({ state, send }: ScreenProps) {
  const [mode, setMode] = useState<Mode>('pad');
  const key = (k: RemoteKey) => () => {
    send({ type: 'key', key: k });
  };
  const volume = (action: VolumeAction) => () => {
    send({ type: 'volume', action });
  };
  const pointerAvailable = state?.pointerAvailable ?? true;

  return (
    <div class="stack">
      <div class="segmented" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={m.id === mode}
            class={m.id === mode ? 'segmented__item segmented__item--active' : 'segmented__item'}
            onClick={() => {
              setMode(m.id);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'pad' && (
        <>
          <div class="dpad">
            <RepeatButton class="dpad__key dpad__up" label="Haut" onPress={key('up')}>
              ▲
            </RepeatButton>
            <RepeatButton class="dpad__key dpad__left" label="Gauche" onPress={key('left')}>
              ◀
            </RepeatButton>
            <button
              type="button"
              class="dpad__ok"
              onClick={() => {
                haptic();
                send({ type: 'key', key: 'ok' });
              }}
            >
              OK
            </button>
            <RepeatButton class="dpad__key dpad__right" label="Droite" onPress={key('right')}>
              ▶
            </RepeatButton>
            <RepeatButton class="dpad__key dpad__down" label="Bas" onPress={key('down')}>
              ▼
            </RepeatButton>
          </div>

          <div class="grid-3">
            <button type="button" class="button button--secondary" onClick={key('escape')}>
              Retour
            </button>
            <button type="button" class="button button--secondary" onClick={key('space')}>
              ⏯ Lecture
            </button>
            <button
              type="button"
              class="button button--secondary"
              onClick={() => {
                send({ type: 'history-back' });
              }}
            >
              ↶ Précédent
            </button>
            <button type="button" class="button button--secondary" onClick={key('shift-tab')}>
              ⇤ Élément
            </button>
            <button
              type="button"
              class="button button--secondary"
              onClick={() => {
                send({ type: 'home' });
              }}
            >
              ⌂ Accueil
            </button>
            <button type="button" class="button button--secondary" onClick={key('tab')}>
              Élément ⇥
            </button>
          </div>
        </>
      )}

      {mode === 'trackpad' &&
        (pointerAvailable ? (
          <Trackpad send={send} />
        ) : (
          <p class="warning">La souris n’est pas disponible sur la Surface.</p>
        ))}

      {mode === 'keyboard' && <KeyboardPanel send={send} />}

      <div class="volume">
        <RepeatButton class="volume__key" label="Baisser le volume" onPress={volume('down')}>
          −
        </RepeatButton>
        <button
          type="button"
          class="volume__key"
          aria-label="Couper le son"
          disabled={!pointerAvailable}
          onClick={volume('mute')}
        >
          🔇
        </button>
        <RepeatButton class="volume__key" label="Monter le volume" onPress={volume('up')}>
          +
        </RepeatButton>
      </div>
    </div>
  );
}
