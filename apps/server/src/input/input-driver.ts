import type { MouseButton, VolumeAction } from '@11tv/shared';

/**
 * Entrées au niveau du système (souris, volume), là où CDP ne suffit pas : un vrai curseur
 * visible pour le trackpad et le volume principal de Windows.
 */
export interface InputDriver {
  readonly available: boolean;
  moveMouse(dx: number, dy: number): void;
  click(button: MouseButton): void;
  /** Molette : valeur positive = vers le haut (unités Windows, 120 par cran). */
  scroll(delta: number): void;
  volume(action: VolumeAction): void;
}

/** Pilote vide, utilisé hors Windows ou si user32.dll n'a pas pu être chargé. */
export class NullInputDriver implements InputDriver {
  readonly available = false;
  moveMouse(): void {
    // Rien à faire : la télécommande désactive le trackpad quand available est faux.
  }
  click(): void {
    // Idem.
  }
  scroll(): void {
    // Idem.
  }
  volume(): void {
    // Idem.
  }
}
