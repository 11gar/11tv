import { useEffect, useState } from 'preact/hooks';

/** Décalage de quelques pixels toutes les 10 minutes, contre le marquage des écrans. */
const SHIFT_INTERVAL_MS = 10 * 60 * 1000;
const SHIFT_MAX_PX = 8;

function randomShift(): { x: number; y: number } {
  const r = () => Math.round((Math.random() * 2 - 1) * SHIFT_MAX_PX);
  return { x: r(), y: r() };
}

/** Transformation CSS à appliquer aux éléments qui restent longtemps à l'écran. */
export function usePixelShift(): string {
  const [shift, setShift] = useState(randomShift);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setShift(randomShift());
    }, SHIFT_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return `translate(${String(shift.x)}px, ${String(shift.y)}px)`;
}
