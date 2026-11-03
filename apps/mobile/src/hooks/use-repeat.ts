import { useEffect, useRef } from 'preact/hooks';

const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 110;

/** Petite vibration de confirmation, si le téléphone le permet. */
export function haptic(): void {
  try {
    navigator.vibrate(8);
  } catch {
    // Pas de vibreur ou API absente : sans importance.
  }
}

/**
 * Bouton à répétition : une action à l'appui, puis répétée tant que le doigt reste posé
 * (flèches, volume). Renvoie les gestionnaires d'événements à poser sur le bouton.
 */
export function useRepeat(action: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const actionRef = useRef(action);
  actionRef.current = action;

  const stop = () => {
    window.clearTimeout(timer.current);
    window.clearInterval(timer.current);
    timer.current = undefined;
  };

  useEffect(() => stop, []);

  return {
    onPointerDown: (event: PointerEvent) => {
      event.preventDefault();
      stop();
      haptic();
      actionRef.current();
      timer.current = window.setTimeout(() => {
        timer.current = window.setInterval(() => {
          actionRef.current();
        }, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    // Le clic est déjà traité à l'appui ; on évite le menu contextuel de l'appui long.
    onContextMenu: (event: Event) => {
      event.preventDefault();
    },
  };
}
