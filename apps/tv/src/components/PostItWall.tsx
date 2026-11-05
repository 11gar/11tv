import type { CSSProperties } from 'preact';
import type { PostIt } from '@11tv/shared';
import { usePixelShift } from '../hooks/use-pixel-shift';

/** Inclinaison stable d'un post-it, tirée de son identifiant : entre -4° et 4°. */
export function tiltOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 81) - 40) / 10;
}

/** Taille d'écriture : un mot tient en gros, une phrase plus petit. */
function sizeOf(text: string): 'lg' | 'md' | 'sm' {
  if (text.length <= 24) return 'lg';
  if (text.length <= 60) return 'md';
  return 'sm';
}

/**
 * Post-it collés depuis le téléphone, à droite de l'accueil. Chacun arrive en se plaquant
 * sur l'écran ; l'ordre de lecture va du plus ancien au plus récent.
 */
export function PostItWall({ postIts }: { postIts: readonly PostIt[] }) {
  const shift = usePixelShift();
  if (postIts.length === 0) return null;
  return (
    <aside class="postits" aria-label="Post-it" style={{ transform: shift }}>
      {postIts.map((postIt, index) => (
        <div
          key={postIt.id}
          class={`postit postit--${postIt.color}`}
          style={
            {
              '--tilt': `${String(tiltOf(postIt.id))}deg`,
              '--delay': `${String(index * 90)}ms`,
            } as CSSProperties
          }
        >
          <span class="postit__tape" aria-hidden="true" />
          <p class={`postit__text postit__text--${sizeOf(postIt.text)}`}>{postIt.text}</p>
        </div>
      ))}
    </aside>
  );
}
