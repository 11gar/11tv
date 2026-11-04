import { useEffect, useState } from 'preact/hooks';
import { usePixelShift } from '../hooks/use-pixel-shift';

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

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
    </div>
  );
}
