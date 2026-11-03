import type { MouseButton } from '@11tv/shared';

export interface GestureOutput {
  move(dx: number, dy: number): void;
  click(button: MouseButton): void;
  scroll(dy: number): void;
}

export interface GestureOptions {
  /** Déplacement cumulé maximal (px) pour qu'un appui compte comme un tap. */
  tapMaxTravel: number;
  tapMaxMs: number;
}

const DEFAULT_OPTIONS: GestureOptions = { tapMaxTravel: 10, tapMaxMs: 250 };

/** Gain de base et accélération : les gestes rapides vont plus loin, les lents restent précis. */
const BASE_GAIN = 1.3;
const ACCEL_PX = 12;
const MAX_BOOST = 1.6;

export function accelerate(delta: number): number {
  return delta * BASE_GAIN * (1 + Math.min(Math.abs(delta) / ACCEL_PX, MAX_BOOST));
}

interface Session {
  startedAt: number;
  maxPointers: number;
  travel: number;
}

/**
 * Gestes du trackpad, à partir des événements de pointeur bruts :
 * - un doigt qui glisse déplace le curseur ;
 * - un tap = clic gauche, un tap à deux doigts = clic droit ;
 * - deux doigts qui glissent = molette.
 */
export class TrackpadGestures {
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private session: Session | null = null;

  constructor(
    private readonly out: GestureOutput,
    private readonly options: GestureOptions = DEFAULT_OPTIONS,
    private readonly now: () => number = () => performance.now(),
  ) {}

  down(id: number, x: number, y: number): void {
    if (this.pointers.size === 0)
      this.session = { startedAt: this.now(), maxPointers: 0, travel: 0 };
    this.pointers.set(id, { x, y });
    if (this.session)
      this.session.maxPointers = Math.max(this.session.maxPointers, this.pointers.size);
  }

  move(id: number, x: number, y: number): void {
    const last = this.pointers.get(id);
    if (!last || !this.session) return;
    const dx = x - last.x;
    const dy = y - last.y;
    this.pointers.set(id, { x, y });
    this.session.travel += Math.abs(dx) + Math.abs(dy);

    if (this.pointers.size >= 2) {
      // Chaque doigt contribue : la moyenne donne le déplacement des deux doigts.
      this.out.scroll(dy / this.pointers.size);
    } else if (this.session.maxPointers === 1) {
      // Après un geste à deux doigts, le doigt restant ne bouge plus le curseur.
      this.out.move(accelerate(dx), accelerate(dy));
    }
  }

  up(id: number): void {
    if (!this.pointers.delete(id) || this.pointers.size > 0 || !this.session) return;
    const { startedAt, maxPointers, travel } = this.session;
    this.session = null;
    const quick = this.now() - startedAt <= this.options.tapMaxMs;
    if (quick && travel <= this.options.tapMaxTravel) {
      this.out.click(maxPointers >= 2 ? 'right' : 'left');
    }
  }

  cancel(id: number): void {
    this.pointers.delete(id);
    if (this.pointers.size === 0) this.session = null;
  }
}

/**
 * Accumule des déplacements fractionnaires et n'émet que des pixels entiers : le reste est
 * conservé pour l'envoi suivant, sans dérive.
 */
export class DeltaAccumulator {
  private x = 0;
  private y = 0;

  add(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  take(): { dx: number; dy: number } | null {
    // « || 0 » : Math.trunc(-0.2) vaut -0, qu'on ne veut pas envoyer.
    const dx = Math.trunc(this.x) || 0;
    const dy = Math.trunc(this.y) || 0;
    if (dx === 0 && dy === 0) return null;
    this.x -= dx;
    this.y -= dy;
    return { dx, dy };
  }
}
