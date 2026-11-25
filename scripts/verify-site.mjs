/* Verifica el sitio contra la política de seguridad. Ver docs/SEGURIDAD.md.
 *
 *   node scripts/verify-site.mjs --dir out                       tras el build (revisa también vercel.json)
 *   node scripts/verify-site.mjs --url https://dominio           sobre lo publicado (encabezados incluidos)
 *   … --manifest .integrity/manifest.json                        compara además con el manifiesto del build
 *   … --skip-headers                                             no revisa los encabezados HTTP (para ensayar contra un
 *                                                                 servidor local, que no aplica vercel.json)
 *   node scripts/verify-site.mjs --url https://dominio --build-id  imprime el identificador de build publicado
 *                                                                 (el commit) y no verifica nada más
 *
 * Sale con código 1 si algo no cumple. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { buildIdOf, checkHeaders, checkHtml, compareWithManifest, localPath } from './lib/harden.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = opt('--dir');
const url = opt('--url')?.replace(/\/+$/, '');
const manifestFile = opt('--manifest');
if (!dir === !url) {
  console.error('Indicá una sola fuente: --dir <carpeta> o --url <https://dominio>');
  process.exit(2);
}

if (args.includes('--build-id')) {
  // Para el CI: saber qué commit está publicado y reconstruirlo. El valor viene del sitio, así que se imprime
  // solo si tiene forma de identificador; quien lo use debe volver a validarlo.
  if (!url) {
    console.error('--build-id requiere --url');
    process.exit(2);
  }
  const res = await fetch(`${url}/es/`);
  const id = res.ok ? buildIdOf(await res.text()) : null;
  if (!id) {
    console.error('No se pudo leer el identificador de build del sitio publicado');
    process.exit(1);
  }
  console.log(id);
  process.exit(0);
}

const problems = [];
const fail = (where, list) => list.forEach((p) => problems.push(`${where}: ${p}`));
const fetched = new Map(); // ruta → bytes (lo que se comprobó), para compararlo con el manifiesto

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

async function readAsset(path) {
  if (dir) {
    const file = join(dir, path);
    return existsSync(file) ? readFileSync(file) : null;
  }
  const res = await fetch(url + path);
  return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

let pages;
if (dir) {
  pages = walk(dir).filter((f) => f.endsWith('.html')).map((f) => '/' + relative(dir, f).split(sep).join(posix.sep));
} else {
  pages = ['/', '/es/', '/pt/', '/en/', '/es/tarifas/', '/pt/tarifas/', '/en/tarifas/'];
}

for (const page of pages) {
  let html;
  if (dir) html = readFileSync(join(dir, page), 'utf8');
  else {
    const res = await fetch(url + page);
    if (!res.ok) {
      fail(page, [`respondió ${res.status}`]);
      continue;
    }
    html = await res.text();
    if (!args.includes('--skip-headers')) fail(page, checkHeaders(Object.fromEntries(res.headers)));
    fetched.set(page.endsWith('/') ? `${page.slice(1)}index.html` : page.slice(1), Buffer.from(html));
  }
  if (dir) fetched.set(page.slice(1), Buffer.from(html));
  fail(page, await checkHtml(html, readAsset));
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const path = localPath(m[1]);
    if (path && /^\/_next\//.test(path) && !fetched.has(path.slice(1))) {
      const bytes = await readAsset(path);
      if (bytes) fetched.set(path.slice(1), bytes);
    }
  }
}

if (dir) {
  // Con --dir no hay respuesta HTTP: los encabezados salen de vercel.json, que es lo que Vercel aplicará.
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const headers = Object.fromEntries((config.headers ?? []).flatMap((h) => h.headers.map((x) => [x.key, x.value])));
  fail('vercel.json', checkHeaders(headers));
}

if (manifestFile) {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  // Con --dir se compara la carpeta entera; con --url, solo lo que se descargó (las páginas y sus scripts y estilos).
  const actual = dir ? new Map(walk(dir).map((f) => [relative(dir, f).split(sep).join(posix.sep), readFileSync(f)])) : fetched;
  const diff = compareWithManifest(manifest, actual, { complete: Boolean(dir) });
  fail('manifiesto', [
    ...diff.changed.map((p) => `alterado: ${p}`),
    ...diff.extra.map((p) => `no está en el manifiesto: ${p}`),
    ...diff.missing.map((p) => `falta: ${p}`),
  ]);
}

if (problems.length) {
  console.error(`✗ ${problems.length} problema(s):\n` + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${pages.length} página(s) y ${fetched.size} archivo(s) verificados${manifestFile ? ' contra el manifiesto' : ''}`);
