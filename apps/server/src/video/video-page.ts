import { z } from 'zod';

// Scripts exécutés dans la fenêtre des services (YouTube, Twitch, Disney+…). Ce sont des
// chaînes : le serveur n'a pas les types du DOM, et le résultat est revalidé par zod.

/**
 * Média suivi : un élément <video> ou <audio> chargé et audible (les aperçus muets des pages
 * d'accueil ne comptent pas), celui qui joue d'abord, puis le plus grand à l'écran.
 */
const FIND_MEDIA = `const media = [...document.querySelectorAll('video, audio')]
    .filter((m) => m.readyState > 0 && !m.muted && m.volume > 0 && (m.currentSrc || m.srcObject))
    .sort((a, b) => (Number(!b.paused) - Number(!a.paused))
      || (b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight))[0];`;

/**
 * Ce que la page dit d'elle-même : \`navigator.mediaSession\` (titre, chaîne, image, que la
 * plupart des sites tiennent à jour pour les commandes multimédias du système), le titre du
 * document en repli, et le média suivi.
 */
export const VIDEO_SNAPSHOT_SCRIPT = `(() => {
  ${FIND_MEDIA}
  const meta = navigator.mediaSession && navigator.mediaSession.metadata;
  const area = (a) => {
    const [w, h] = String(a.sizes || '').split(/[x ]/i).map(Number);
    return (w || 0) * (h || 0);
  };
  const artwork = meta ? [...meta.artwork].sort((a, b) => area(b) - area(a))[0] : undefined;
  return {
    url: location.href,
    documentTitle: document.title,
    title: meta ? meta.title : '',
    artist: meta ? meta.artist : '',
    artwork: artwork ? artwork.src : null,
    hasMedia: !!media,
    playing: !!media && !media.paused && !media.ended,
    position: media ? media.currentTime : 0,
    duration: media && Number.isFinite(media.duration) ? media.duration : 0,
  };
})()`;

export const videoSnapshotSchema = z.object({
  url: z.string(),
  documentTitle: z.string(),
  title: z.string(),
  artist: z.string(),
  artwork: z.string().nullable(),
  hasMedia: z.boolean(),
  playing: z.boolean(),
  position: z.number(),
  duration: z.number(),
});

export type VideoSnapshot = z.infer<typeof videoSnapshotSchema>;

/** Lecture ou pause du média suivi. Renvoie vrai si un média a été trouvé. */
export const VIDEO_PLAY_PAUSE_SCRIPT = `(() => {
  ${FIND_MEDIA}
  if (!media) return false;
  if (media.paused) media.play().catch(() => undefined); else media.pause();
  return true;
})()`;

/** Met en pause tout ce qui joue avec du son (avant la musique ou un autre service). */
export const VIDEO_PAUSE_SCRIPT = `(() => {
  for (const m of document.querySelectorAll('video, audio')) if (!m.paused && !m.muted) m.pause();
  return true;
})()`;

/**
 * Titre lisible à partir du titre du document : sans le compteur de notifications
 * (« (3) … ») ni le nom du site en suffixe (« … - YouTube »).
 */
export function cleanDocumentTitle(title: string, serviceName: string | null): string {
  let clean = title.replace(/^\(\d+\+?\)\s*/, '').trim();
  if (serviceName) {
    const suffix = new RegExp(`\\s*[-|–—]\\s*${escapeRegExp(serviceName)}$`, 'i');
    clean = clean.replace(suffix, '').trim();
  }
  return clean;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
