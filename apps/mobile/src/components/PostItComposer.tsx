import {
  POSTIT_COLORS,
  POSTIT_MAX,
  POSTIT_TEXT_MAX,
  type PostIt,
  type PostItColor,
} from '@11tv/shared';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '../hooks/use-repeat';
import type { ScreenProps } from '../Shell';

const COLOR_NAMES: Record<PostItColor, string> = {
  yellow: 'Jaune',
  pink: 'Rose',
  blue: 'Bleu',
  green: 'Vert',
  orange: 'Orange',
};

/** Autocollants ajoutés d'un appui à la fin du texte. */
const STICKERS = ['❤️', '🎉', '😘', '🛒', '⏰', '🍕', '✅'];

/** Durée de l'envol du post-it vers la TV (styles.css, postit-fly). */
const FLY_MS = 450;

/**
 * Écrire un post-it et le coller sur la TV : on écrit directement sur le papier, on choisit
 * sa couleur, et il s'envole vers la TV. Ceux déjà collés se décollent d'un appui.
 */
export function PostItComposer({ state, send, notify }: ScreenProps) {
  const [text, setText] = useState('');
  const [color, setColor] = useState<PostItColor>('yellow');
  const [flying, setFlying] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const postIts: PostIt[] = state?.postIts ?? [];
  const trimmed = text.trim();

  // Clavier ouvert tout de suite : écrire un post-it doit prendre trois secondes.
  useLayoutEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const stick = () => {
    if (!trimmed || flying) return;
    haptic();
    send({ type: 'add-postit', text: trimmed, color });
    setFlying(true);
    window.setTimeout(() => {
      setFlying(false);
      setText('');
      notify('Collé sur la TV !');
      input.current?.focus({ preventScroll: true });
    }, FLY_MS);
  };

  const addSticker = (sticker: string) => {
    setText((current) =>
      `${current}${current && !current.endsWith(' ') ? ' ' : ''}${sticker}`.slice(
        0,
        POSTIT_TEXT_MAX,
      ),
    );
    input.current?.focus({ preventScroll: true });
  };

  return (
    <div class="stack">
      <div class={`postit-editor postit-paper--${color}${flying ? ' postit-editor--flying' : ''}`}>
        <textarea
          ref={input}
          class="postit-editor__input"
          placeholder="Un petit mot pour la TV…"
          maxLength={POSTIT_TEXT_MAX}
          rows={4}
          value={text}
          onInput={(e) => {
            setText(e.currentTarget.value);
          }}
        />
        <span class="postit-editor__count">
          {text.length}/{POSTIT_TEXT_MAX}
        </span>
      </div>

      <div class="postit-colors" role="radiogroup" aria-label="Couleur du post-it">
        {POSTIT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === color}
            aria-label={COLOR_NAMES[c]}
            class={`postit-swatch postit-paper--${c}${c === color ? ' postit-swatch--active' : ''}`}
            onClick={() => {
              haptic();
              setColor(c);
              // Le clavier reste ouvert : on continue d'écrire après avoir choisi la couleur.
              input.current?.focus({ preventScroll: true });
            }}
          />
        ))}
      </div>

      <div class="postit-stickers" aria-label="Autocollants">
        {STICKERS.map((sticker) => (
          <button
            key={sticker}
            type="button"
            class="postit-sticker"
            onClick={() => {
              addSticker(sticker);
            }}
          >
            {sticker}
          </button>
        ))}
      </div>

      <button
        type="button"
        class="button button--wide"
        disabled={!trimmed || flying}
        onClick={stick}
      >
        Coller sur la TV
      </button>
      {postIts.length >= POSTIT_MAX && (
        <p class="muted postit-hint">La TV est pleine : le plus ancien post-it sera décollé.</p>
      )}

      {postIts.length > 0 && (
        <section class="stack stack--tight">
          <h3 class="section-title">
            Sur la TV ({postIts.length}/{POSTIT_MAX})
          </h3>
          <ul class="postit-board">
            {[...postIts].reverse().map((postIt) => (
              <li key={postIt.id}>
                <button
                  type="button"
                  class={`postit-mini postit-paper--${postIt.color}`}
                  aria-label={`Décoller : ${postIt.text}`}
                  onClick={() => {
                    haptic();
                    send({ type: 'remove-postit', id: postIt.id });
                  }}
                >
                  <span class="postit-mini__text">{postIt.text}</span>
                  <span class="postit-mini__remove" aria-hidden="true">
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p class="muted postit-hint">Touchez un post-it pour le décoller.</p>
          {postIts.length > 1 && (
            <button
              type="button"
              class="link"
              onClick={() => {
                if (window.confirm('Décoller tous les post-it de la TV ?')) {
                  send({ type: 'clear-postits' });
                }
              }}
            >
              Tout décoller
            </button>
          )}
        </section>
      )}
    </div>
  );
}
