import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { CloseIcon } from './icons';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

/** Panneau qui monte du bas de l'écran, par-dessus la télécommande (réglages, clavier…). */
export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <section
        class="sheet glass glass--strong"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <header class="sheet__header">
          <h2 class="sheet__title">{title}</h2>
          <button type="button" class="round-button glass" aria-label="Fermer" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div class="sheet__content">{children}</div>
      </section>
    </div>
  );
}
