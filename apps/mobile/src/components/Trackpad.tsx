import type { ClientMessage } from '@11tv/shared';
import { useEffect, useRef } from 'preact/hooks';
import { haptic } from '../hooks/use-repeat';
import { DeltaAccumulator, TrackpadGestures } from '../trackpad/gestures';

interface Props {
  send: (message: ClientMessage) => void;
}

/**
 * Zone tactile : les déplacements sont cumulés puis envoyés une fois par image affichée
 * (environ 60 par seconde), pour ne pas inonder le WebSocket.
 */
export function Trackpad({ send }: Props) {
  const sendRef = useRef(send);
  sendRef.current = send;
  const area = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const motion = new DeltaAccumulator();
    const wheel = new DeltaAccumulator();
    let frame = 0;

    const flush = () => {
      frame = 0;
      const m = motion.take();
      if (m) sendRef.current({ type: 'pointer-move', dx: m.dx, dy: m.dy });
      const w = wheel.take();
      if (w) sendRef.current({ type: 'pointer-scroll', dy: w.dy });
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(flush);
    };

    const gestures = new TrackpadGestures({
      move: (dx, dy) => {
        motion.add(dx, dy);
        schedule();
      },
      scroll: (dy) => {
        wheel.add(0, dy);
        schedule();
      },
      click: (button) => {
        flush();
        haptic();
        sendRef.current({ type: 'pointer-click', button });
      },
    });

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      gestures.down(e.pointerId, e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      gestures.move(e.pointerId, e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      gestures.up(e.pointerId);
    };
    const onCancel = (e: PointerEvent) => {
      gestures.cancel(e.pointerId);
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  return (
    <div class="trackpad-wrap">
      <div ref={area} class="trackpad" aria-label="Trackpad">
        <span class="trackpad__hint">
          Glisser : déplacer · Toucher : clic
          <br />
          Deux doigts : défiler · toucher à deux doigts : clic droit
        </span>
      </div>
      <div class="row">
        <button
          type="button"
          class="button button--secondary"
          onClick={() => {
            send({ type: 'pointer-click', button: 'left' });
          }}
        >
          Clic gauche
        </button>
        <button
          type="button"
          class="button button--secondary"
          onClick={() => {
            send({ type: 'pointer-click', button: 'right' });
          }}
        >
          Clic droit
        </button>
      </div>
    </div>
  );
}
