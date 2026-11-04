// Icônes « pleines » (fond jusqu'aux bords) à partir de public/icon-maskable.svg :
//  - maskable-icon-512x512.png : Android découpe lui-même la forme (cercle, carré arrondi…).
//    Le préréglage du générateur y met le logo arrondi sur une marge blanche, d'où un
//    contour blanc autour de l'icône sur le téléphone.
//  - apple-touch-icon-180x180.png : iOS arrondit lui-même les coins.
// Lancé après pwa-assets-generator par « pnpm icons », dont il remplace ces deux fichiers.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// sharp vient avec le générateur d'icônes : pas de dépendance de plus.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('@vite-pwa/assets-generator'))('sharp');

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const source = path.join(publicDir, 'icon-maskable.svg');

for (const [file, size] of [
  ['maskable-icon-512x512.png', 512],
  ['apple-touch-icon-180x180.png', 180],
]) {
  await sharp(source, { density: 300 }).resize(size, size).png().toFile(path.join(publicDir, file));
  console.log(`✔ ${file}`);
}
