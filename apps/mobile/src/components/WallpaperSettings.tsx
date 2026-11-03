import { WALLPAPER_ACCEPT, type ClientMessage, type Wallpaper } from '@11tv/shared';
import { useRef, useState } from 'preact/hooks';
import { uploadWallpaper } from '../api';

interface Props {
  wallpapers: Wallpaper[];
  send: (message: ClientMessage) => void;
  notify: (message: string) => void;
}

/** Déplace l'élément `index` de `delta` places (-1 = vers le haut). */
export function moveItem<T>(items: readonly T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(target, 0, item);
  return next;
}

export function WallpaperSettings({ wallpapers, send, notify }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const upload = async (files: File[]) => {
    let failures = 0;
    setProgress({ done: 0, total: files.length });
    // Un par un : les images d'un téléphone sont lourdes et la Surface les réencode.
    for (const [i, file] of files.entries()) {
      try {
        const result = await uploadWallpaper(file);
        if (!result.ok) {
          failures++;
          notify(`${file.name} : ${result.message}`);
        }
      } catch {
        failures++;
        notify(`${file.name} : envoi impossible`);
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (failures === 0) {
      notify(files.length > 1 ? `${String(files.length)} images ajoutées` : 'Image ajoutée');
    }
  };

  const reorder = (index: number, delta: number) => {
    const order = moveItem(
      wallpapers.map((w) => w.id),
      index,
      delta,
    );
    send({ type: 'reorder-wallpapers', order });
  };

  return (
    <section class="card">
      <h2 class="card__title">Fonds d’écran</h2>

      <input
        ref={input}
        type="file"
        accept={WALLPAPER_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.currentTarget.files ?? [])];
          e.currentTarget.value = '';
          if (files.length > 0) void upload(files);
        }}
      />
      <button
        type="button"
        class="button button--wide"
        disabled={progress !== null}
        onClick={() => input.current?.click()}
      >
        {progress
          ? `Envoi ${String(progress.done + 1)} / ${String(progress.total)}…`
          : '+ Ajouter des images'}
      </button>

      {wallpapers.length === 0 ? (
        <p class="muted">Aucune image : la TV affiche un dégradé.</p>
      ) : (
        <ul class="wallpapers">
          {wallpapers.map((wallpaper, index) => (
            <li key={wallpaper.id} class="wallpaper-row">
              <img class="wallpaper-row__thumb" src={wallpaper.thumbUrl} alt="" loading="lazy" />
              <div class="wallpaper-row__actions">
                <button
                  type="button"
                  class="icon-button"
                  aria-label="Monter"
                  disabled={index === 0}
                  onClick={() => {
                    reorder(index, -1);
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  class="icon-button"
                  aria-label="Descendre"
                  disabled={index === wallpapers.length - 1}
                  onClick={() => {
                    reorder(index, 1);
                  }}
                >
                  ▼
                </button>
                <button
                  type="button"
                  class="icon-button icon-button--danger"
                  aria-label="Supprimer"
                  onClick={() => {
                    if (confirm('Supprimer cette image ?')) {
                      send({ type: 'delete-wallpaper', id: wallpaper.id });
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
