/* Paso posterior a `next build`: SRI + CSP por página + manifiesto de integridad. Ver docs/SEGURIDAD.md.
 *   CSP_CONNECT_SRC="https://crm.ejemplo.com"  → orígenes extra para fetch/XHR.
 *   NEXT_PUBLIC_CRM_URL="https://api.ejemplo.com"  → la API del CRM: su origen entra solo en connect-src (no hace falta repetirlo arriba).
 *   NEXT_PUBLIC_TURNSTILE_SITEKEY=…  → con la API activa, admite el widget de Turnstile (script-src, frame-src y connect-src). */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { buildManifest, crmOrigin, hardenHtml } from './lib/harden.mjs';

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

// Las mismas dos variables que activan la conexión en el navegador (src/model/crm.ts): una sola fuente, sin que puedan desfasarse.
const api = crmOrigin(process.env.NEXT_PUBLIC_CRM_URL ?? '');
const turnstile = Boolean(api && process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY);
const connect = [...new Set([...(process.env.CSP_CONNECT_SRC ?? '').split(/\s+/).filter(Boolean), ...(api ? [api] : [])])];
const readAsset = (path) => {
  try {
    return readFileSync(join(OUT, path));
  } catch {
    return null;
  }
};

let pages = 0;
for (const file of files.filter((f) => f.endsWith('.html'))) {
  writeFileSync(file, hardenHtml(readFileSync(file, 'utf8'), readAsset, { connect, turnstile }));
  pages += 1;
}

// El manifiesto se calcula después del endurecimiento y NO se publica (no está en out/): un manifiesto servido
// desde el mismo sitio que se quiere comprobar no probaría nada. Guardalo como artefacto del CI.
const all = new Map(walk(OUT).map((f) => [toUrlPath(f), readFileSync(f)]));
const manifest = buildManifest(all, { commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null });
mkdirSync('.integrity', { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`CRM: ${api ? `${api}${turnstile ? ' + Turnstile' : ' (sin Turnstile: no se activa la conexión)'}` : 'sin conexión (NEXT_PUBLIC_CRM_URL vacío)'}`);
console.log(`Endurecido: ${pages} páginas con SRI y CSP; manifiesto de ${all.size} archivos en ${MANIFEST}`);
