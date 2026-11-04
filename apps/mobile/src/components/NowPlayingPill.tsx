import type { MusicState } from '@11tv/shared';
import { haptic } from '../hooks/use-repeat';
import type { ScreenProps } from '../Shell';
import { Artwork } from './Artwork';
import { PlayPauseIcon } from './icons';

interface Props {
  music: MusicState | undefined;
  send: ScreenProps['send'];
  onOpen: () => void;
}

/**
 * Pastille musique en bas de l'écran. Sans lecture en cours, elle propose de reprendre le
 * dernier titre écouté, ou d'ouvrir YouTube Music. Un appui ailleurs que sur le bouton
 * ouvre le lecteur complet.
 */
export function NowPlayingPill({ music, send, onOpen }: Props) {
  const nowPlaying = music?.nowPlaying ?? null;
  const last = music?.recent[0];

  const track = nowPlaying ?? last ?? null;
  const playing = nowPlaying?.playing ?? false;
  const subtitle = track ? track.artist : 'Rien en cours';

  const onButton = (e: Event) => {
    e.stopPropagation();
    haptic();
    if (nowPlaying) send({ type: 'music', action: 'play-pause' });
    else if (last) send({ type: 'play-track', videoId: last.videoId, playlistId: last.playlistId });
    else send({ type: 'launch', service: 'youtube-music' });
  };

  return (
    <div
      class="pill glass"
      role="button"
      tabIndex={0}
      aria-label="Ouvrir le lecteur de musique"
      onClick={onOpen}
    >
      <Artwork url={track?.artworkUrl ?? null} class="artwork--small" />
      <div class="pill__text">
        <span class="pill__title">{track ? track.title : 'YouTube Music'}</span>
        <span class="pill__subtitle">{subtitle}</span>
      </div>
      <button
        type="button"
        class="pill__button"
        aria-label={playing ? 'Pause' : 'Lecture'}
        onClick={onButton}
      >
        <PlayPauseIcon playing={playing} />
      </button>
    </div>
  );
}
