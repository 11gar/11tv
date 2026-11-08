import type { NowPlaying } from './music';
import type { ServiceId } from './services';

export const VIDEO_ACTIONS = ['play-pause'] as const;
export type VideoAction = (typeof VIDEO_ACTIONS)[number];

/**
 * Lecture dans la fenêtre des services (YouTube, Twitch, Disney+…), qui continue quand la TV
 * revient à l'accueil. Même forme que la musique, plus le service d'où elle vient.
 */
export interface VideoNowPlaying extends NowPlaying {
  service: ServiceId | null;
}

export type ActiveNowPlaying =
  { kind: 'music'; track: NowPlaying } | { kind: 'video'; track: VideoNowPlaying };

/**
 * Ce que montrent les cartes « en cours » : ce qui joue (la vidéo d'abord, une seule source
 * joue à la fois), sinon ce qui est en pause, la vidéo d'abord (la plus récente en général).
 */
export function activeNowPlaying(
  music: NowPlaying | null,
  video: VideoNowPlaying | null,
): ActiveNowPlaying | null {
  if (video?.playing) return { kind: 'video', track: video };
  if (music?.playing) return { kind: 'music', track: music };
  if (video) return { kind: 'video', track: video };
  if (music) return { kind: 'music', track: music };
  return null;
}
