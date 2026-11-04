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
 * Carte « En cours de lecture » en bas de l'écran : pochette, titre, artiste et une fine
 * barre de progression collée au bord inférieur. En pause, son contenu est flouté sous un
 * pictogramme pause. Elle garde le dernier titre pendant son fondu de sortie.
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
  const classes = ['now-playing', 'glass'];
  if (!visible) classes.push('now-playing--hidden');
  if (!track.playing) classes.push('now-playing--paused');

  return (
    <section
      class={classes.join(' ')}
      style={{ transform: `translateX(-50%) ${shift}` }}
      aria-label={track.playing ? 'En cours de lecture' : 'En pause'}
      aria-hidden={!visible}
    >
      <div class="now-playing__content">
        <div class="now-playing__art">
          {track.artworkUrl && <img src={track.artworkUrl} alt="" />}
        </div>
        <div class="now-playing__text">
          <div class="now-playing__title">{track.title}</div>
          <div class="now-playing__artist">{track.artist}</div>
        </div>
      </div>
      {!track.playing && (
        <svg class="now-playing__pause" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />
        </svg>
      )}
      <div class="now-playing__progress">
        <div class="now-playing__bar" style={{ transform: `scaleX(${String(progress)})` }} />
      </div>
    </section>
  );
}
