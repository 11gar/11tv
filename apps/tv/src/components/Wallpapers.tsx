import type { Wallpaper } from '@11tv/shared';
import { useEffect, useRef, useState } from 'preact/hooks';

interface Layer {
  url: string;
  key: number;
}

interface Props {
  images: Wallpaper[];
  intervalSec: number;
}

/**
 * Fonds d'écran en fondu enchaîné. Chaque nouvelle image est décodée avant d'être posée
 * par-dessus la précédente (pas de flash), et on ne garde que deux calques en mémoire.
 */
export function Wallpapers({ images, intervalSec }: Props) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const position = useRef(-1);
  const counter = useRef(0);
  const urls = images.map((image) => image.url);
  const urlsKey = urls.join('\n');

  useEffect(() => {
    if (urls.length === 0) {
      setLayers([]);
      position.current = -1;
      return;
    }

    let cancelled = false;
    const show = async (index: number) => {
      const url = urls[index];
      if (!url) return;
      const img = new Image();
      img.src = url;
      try {
        await img.decode();
      } catch {
        return; // Image illisible : on passera à la suivante au prochain tour.
      }
      if (cancelled) return;
      position.current = index;
      setLayers((prev) => [...prev.slice(-1), { url, key: ++counter.current }]);
    };

    // Liste modifiée : on reste sur l'image affichée si elle existe encore.
    const current = layers.at(-1)?.url;
    const kept = current ? urls.indexOf(current) : -1;
    if (kept >= 0) position.current = kept;
    else void show(0);

    const timer = window.setInterval(() => {
      if (urls.length > 1) void show((position.current + 1) % urls.length);
    }, intervalSec * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // urlsKey résume `urls` : on ne relance l'effet que si la liste change vraiment.
  }, [urlsKey, intervalSec]);

  if (layers.length === 0) return <div class="wallpaper wallpaper--fallback" />;

  return (
    <>
      {layers.map((layer) => (
        <div key={layer.key} class="wallpaper" style={{ backgroundImage: `url("${layer.url}")` }} />
      ))}
    </>
  );
}
