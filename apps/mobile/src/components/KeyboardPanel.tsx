import { TEXT_MAX_LENGTH, type ClientMessage } from '@11tv/shared';
import { useState } from 'preact/hooks';

interface Props {
  send: (message: ClientMessage) => void;
}

/**
 * Saisie de texte pour les champs de recherche : le texte est tapé sur le téléphone puis
 * inséré d'un coup dans le champ actif de la TV (cliquer d'abord dans le champ de recherche).
 */
export function KeyboardPanel({ send }: Props) {
  const [text, setText] = useState('');

  const submit = (withEnter: boolean) => {
    if (!text) {
      if (withEnter) send({ type: 'key', key: 'ok' });
      return;
    }
    send({ type: 'text', text, submit: withEnter });
    setText('');
  };

  return (
    <form
      class="keyboard"
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
    >
      <input
        class="input"
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
        <button type="submit" class="button">
          Envoyer + Entrée
        </button>
        <button
          type="button"
          class="button button--secondary"
          onClick={() => {
            submit(false);
          }}
        >
          Envoyer
        </button>
      </div>
      <div class="row">
        <button
          type="button"
          class="button button--secondary"
          onClick={() => {
            send({ type: 'key', key: 'backspace' });
          }}
        >
          ⌫ Effacer
        </button>
        <button
          type="button"
          class="button button--secondary"
          onClick={() => {
            send({ type: 'key', key: 'tab' });
          }}
        >
          Tab ⇥
        </button>
      </div>
    </form>
  );
}
