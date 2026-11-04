import { TEXT_MAX_LENGTH, type ClientMessage, type RemoteKey } from '@11tv/shared';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '../hooks/use-repeat';

interface Props {
  send: (message: ClientMessage) => void;
}

/** Touches utiles hors saisie : sortir du plein écran, valider, lecture/pause… */
const KEYS: { label: string; message: ClientMessage }[] = [
  { label: 'Échap', message: { type: 'key', key: 'escape' } },
  { label: 'Entrée', message: { type: 'key', key: 'ok' } },
  { label: 'Espace ⏯', message: { type: 'key', key: 'space' } },
  { label: '⌫', message: { type: 'key', key: 'backspace' } },
  { label: 'Tab ⇥', message: { type: 'key', key: 'tab' } },
  { label: '↶ Page préc.', message: { type: 'history-back' } },
];

/**
 * Saisie de texte pour les champs de recherche : le texte est tapé sur le téléphone puis
 * inséré d'un coup dans le champ actif de la TV (cliquer d'abord dans le champ avec le
 * trackpad).
 */
export function KeyboardPanel({ send }: Props) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // Focus dès l'ouverture, dans la foulée de l'appui sur le bouton Clavier : sans ce geste
  // récent, Android n'ouvre pas le clavier virtuel (l'attribut autofocus ne suffit pas pour
  // un champ ajouté après le chargement de la page).
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const submit = (withEnter: boolean) => {
    if (!text) {
      if (withEnter) send({ type: 'key', key: 'ok' satisfies RemoteKey });
      return;
    }
    send({ type: 'text', text, submit: withEnter });
    setText('');
  };

  return (
    <div class="stack">
      <form
        class="keyboard"
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
      >
        <input
          ref={input}
          class="input glass"
          type="text"
          value={text}
          maxLength={TEXT_MAX_LENGTH}
          placeholder="Texte à envoyer à la TV"
          autocomplete="off"
          enterKeyHint="search"
          onInput={(e) => {
            setText(e.currentTarget.value);
          }}
        />
        <div class="row">
          <button type="submit" class="button glass">
            Envoyer + Entrée
          </button>
          <button
            type="button"
            class="button glass"
            onClick={() => {
              submit(false);
            }}
          >
            Envoyer
          </button>
        </div>
      </form>
      <div class="key-grid">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            class="button glass"
            onClick={() => {
              haptic();
              send(k.message);
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
