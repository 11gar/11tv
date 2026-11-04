import { rename, rm, stat } from 'node:fs/promises';

/**
 * Rotation simple par taille : 11tv.log devient 11tv.log.1, qui devient .2, etc. Les plus
 * anciens au-delà de `keep` sont supprimés. Renvoie vrai si le fichier a tourné (le flux
 * d'écriture doit alors être rouvert).
 */
export async function rotateIfLarger(
  file: string,
  maxBytes: number,
  keep: number,
): Promise<boolean> {
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return false;
  }
  if (size <= maxBytes) return false;

  await rm(`${file}.${String(keep)}`, { force: true });
  for (let i = keep - 1; i >= 1; i--) {
    await rename(`${file}.${String(i)}`, `${file}.${String(i + 1)}`).catch(() => undefined);
  }
  await rename(file, `${file}.1`);
  return true;
}
