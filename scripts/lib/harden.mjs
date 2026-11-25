/* ============================================================
 * SEGURIDAD — Endurecimiento del sitio estático (funciones puras, sin dependencias).
 *
 * El sitio se publica como archivos estáticos, así que no hay servidor que genere un nonce por visita.
 * En su lugar, después de `next build`:
 *   1. cada <script src>, hoja de estilos y precarga local recibe `integrity` (SRI, sha256);
 *   2. cada <script> en línea, cada <style> y cada atributo style="…" se hashea y su hash se agrega a la
 *      política CSP de esa página (sin 'unsafe-inline' en ningún caso);
 *   3. la política viaja en un <meta http-equiv="Content-Security-Policy"> como primer hijo de <head>
 *      (lo que un meta no puede expresar —frame-ancestors, upgrade-insecure-requests— va en vercel.json);
 *   4. se genera un manifiesto con el hash de cada archivo, para poder comprobar más tarde que lo
 *      publicado es lo que se construyó.
 * Ver docs/SEGURIDAD.md.
 * ============================================================ */
import { createHash } from 'node:crypto';

export const ALGORITHM = 'sha256';

/**
 * Único origen externo que admite la política: el widget anti-bots de Cloudflare (docs/INTEGRACIONES.md, I-2). Su script
 * no puede llevar SRI porque el proveedor lo actualiza: es una concesión consciente, acotada a este origen exacto y solo
 * en los builds que activan la conexión con el CRM (`NEXT_PUBLIC_TURNSTILE_SITEKEY`).
 */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * Origen (https) de la API del CRM a partir de `NEXT_PUBLIC_CRM_URL`, o '' si no sirve. `http` solo para localhost, para probar.
 * Hace lo mismo que `crmOrigin` de src/model/crm.ts (el navegador y el build tienen que coincidir): una prueba las compara.
 */
export function crmOrigin(url) {
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && local) ? parsed.origin : '';
  } catch {
    return '';
  }
}

/** Valor `integrity` (SRI) de unos bytes: "sha256-<base64>". */
export function sri(data) {
  return `${ALGORITHM}-${createHash(ALGORITHM).update(data).digest('base64')}`;
}

const TAG_RE = /<(script|link)\b([^>]*?)(\/?)>/gi;
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const CSP_META_RE = /<meta\b[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi;
const EXECUTABLE_TYPES = new Set(['text/javascript', 'application/javascript', 'module']);

const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  return m ? (m[1] ?? m[2]) : null;
};
const hasAttr = (attrs, name) => new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, 'i').test(attrs);

/** Ruta local de un recurso (sin consulta ni ancla), o null si es externo (http:, //, data:…). */
export function localPath(url) {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return null;
  return decodeURIComponent(url.split(/[?#]/)[0]);
}

/** Cuerpos de los <script> en línea que ejecutan código (se omiten los vacíos y los bloques de datos). */
export function inlineScripts(html) {
  const bodies = [];
  for (const m of html.matchAll(SCRIPT_RE)) {
    if (hasAttr(m[1], 'src')) continue;
    const type = attr(m[1], 'type')?.toLowerCase();
    if (type && !EXECUTABLE_TYPES.has(type)) continue;
    if (m[2] !== '') bodies.push(m[2]);
  }
  return bodies;
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Valor de un atributo tal como lo ve el navegador (entidades HTML resueltas): es lo que la CSP hashea.
 * Resuelve las entidades que genera React (&amp; &lt; &gt; &quot; &#x27;) y las numéricas. Ante cualquier otra
 * corta el build: un hash calculado sobre un texto distinto del que ve el navegador dejaría el estilo bloqueado.
 */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (Number.isInteger(code) && code > 0 && code <= 0x10ffff) return String.fromCodePoint(code);
    } else if (entity.toLowerCase() in NAMED_ENTITIES) {
      return NAMED_ENTITIES[entity.toLowerCase()];
    }
    throw new Error(`Entidad HTML no soportada en un atributo style: ${match}`);
  });
}

/**
 * Estilos en línea de una página: cuerpos de los <style> y valores de los atributos style="…".
 * Los <script> y <style> se vacían antes de buscar atributos, porque su texto puede contener marcado ajeno
 * (p. ej. la carga de datos de React) que no es HTML de la página.
 */
export function inlineStyles(html) {
  const elements = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) if (m[1] !== '') elements.push(m[1]);
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const attributes = [];
  for (const tag of markup.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const value = attr(tag, 'style');
    if (value !== null && value !== '') attributes.push(decodeEntities(value));
  }
  return { elements, attributes };
}

const hashOf = (text) => `'${sri(Buffer.from(text, 'utf8'))}'`;
const unique = (list) => [...new Set(list)].sort();

/** Recursos que el navegador carga y que pueden llevar `integrity`. */
function resourceOf(name, attrs) {
  if (name.toLowerCase() === 'script') {
    const src = attr(attrs, 'src');
    return src ? { kind: 'script', url: src } : { kind: null, url: null }; // sin src: script en línea (se hashea aparte)
  }
  const rel = (attr(attrs, 'rel') ?? '').toLowerCase();
  const as = (attr(attrs, 'as') ?? '').toLowerCase();
  const href = attr(attrs, 'href');
  if (rel === 'stylesheet') return { kind: 'style', url: href };
  if (rel === 'modulepreload') return { kind: 'script', url: href };
  if (rel === 'preload' && (as === 'script' || as === 'style')) return { kind: as, url: href };
  return { kind: null, url: null };
}

/**
 * Política de contenido para una página. `scriptBodies` son sus scripts en línea; `styles` sus estilos en línea
 * (ver `inlineStyles`). `connect` agrega orígenes permitidos para fetch/XHR (por ejemplo, la API del CRM).
 * `turnstile: true` admite el widget de Cloudflare: su origen exacto en `script-src`, `frame-src` y `connect-src`.
 * No incluye `frame-ancestors` ni `upgrade-insecure-requests`: un <meta> no los admite (van en vercel.json).
 *
 * Estilos: ni `<style>` ni `style="…"` se admiten "en general". Cada uno se permite por su hash. Los atributos
 * necesitan `'unsafe-hashes'` y su propia directiva (`style-src-attr`). Los estilos que React aplica después de
 * hidratar usan la API CSSOM (`element.style.x = …`), que la CSP no bloquea.
 */
export function buildCsp(scriptBodies, { connect = [], styles = { elements: [], attributes: [] }, turnstile = false } = {}) {
  const scriptHashes = unique(scriptBodies.map(hashOf));
  const external = turnstile ? [TURNSTILE_ORIGIN] : [];
  const elementHashes = unique(styles.elements.map(hashOf));
  const attrHashes = unique(styles.attributes.map(hashOf));
  return [
    "default-src 'self'",
    ['script-src', "'self'", ...external, ...scriptHashes].join(' '),
    ['style-src', "'self'", ...elementHashes].join(' '),
    attrHashes.length ? ['style-src-attr', "'unsafe-hashes'", ...attrHashes].join(' ') : "style-src-attr 'none'",
    "img-src 'self'",
    "font-src 'self'",
    ['connect-src', "'self'", ...new Set([...connect, ...external])].join(' '),
    turnstile ? `frame-src ${TURNSTILE_ORIGIN}` : "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

/**
 * Agrega SRI a los recursos locales y la política CSP a una página.
 * `readAsset(rutaLocal)` devuelve los bytes del archivo (o null si no existe, lo que corta el build).
 * Es idempotente: volver a correrla sobre su propio resultado no cambia nada.
 */
export function hardenHtml(html, readAsset, options = {}) {
  let out = html.replace(TAG_RE, (tag, name, attrs, close) => {
    const { kind, url } = resourceOf(name, attrs);
    const path = kind ? localPath(url) : null;
    if (!path || hasAttr(attrs, 'integrity')) return tag;
    const bytes = readAsset(path);
    if (!bytes) throw new Error(`Recurso no encontrado para calcular su integridad: ${path}`);
    return `<${name}${attrs} integrity="${sri(bytes)}"${close}>`;
  });

  out = out.replace(CSP_META_RE, '');
  const csp = buildCsp(inlineScripts(out), { ...options, styles: inlineStyles(out) });
  const head = /<head\b[^>]*>/i.exec(out);
  if (!head) throw new Error('La página no tiene <head>: no se puede insertar la política de contenido');
  const at = head.index + head[0].length;
  out = `${out.slice(0, at)}<meta http-equiv="Content-Security-Policy" content="${csp}"/>${out.slice(at)}`;
  return out;
}

/** Directivas de una política: { 'script-src': ["'self'", …], … }. */
export function parseCsp(csp) {
  const map = {};
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map[name.toLowerCase()] = values;
  }
  return map;
}

/**
 * Revisa una página ya endurecida y devuelve la lista de problemas (vacía = cumple).
 * `readAsset` puede ser asíncrona (verificación contra el sitio publicado).
 */
export async function checkHtml(html, readAsset) {
  const problems = [];

  const metas = [...html.matchAll(CSP_META_RE)];
  if (metas.length !== 1) {
    problems.push(`Debe haber exactamente una política CSP en <meta> (hay ${metas.length})`);
  } else {
    const csp = parseCsp(attr(metas[0][0], 'content') ?? '');
    const scriptSrc = csp['script-src'] ?? [];
    if (!scriptSrc.length) problems.push('La política no define script-src');
    for (const bad of ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'blob:', 'http:', 'https:']) {
      if (scriptSrc.includes(bad)) problems.push(`script-src admite ${bad}`);
    }
    if (scriptSrc.some((v) => /^https?:\/\//i.test(v) && v !== TURNSTILE_ORIGIN)) problems.push('script-src admite un origen externo');
    for (const body of inlineScripts(html)) {
      const hash = `'${sri(Buffer.from(body, 'utf8'))}'`;
      if (!scriptSrc.includes(hash)) problems.push(`Script en línea sin hash en la política: ${JSON.stringify(body.slice(0, 50))}…`);
    }
    // Estilos: nada "en general" (sin 'unsafe-inline'); cada <style> y cada style="…" debe estar permitido por hash.
    const styleSrc = csp['style-src'] ?? [];
    const styleAttr = csp['style-src-attr'] ?? [];
    for (const [name, list] of [['style-src', styleSrc], ['style-src-attr', styleAttr]]) {
      if (!list.length) problems.push(`La política no define ${name}`);
      if (list.includes("'unsafe-inline'")) problems.push(`${name} admite 'unsafe-inline'`);
    }
    const styles = inlineStyles(html);
    for (const body of styles.elements) {
      if (!styleSrc.includes(hashOf(body))) problems.push(`<style> sin hash en la política: ${JSON.stringify(body.slice(0, 40))}…`);
    }
    if (styles.attributes.length && !styleAttr.includes("'unsafe-hashes'")) problems.push("style-src-attr necesita 'unsafe-hashes'");
    for (const value of styles.attributes) {
      if (!styleAttr.includes(hashOf(value))) problems.push(`Atributo style sin hash en la política: ${JSON.stringify(value.slice(0, 40))}…`);
    }
    for (const [directive, expected] of [['object-src', "'none'"], ['base-uri', "'none'"]]) {
      if (!(csp[directive] ?? []).includes(expected)) problems.push(`Falta ${directive} ${expected}`);
    }
    // Marcos: ninguno, o solo el widget de Turnstile y nada más (ni junto a otros orígenes).
    const frameSrc = csp['frame-src'] ?? [];
    if (!(frameSrc.length === 1 && (frameSrc[0] === "'none'" || frameSrc[0] === TURNSTILE_ORIGIN))) {
      problems.push(`Falta frame-src 'none' (o solo ${TURNSTILE_ORIGIN})`);
    }
  }

  for (const m of html.matchAll(TAG_RE)) {
    const [, name, attrs] = m;
    const { kind, url } = resourceOf(name, attrs);
    if (!kind) continue;
    const path = localPath(url);
    if (!path) {
      problems.push(`Recurso ${kind} externo o no local: ${url}`);
      continue;
    }
    const integrity = attr(attrs, 'integrity');
    if (!integrity) {
      problems.push(`Sin integrity: ${path}`);
      continue;
    }
    const bytes = await readAsset(path);
    if (!bytes) problems.push(`Recurso no encontrado: ${path}`);
    else if (sri(bytes) !== integrity) problems.push(`La integridad no coincide (¿archivo alterado?): ${path}`);
  }

  // Marcado que una política estricta no admitiría o que abre la puerta a contenido ajeno.
  for (const tag of html.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const bare = tag.replace(/"[^"]*"|'[^']*'/g, '""');
    if (/\son[a-z]+\s*=/i.test(bare)) problems.push(`Atributo de evento en línea: ${tag.slice(0, 60)}`);
    if (/<(iframe|object|embed|base)\b/i.test(bare)) problems.push(`Elemento no permitido: ${tag.slice(0, 60)}`);
  }
  if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(html)) problems.push('Hay una URL javascript:');
  for (const m of html.matchAll(/<(?:img|source|video|audio|track|input)\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)) {
    if (!localPath(m[1])) problems.push(`Recurso multimedia no local: ${m[1]}`);
  }
  return problems;
}

/** Encabezados exigidos en producción (valores en minúscula para comparar). */
const REQUIRED_HEADERS = {
  'x-content-type-options': (v) => v.toLowerCase() === 'nosniff',
  'x-frame-options': (v) => ['deny', 'sameorigin'].includes(v.toLowerCase()),
  'referrer-policy': (v) => /no-referrer|same-origin|strict-origin/i.test(v),
  'permissions-policy': (v) => /camera=\(\)/.test(v) && /microphone=\(\)/.test(v) && /geolocation=\(\)/.test(v),
  'cross-origin-opener-policy': (v) => /same-origin/i.test(v),
  'strict-transport-security': (v) => Number(/max-age=(\d+)/i.exec(v)?.[1] ?? 0) >= 15552000,
  'content-security-policy': (v) => /frame-ancestors\s+'none'/.test(v) && /object-src\s+'none'/.test(v) && /base-uri\s+'none'/.test(v) && /upgrade-insecure-requests/.test(v),
};

/** Revisa un conjunto de encabezados { nombre: valor } y devuelve los problemas. */
export function checkHeaders(headers) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const problems = [];
  for (const [name, ok] of Object.entries(REQUIRED_HEADERS)) {
    if (!(name in lower)) problems.push(`Falta el encabezado ${name}`);
    else if (!ok(lower[name])) problems.push(`Valor inadecuado en ${name}: ${lower[name]}`);
  }
  return problems;
}

/** Manifiesto: integridad y tamaño de cada archivo. `files` es un Map ruta → bytes. */
export function buildManifest(files, meta = {}) {
  const entries = [...files.keys()].sort().map((path) => [path, { integrity: sri(files.get(path)), bytes: files.get(path).length }]);
  return { version: 1, ...meta, files: Object.fromEntries(entries) };
}

/**
 * Compara lo publicado con el manifiesto. `actual` es un Map ruta → bytes.
 * Con `complete: false` (solo se descargó una parte del sitio) no se reportan los archivos ausentes.
 */
export function compareWithManifest(manifest, actual, { complete = true } = {}) {
  const changed = [];
  const extra = [];
  for (const [path, bytes] of actual) {
    const expected = manifest.files[path];
    if (!expected) extra.push(path);
    else if (expected.integrity !== sri(bytes)) changed.push(path);
  }
  const missing = complete ? Object.keys(manifest.files).filter((p) => !actual.has(p)) : [];
  return { changed, extra, missing, ok: !changed.length && !extra.length && !missing.length };
}

/**
 * Identificador de build que Next deja en la carga de datos de la página (campo "b"). Como `next.config.ts` lo
 * fija al commit, sirve para saber qué commit está publicado. Devuelve null si no se encuentra.
 * Ojo: viene de un sitio que puede estar comprometido; quien lo use debe validarlo antes de usarlo.
 */
export function buildIdOf(html) {
  return /\\"b\\":\\"([A-Za-z0-9._-]{1,64})\\"/.exec(html)?.[1] ?? null;
}
