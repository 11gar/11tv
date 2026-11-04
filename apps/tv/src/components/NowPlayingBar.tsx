import { NOW_PLAYING_IDLE_HIDE_MS, type NowPlaying } from '@11tv/shared';
import { usePlaybackPosition } from '@11tv/web';
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
 * Barre « En cours de lecture » de l'écran d'accueil : pochette, titre, artiste et une fine
 * ligne de progression. Elle garde le dernier titre pendant son fondu de sortie.
 */
export function NowPlayingBar({ nowPlaying }: Props) {
  const visible = useVisible(nowPlaying);
  const shift = usePixelShift();
  const lastShown = useRef<NowPlaying | null>(null);
  if (visible && nowPlaying) lastShown.current = nowPlaying;
  const track = visible ? nowPlaying : lastShown.current;
  const position = usePlaybackPosition(track);

  if (!track) return null;
  const progress = track.durationSec > 0 ? Math.min(1, position / track.durationSec) : 0;

  return (
    <section
      class={visible ? 'now-playing' : 'now-playing now-playing--hidden'}
      style={{ transform: shift }}
      aria-label="En cours de lecture"
      aria-hidden={!visible}
    >
      <div class="now-playing__art">
        {track.artworkUrl && <img src={track.artworkUrl} alt="" />}
        {!track.playing && (
          <span class="now-playing__paused" aria-label="En pause">
            ❚❚
          </span>
        )}
      </div>
      <div class="now-playing__text">
        <div class="now-playing__title">{track.title}</div>
        <div class="now-playing__artist">{track.artist}</div>
        <div class="now-playing__progress">
          <div class="now-playing__bar" style={{ transform: `scaleX(${String(progress)})` }} />
        </div>
      </div>
    </section>
  );
}
