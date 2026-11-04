import type { MusicAction } from '@11tv/shared';

interface Props {
  playing: boolean;
  onAction: (action: MusicAction) => void;
  compact?: boolean;
}

/** Précédent, lecture/pause, suivant. En version compacte : lecture/pause seulement. */
export function PlayerControls({ playing, onAction, compact = false }: Props) {
  const playPause = (
    <button
      type="button"
      class="player-button player-button--main"
      aria-label={playing ? 'Pause' : 'Lecture'}
      onClick={(event) => {
        event.stopPropagation();
        onAction('play-pause');
      }}
    >
      {playing ? '❚❚' : '▶'}
    </button>
  );
  if (compact) return playPause;

  return (
    <div class="player-controls">
      <button
        type="button"
        class="player-button"
        aria-label="Titre précédent"
        onClick={() => {
          onAction('previous');
        }}
      >
        ⏮
      </button>
      {playPause}
      <button
        type="button"
        class="player-button"
        aria-label="Titre suivant"
        onClick={() => {
          onAction('next');
        }}
      >
        ⏭
      </button>
    </div>
  );
}
