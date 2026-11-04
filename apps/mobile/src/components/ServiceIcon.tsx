import type { ServiceId } from '@11tv/shared';
import type { JSX } from 'preact';

/**
 * Icônes d'application des services, dessinées en SVG (aucune image téléchargée) dans
 * l'esprit de leurs logos : de quoi les reconnaître d'un coup d'œil.
 */
const ICONS: Record<ServiceId, JSX.Element> = {
  'prime-video': (
    <>
      <rect width="100" height="100" fill="#1a7cf5" />
      <text
        x="50"
        y="45"
        text-anchor="middle"
        font-size="25"
        font-weight="700"
        fill="#fff"
        font-family="system-ui, sans-serif"
      >
        prime
      </text>
      <text
        x="50"
        y="66"
        text-anchor="middle"
        font-size="17"
        font-weight="500"
        fill="#fff"
        font-family="system-ui, sans-serif"
      >
        video
      </text>
      <path
        d="M27 73q23 11 46 0"
        stroke="#fff"
        stroke-width="3.5"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d="M67 69l7 3.6-4.6 6"
        stroke="#fff"
        stroke-width="3.5"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </>
  ),
  'youtube-music': (
    <>
      <rect width="100" height="100" fill="#ff0f3a" />
      <circle cx="50" cy="50" r="27" fill="none" stroke="#fff" stroke-width="3.5" />
      <path
        d="M43 39.5v21l18-10.5z"
        fill="#fff"
        stroke="#fff"
        stroke-width="2"
        stroke-linejoin="round"
      />
    </>
  ),
  youtube: (
    <>
      <rect width="100" height="100" fill="#fff" />
      <rect x="20" y="30" width="60" height="41" rx="12" fill="#ff0000" />
      <path d="M44 41v19l16-9.5z" fill="#fff" />
    </>
  ),
  'disney-plus': (
    <>
      <defs>
        <linearGradient id="disney-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0b2d48" />
          <stop offset="1" stop-color="#0e6a77" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#disney-bg)" />
      <path
        d="M18 41q32-18 64 3"
        stroke="#fff"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
      />
      <text
        x="42"
        y="62"
        text-anchor="middle"
        font-size="20"
        font-style="italic"
        font-weight="600"
        fill="#fff"
        font-family="Georgia, 'Times New Roman', serif"
      >
        Disney
      </text>
      <text
        x="85"
        y="62"
        text-anchor="middle"
        font-size="22"
        font-weight="300"
        fill="#fff"
        font-family="system-ui, sans-serif"
      >
        +
      </text>
    </>
  ),
};

export function ServiceIcon({ id }: { id: ServiceId }) {
  return (
    <svg class="service-icon__art" viewBox="0 0 100 100" aria-hidden="true">
      {ICONS[id]}
    </svg>
  );
}
