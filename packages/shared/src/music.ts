export const MUSIC_ACTIONS = ['play-pause', 'next', 'previous'] as const;
export type MusicAction = (typeof MUSIC_ACTIONS)[number];

/** Identifiants YouTube : vidéo sur 11 caractères, playlist plus longue. */
export const VIDEO_ID_PATTERN = /^[\w-]{11}$/;
export const PLAYLIST_ID_PATTERN = /^[\w-]{2,80}$/;

/** Nombre de titres gardés dans « Écouté récemment ». */
export const MUSIC_HISTORY_MAX = 20;

/** Après cette durée en pause, la barre « En cours de lecture » s'efface de la TV. */
export const NOW_PLAYING_IDLE_HIDE_MS = 5 * 60_000;

export interface NowPlaying {
  videoId: string | null;
  title: string;
  artist: string;
  /** Pochette relayée par le serveur local (même origine que la page), ou null. */
  artworkUrl: string | null;
  playing: boolean;
  /** Position au moment de l'envoi de l'état ; les clients l'avancent eux-mêmes en lecture. */
  positionSec: number;
  durationSec: number;
}

export interface RecentTrack {
  videoId: string;
  playlistId: string | null;
  title: string;
  artist: string;
  artworkUrl: string | null;
}

export interface MusicState {
  nowPlaying: NowPlaying | null;
  recent: RecentTrack[];
}

/** URL YouTube Music d'un titre, éventuellement dans sa playlist. */
export function musicTrackUrl(videoId: string, playlistId: string | null): string {
  const url = new URL('https://music.youtube.com/watch');
  url.searchParams.set('v', videoId);
  if (playlistId) url.searchParams.set('list', playlistId);
  return url.toString();
}
