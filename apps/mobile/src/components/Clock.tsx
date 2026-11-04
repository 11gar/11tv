import { useEffect, useState } from 'preact/hooks';

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Heure, mise à jour au début de chaque minute. */
export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
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

  return <span class="clock">{timeFormat.format(now)}</span>;
}
