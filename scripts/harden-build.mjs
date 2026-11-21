/* Paso posterior a `next build`: SRI + CSP por página + manifiesto de integridad. Ver docs/SEGURIDAD.md.
 *   CSP_CONNECT_SRC="https://crm.ejemplo.com"  → orígenes extra para fetch/XHR (cuando exista la API del CRM). */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { buildManifest, hardenHtml } from './lib/harden.mjs';

const OUT = 'out';
const MANIFEST = join('.integrity', 'manifest.json');

const toUrlPath = (file) => relative(OUT, file).split(sep).join(posix.sep);
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

let files;
try {
  files = walk(OUT);
} catch {
  console.error(`No existe la carpeta "${OUT}": corré primero "next build".`);
  process.exit(1);
}

const connect = (process.env.CSP_CONNECT_SRC ?? '').split(/\s+/).filter(Boolean);
const readAsset = (path) => {
  try {
    return readFileSync(join(OUT, path));
  } catch {
    return null;
  }
};

let pages = 0;
for (const file of files.filter((f) => f.endsWith('.html'))) {
  writeFileSync(file, hardenHtml(readFileSync(file, 'utf8'), readAsset, { connect }));
  pages += 1;
}

// El manifiesto se calcula después del endurecimiento y NO se publica (no está en out/): un manifiesto servido
// desde el mismo sitio que se quiere comprobar no probaría nada. Guardalo como artefacto del CI.
const all = new Map(walk(OUT).map((f) => [toUrlPath(f), readFileSync(f)]));
const manifest = buildManifest(all, { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null });
mkdirSync('.integrity', { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Endurecido: ${pages} páginas con SRI y CSP; manifiesto de ${all.size} archivos en ${MANIFEST}`);
