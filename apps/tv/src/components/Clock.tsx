import { useEffect, useState } from 'preact/hooks';
import { usePixelShift } from '../hooks/use-pixel-shift';

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function Clock() {
  const [now, setNow] = useState(() => new Date());
  const shift = usePixelShift();

  useEffect(() => {
    // Recalé sur le début de chaque minute pour que l'heure change pile à l'heure.
    let timer = 0;
    const tick = () => {
      const date = new Date();
      setNow(date);
      timer = window.setTimeout(tick, 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds()));
    };
    tick();
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div class="clock" style={{ transform: shift }}>
      <div class="clock__time">{timeFormat.format(now)}</div>
      <div class="clock__date">{capitalize(dateFormat.format(now))}</div>
    </div>
  );
}
