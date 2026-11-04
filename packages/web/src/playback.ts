import type { NowPlaying } from '@11tv/shared';
import { useEffect, useState } from 'preact/hooks';

/** 75 -> « 1:15 », 3725 -> « 1:02:05 ». */
export function formatTime(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h > 0 ? `${String(h)}:${String(m).padStart(2, '0')}:${s}` : `${String(m)}:${s}`;
}

/** Position estimée `elapsedMs` après la réception de l'état, bornée à la durée. */
export function estimatePosition(nowPlaying: NowPlaying, elapsedMs: number): number {
  const position = nowPlaying.positionSec + (nowPlaying.playing ? elapsedMs / 1000 : 0);
  return nowPlaying.durationSec > 0 ? Math.min(position, nowPlaying.durationSec) : position;
}

/**
 * Position de lecture, avancée localement : le serveur n'envoie l'état qu'aux changements
 * (titre, pause, saut), pas à chaque seconde.
 */
export function usePlaybackPosition(nowPlaying: NowPlaying | null): number {
  const [now, setNow] = useState(Date.now);
  const [receivedAt, setReceivedAt] = useState(Date.now);

  const positionSec = nowPlaying?.positionSec;
  const playing = nowPlaying?.playing ?? false;
  const videoId = nowPlaying?.videoId;
  useEffect(() => {
    const at = Date.now();
    setReceivedAt(at);
    setNow(at);
  }, [positionSec, playing, videoId]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [playing]);

  return nowPlaying ? estimatePosition(nowPlaying, now - receivedAt) : 0;
}
