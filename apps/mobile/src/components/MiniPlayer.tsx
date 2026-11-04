import type { MusicAction, NowPlaying } from '@11tv/shared';
import { usePlaybackPosition } from '@11tv/web';
import { Artwork } from './Artwork';
import { PlayerControls } from './PlayerControls';

interface Props {
  nowPlaying: NowPlaying;
  onAction: (action: MusicAction) => void;
  onOpen: () => void;
}

/** Lecteur réduit, au-dessus des onglets, visible depuis tous les écrans sauf Musique. */
export function MiniPlayer({ nowPlaying, onAction, onOpen }: Props) {
  const position = usePlaybackPosition(nowPlaying);
  const progress = nowPlaying.durationSec > 0 ? position / nowPlaying.durationSec : 0;
  return (
    <div
      class="mini-player"
      role="button"
      tabIndex={0}
      aria-label={`En cours : ${nowPlaying.title}. Ouvrir la musique`}
      onClick={onOpen}
    >
      <Artwork url={nowPlaying.artworkUrl} class="artwork--small" />
      <div class="track-text">
        <span class="track-text__title">{nowPlaying.title}</span>
        <span class="track-text__artist">{nowPlaying.artist}</span>
      </div>
      <PlayerControls playing={nowPlaying.playing} onAction={onAction} compact />
      <div class="mini-player__progress" style={{ transform: `scaleX(${String(progress)})` }} />
    </div>
  );
}
