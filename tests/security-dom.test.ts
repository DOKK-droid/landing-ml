// @vitest-environment jsdom
/* Contraste independiente: el verificador calcula los hashes con su propio lector de HTML; acá se comparan con lo
 * que ve un analizador de HTML real (el DOM), que es lo que el navegador hashea al aplicar la CSP.
 * Ver docs/SEGURIDAD.md. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hardenHtml, inlineScripts, inlineStyles, parseCsp, sri } from '../scripts/lib/harden.mjs';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const hash = (text: string) => `'${sri(Buffer.from(text, 'utf8'))}'`;

/** Lo que el navegador tendría que encontrar permitido en la política de una página. */
function seenByBrowser(html: string) {
  const doc = parse(html);
  return {
    scripts: [...doc.querySelectorAll('script:not([src])')].map((e) => e.textContent ?? '').filter((t) => t !== ''),
    styleElements: [...doc.querySelectorAll('style')].map((e) => e.textContent ?? '').filter((t) => t !== ''),
    styleAttributes: [...doc.querySelectorAll('[style]')].map((e) => e.getAttribute('style') ?? '').filter((t) => t !== ''),
    csp: parseCsp(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') ?? ''),
  };
}

describe('el lector de HTML del verificador coincide con el del navegador', () => {
  const TRICKY = `<head><script>var a = "<b style=\\"x\\">";</script><style>.a{color:red}</style></head>
<body><div style="font-family:system-ui,&quot;Segoe UI&quot;;--x:a&amp;b"></div>
<svg style='fill:url(&#x23;g)'><g style="--i:0"></g></svg><p STYLE="--c:#fff">x</p></body>`;

  it('mismos scripts en línea, <style> y atributos style en un documento con entidades y mayúsculas', () => {
    const seen = seenByBrowser(TRICKY);
    expect(inlineScripts(TRICKY)).toEqual(seen.scripts);
    const mine = inlineStyles(TRICKY);
    expect(mine.elements).toEqual(seen.styleElements);
    expect([...mine.attributes].sort()).toEqual([...seen.styleAttributes].sort());
  });

  it('tras endurecer, todo lo que ve el navegador está permitido por la política', () => {
    const seen = seenByBrowser(hardenHtml(TRICKY, () => null));
    for (const body of seen.scripts) expect(seen.csp['script-src']).toContain(hash(body));
    for (const body of seen.styleElements) expect(seen.csp['style-src']).toContain(hash(body));
    for (const value of seen.styleAttributes) expect(seen.csp['style-src-attr']).toContain(hash(value));
  });
});

// Se ejecuta sobre el build real si está presente (npm run build); sin build no hay nada que contrastar.
const OUT = 'out';
const pages = existsSync(join(OUT, 'es/index.html'))
  ? (readdirSync(OUT, { recursive: true }) as string[]).filter((f) => f.endsWith('.html')).sort()
  : [];

describe.skipIf(!pages.length)('build real (carpeta out/)', () => {
  it.each(pages)('%s: la política permite todo lo que el navegador va a encontrar', (page) => {
    const seen = seenByBrowser(readFileSync(join(OUT, page), 'utf8'));
    expect(seen.csp['script-src'], 'hay política').toBeDefined();
    for (const body of seen.scripts) expect(seen.csp['script-src'], body.slice(0, 40)).toContain(hash(body));
    for (const body of seen.styleElements) expect(seen.csp['style-src'], body.slice(0, 40)).toContain(hash(body));
    for (const value of seen.styleAttributes) expect(seen.csp['style-src-attr'], value.slice(0, 40)).toContain(hash(value));
    expect(seen.csp['style-src']).not.toContain("'unsafe-inline'");
    expect(seen.csp['style-src-attr']).not.toContain("'unsafe-inline'");
  });
});
