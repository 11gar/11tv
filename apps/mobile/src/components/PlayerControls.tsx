import type { MusicAction } from '@11tv/shared';
import { haptic } from '../hooks/use-repeat';
import { NextIcon, PlayPauseIcon, PrevIcon } from './icons';

interface Props {
  playing: boolean;
  onAction: (action: MusicAction) => void;
}

/** Précédent, lecture/pause, suivant. */
export function PlayerControls({ playing, onAction }: Props) {
  const act = (action: MusicAction) => () => {
    haptic();
    onAction(action);
  };
  return (
    <div class="player-controls">
      <button
        type="button"
        class="round-button glass"
        aria-label="Titre précédent"
        onClick={act('previous')}
      >
        <PrevIcon />
      </button>
      <button
        type="button"
        class="round-button round-button--large glass"
        aria-label={playing ? 'Pause' : 'Lecture'}
        onClick={act('play-pause')}
      >
        <PlayPauseIcon playing={playing} />
      </button>
      <button
        type="button"
        class="round-button glass"
        aria-label="Titre suivant"
        onClick={act('next')}
      >
        <NextIcon />
      </button>
    </div>
  );
}
