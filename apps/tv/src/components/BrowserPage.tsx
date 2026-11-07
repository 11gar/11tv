import { useEffect, useRef } from 'preact/hooks';
import { destinationFor } from './browser-destination';

/**
 * Navigateur vide : une barre d'adresse au milieu de l'écran, qui garde le focus pour
 * recevoir le texte tapé avec le clavier du téléphone. Entrée ouvre la page.
 */
export function BrowserPage() {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => input.current?.focus();
    focus();
    // Un clic à côté (trackpad du téléphone) ne doit pas faire perdre la saisie.
    window.addEventListener('focus', focus);
    document.addEventListener('pointerup', focus);
    return () => {
      window.removeEventListener('focus', focus);
      document.removeEventListener('pointerup', focus);
    };
  }, []);

  return (
    <main class="browser-page">
      <form
        class="browser-page__bar glass"
        onSubmit={(event) => {
          event.preventDefault();
          const url = destinationFor(input.current?.value ?? '');
          if (url) window.location.assign(url);
        }}
      >
        <svg class="browser-page__icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          class="browser-page__input"
          type="text"
          autocomplete="off"
          spellcheck={false}
          placeholder="Rechercher ou saisir une adresse"
          aria-label="Adresse ou recherche"
        />
      </form>
      <p class="browser-page__hint">Tapez depuis le clavier du téléphone, puis Entrée.</p>
    </main>
  );
}
