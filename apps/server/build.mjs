// Regroupe le serveur en un seul fichier : les paquets du workspace (@11tv/*) sont inclus,
// les dépendances npm restent externes et sont chargées depuis node_modules.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@11tv/'));

for (const entry of ['index', 'cli/reset-pin']) {
  await build({
    entryPoints: [`src/${entry}.ts`],
    outfile: `dist/${entry}.js`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: true,
    external,
    logLevel: 'info',
  });
}
