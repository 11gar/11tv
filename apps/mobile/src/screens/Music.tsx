import type { NowPlaying, RecentTrack } from '@11tv/shared';
import { formatTime, usePlaybackPosition } from '@11tv/web';
import { Artwork } from '../components/Artwork';
import { PlayerControls } from '../components/PlayerControls';
import type { ScreenProps } from '../Shell';

function Player({ nowPlaying, send }: { nowPlaying: NowPlaying } & Pick<ScreenProps, 'send'>) {
  const position = usePlaybackPosition(nowPlaying);
  const progress = nowPlaying.durationSec > 0 ? position / nowPlaying.durationSec : 0;
  return (
    <section class="player">
      <Artwork url={nowPlaying.artworkUrl} class="artwork--large" />
      <div class="player__text">
        <strong class="player__title">{nowPlaying.title}</strong>
        <span class="muted">{nowPlaying.artist}</span>
      </div>
      <div>
        <div class="progress">
          <div class="progress__bar" style={{ transform: `scaleX(${String(progress)})` }} />
        </div>
        <div class="player__times muted">
          <span>{formatTime(position)}</span>
          <span>{formatTime(nowPlaying.durationSec)}</span>
        </div>
      </div>
      <PlayerControls
        playing={nowPlaying.playing}
        onAction={(action) => {
          send({ type: 'music', action });
        }}
      />
    </section>
  );
}

function RecentList({ tracks, send }: { tracks: RecentTrack[] } & Pick<ScreenProps, 'send'>) {
  if (tracks.length === 0) {
    return <p class="muted">Les titres écoutés sur la TV apparaîtront ici.</p>;
  }
  return (
    <ul class="track-list">
      {tracks.map((track) => (
        <li key={track.videoId}>
          <button
            type="button"
            class="track-row"
            onClick={() => {
              send({ type: 'play-track', videoId: track.videoId, playlistId: track.playlistId });
            }}
          >
            <Artwork url={track.artworkUrl} class="artwork--small" />
            <span class="track-text">
              <span class="track-text__title">{track.title}</span>
              <span class="track-text__artist">{track.artist}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Contenu du lecteur complet : titre en cours, commandes et titres écoutés récemment. */
export function Music({ state, send }: ScreenProps) {
  const nowPlaying = state?.music.nowPlaying ?? null;
  const onTv = state?.view === 'youtube-music';

  return (
    <div class="stack">
      {nowPlaying && <Player nowPlaying={nowPlaying} send={send} />}
      <button
        type="button"
        class="button glass button--wide"
        disabled={onTv}
        onClick={() => {
          send({ type: 'launch', service: 'youtube-music' });
        }}
      >
        {onTv ? 'YouTube Music est affiché sur la TV' : 'Afficher YouTube Music sur la TV'}
      </button>
      <section class="stack stack--tight">
        <h3 class="section-title">Écouté récemment</h3>
        <RecentList tracks={state?.music.recent ?? []} send={send} />
      </section>
    </div>
  );
}
