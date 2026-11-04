import { NOW_PLAYING_IDLE_HIDE_MS, type NowPlaying } from '@11tv/shared';
import { useEffect, useRef, useState } from 'preact/hooks';
import { usePixelShift } from '../hooks/use-pixel-shift';

interface Props {
  nowPlaying: NowPlaying | null;
}

/** Vrai pendant la lecture, et encore un moment après une mise en pause. */
function useVisible(nowPlaying: NowPlaying | null): boolean {
  const [idle, setIdle] = useState(false);
  const active = nowPlaying !== null;
  const playing = nowPlaying?.playing ?? false;

  useEffect(() => {
    setIdle(false);
    if (!active || playing) return;
    const timer = window.setTimeout(() => {
      setIdle(true);
    }, NOW_PLAYING_IDLE_HIDE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [active, playing]);

  return active && !idle;
}

/**
 * Pastille « En cours de lecture » en bas de l'écran : pochette, titre, artiste et l'état
 * de lecture. Elle garde le dernier titre pendant son fondu de sortie.
 */
export function NowPlayingBar({ nowPlaying }: Props) {
  const visible = useVisible(nowPlaying);
  const shift = usePixelShift();
  const lastShown = useRef<NowPlaying | null>(null);
  if (visible && nowPlaying) lastShown.current = nowPlaying;
  const track = visible ? nowPlaying : lastShown.current;
  if (!track) return null;

  return (
    <section
      class={visible ? 'now-playing glass' : 'now-playing now-playing--hidden glass'}
      style={{ transform: `translateX(-50%) ${shift}` }}
      aria-label="En cours de lecture"
      aria-hidden={!visible}
    >
      <div class="now-playing__art">
        {track.artworkUrl && <img src={track.artworkUrl} alt="" />}
      </div>
      <div class="now-playing__text">
        <div class="now-playing__title">{track.title}</div>
        <div class="now-playing__artist">{track.artist}</div>
      </div>
      <svg
        class="now-playing__state"
        viewBox="0 0 24 24"
        aria-label={track.playing ? 'Lecture' : 'En pause'}
      >
        {track.playing ? (
          <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" />
        ) : (
          <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />
        )}
      </svg>
    </section>
  );
}
