import type { MusicAction } from '@11tv/shared';
import { z } from 'zod';

// Scripts exécutés dans la page de YouTube Music. Ce sont des chaînes : le serveur n'a pas
// les types du DOM, et le résultat est de toute façon revalidé par zod en sortie.

/**
 * Ce que la page dit d'elle-même : `navigator.mediaSession` (titre, artiste, pochettes, que
 * YouTube Music tient à jour pour les commandes multimédias du système) et l'élément vidéo.
 */
export const SNAPSHOT_SCRIPT = `(() => {
  const meta = navigator.mediaSession && navigator.mediaSession.metadata;
  const video = document.querySelector('video');
  const area = (a) => {
    const [w, h] = String(a.sizes || '').split(/[x ]/i).map(Number);
    return (w || 0) * (h || 0);
  };
  const artwork = meta ? [...meta.artwork].sort((a, b) => area(b) - area(a))[0] : undefined;
  return {
    url: location.href,
    title: meta ? meta.title : '',
    artist: meta ? meta.artist : '',
    artwork: artwork ? artwork.src : null,
    playing: !!video && !video.paused && !video.ended,
    position: video ? video.currentTime : 0,
    duration: video && Number.isFinite(video.duration) ? video.duration : 0,
  };
})()`;

export const snapshotSchema = z.object({
  url: z.string(),
  title: z.string(),
  artist: z.string(),
  artwork: z.string().nullable(),
  playing: z.boolean(),
  position: z.number(),
  duration: z.number(),
});

export type PageSnapshot = z.infer<typeof snapshotSchema>;

/**
 * Commandes : l'API du lecteur (#movie_player) d'abord, les boutons de la barre de lecture
 * en repli si YouTube la change. Le script renvoie vrai si une commande a été trouvée.
 */
function control(playerCall: string, button: string): string {
  return `(() => {
  const player = document.querySelector('#movie_player');
  ${playerCall}
  const button = document.querySelector('ytmusic-player-bar ${button}');
  if (button) { button.click(); return true; }
  return false;
})()`;
}

export const CONTROL_SCRIPTS: Record<MusicAction, string> = {
  'play-pause': control(
    `if (player && typeof player.getPlayerState === 'function') {
    if (player.getPlayerState() === 1) player.pauseVideo(); else player.playVideo();
    return true;
  }`,
    '.play-pause-button',
  ),
  next: control(
    `if (player && typeof player.nextVideo === 'function') { player.nextVideo(); return true; }`,
    '.next-button',
  ),
  previous: control(
    `if (player && typeof player.previousVideo === 'function') { player.previousVideo(); return true; }`,
    '.previous-button',
  ),
};

export const PAUSE_SCRIPT = `(() => {
  const video = document.querySelector('video');
  if (video && !video.paused) video.pause();
  return true;
})()`;

/** Identifiants du titre et de la playlist, lus dans l'URL de la page. */
export function idsFromUrl(url: string): { videoId: string | null; playlistId: string | null } {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'music.youtube.com') return { videoId: null, playlistId: null };
    return {
      videoId: parsed.searchParams.get('v'),
      playlistId: parsed.searchParams.get('list'),
    };
  } catch {
    return { videoId: null, playlistId: null };
  }
}
