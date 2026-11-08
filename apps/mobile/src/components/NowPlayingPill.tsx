import { activeNowPlaying, type MusicState, type VideoNowPlaying } from '@11tv/shared';
import { ServiceIcon } from '@11tv/web';
import { haptic } from '../hooks/use-repeat';
import type { ScreenProps } from '../Shell';
import { Artwork } from './Artwork';
import { PlayPauseIcon } from './icons';

interface Props {
  music: MusicState | undefined;
  video: VideoNowPlaying | null | undefined;
  send: ScreenProps['send'];
  onOpen: () => void;
}

/**
 * Pastille « en cours » en bas de l'écran.
 *
 * Une vidéo en cours (qui continue en arrière-plan quand la TV revient à l'accueil) y prend
 * la place de la musique : le bouton la met en pause ou la relance, un appui ailleurs la
 * ramène sur la TV.
 *
 * Sinon, c'est la musique : sans lecture en cours, la pastille propose de reprendre le
 * dernier titre écouté, ou d'ouvrir YouTube Music. Un appui ailleurs que sur le bouton ouvre
 * le lecteur complet.
 */
export function NowPlayingPill({ music, video, send, onOpen }: Props) {
  const active = activeNowPlaying(music?.nowPlaying ?? null, video ?? null);
  if (active?.kind === 'video') {
    const track = active.track;
    return (
      <div
        class="pill glass"
        role="button"
        tabIndex={0}
        aria-label="Afficher la vidéo sur la TV"
        onClick={() => {
          haptic();
          send({ type: 'show-video' });
        }}
      >
        {track.artworkUrl || !track.service ? (
          <Artwork url={track.artworkUrl} class="artwork--small" />
        ) : (
          <div class="artwork artwork--small">
            <ServiceIcon id={track.service} />
          </div>
        )}
        <div class="pill__text">
          <span class="pill__title">{track.title}</span>
          <span class="pill__subtitle">{track.artist}</span>
        </div>
        <button
          type="button"
          class="pill__button"
          aria-label={track.playing ? 'Pause' : 'Lecture'}
          onClick={(e) => {
            e.stopPropagation();
            haptic();
            send({ type: 'video', action: 'play-pause' });
          }}
        >
          <PlayPauseIcon playing={track.playing} />
        </button>
      </div>
    );
  }

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
