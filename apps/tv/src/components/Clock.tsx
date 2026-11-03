import { useEffect, useState } from 'preact/hooks';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Décalage de quelques pixels toutes les 10 minutes, contre le marquage des écrans. */
const SHIFT_INTERVAL_MS = 10 * 60 * 1000;
const SHIFT_MAX_PX = 8;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function randomShift(): { x: number; y: number } {
  const r = () => Math.round((Math.random() * 2 - 1) * SHIFT_MAX_PX);
  return { x: r(), y: r() };
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());
  const [shift, setShift] = useState(randomShift);

  useEffect(() => {
    // Recalé sur le début de chaque minute pour que l'heure change pile à l'heure.
    let timer = 0;
    const tick = () => {
      const date = new Date();
      setNow(date);
      timer = window.setTimeout(tick, 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds()));
    };
    tick();
    const shiftTimer = window.setInterval(() => {
      setShift(randomShift());
    }, SHIFT_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(shiftTimer);
    };
  }, []);

  return (
    <div class="clock" style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}>
      <div class="clock__time">{timeFormat.format(now)}</div>
      <div class="clock__date">{capitalize(dateFormat.format(now))}</div>
    </div>
  );
}
