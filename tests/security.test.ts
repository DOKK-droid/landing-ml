/* QA de seguridad: endurecimiento del build (SRI, CSP por hash, manifiesto), encabezados de vercel.json y
 * saneamiento del estado guardado en el navegador. Ver docs/SEGURIDAD.md. */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { initialState, sanitize } from '@/controller/surveyReducer';
import { site } from '@/config/site';
import { buildSections } from '@/model/catalog';
import { createReference, isValidReference } from '@/model/message';
import {
  buildCsp, buildIdOf, buildManifest, checkHeaders, checkHtml, compareWithManifest, decodeEntities, hardenHtml, inlineScripts, inlineStyles, localPath, parseCsp, sri,
} from '../scripts/lib/harden.mjs';

const enc = (s: string) => Buffer.from(s, 'utf8');
const ASSETS: Record<string, Buffer> = {
  '/_next/static/chunks/app.js': enc('console.log("app")'),
  '/_next/static/chunks/main.css': enc('body{margin:0}'),
};
const readAsset = (path: string) => ASSETS[path] ?? null;

const PAGE = `<!DOCTYPE html><html><head><meta charSet="utf-8"/>
<link rel="stylesheet" href="/_next/static/chunks/main.css" data-precedence="next"/>
<link rel="preload" as="script" href="/_next/static/chunks/app.js"/>
<link rel="canonical" href="https://ejemplo.dev/es/"/>
<script>(function(){var a=1})()</script>
<script src="/_next/static/chunks/app.js" async=""></script>
<style>html{color-scheme:dark}</style>
</head><body><a href="https://wa.me/54911" target="_blank">WhatsApp</a>
<div style="--c:#2fe6ff;--rd:90ms"></div><p style="font-family:system-ui,&quot;Segoe UI&quot;">x</p>
<script>self.__next_f.push([1,"x"])</script><script id="_R_"></script></body></html>`;

describe('SRI', () => {
  it('calcula integrity sha256 en base64 (vector conocido: "abc")', () => {
    expect(sri(enc('abc'))).toBe('sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
  });
});

describe('endurecimiento de una página', () => {
  const hardened = hardenHtml(PAGE, readAsset);

  it('agrega integrity a scripts, hojas de estilo y precargas locales, con el hash de sus bytes', () => {
    expect(hardened).toContain(`href="/_next/static/chunks/main.css" data-precedence="next" integrity="${sri(ASSETS['/_next/static/chunks/main.css'])}"`);
    expect(hardened).toContain(`as="script" href="/_next/static/chunks/app.js" integrity="${sri(ASSETS['/_next/static/chunks/app.js'])}"`);
    expect(hardened).toContain(`<script src="/_next/static/chunks/app.js" async="" integrity="${sri(ASSETS['/_next/static/chunks/app.js'])}">`);
  });

  it('no toca los enlaces que no cargan recursos (canonical, anclas a WhatsApp)', () => {
    expect(hardened).toContain('<link rel="canonical" href="https://ejemplo.dev/es/"/>');
    expect(hardened).toContain('<a href="https://wa.me/54911" target="_blank">');
  });

  it('inserta la política CSP como primer hijo de <head>, con el hash de cada script en línea', () => {
    expect(hardened).toMatch(/<head><meta http-equiv="Content-Security-Policy" content="/);
    const csp = parseCsp(/http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(hardened)![1]);
    for (const body of ['(function(){var a=1})()', 'self.__next_f.push([1,"x"])']) {
      expect(csp['script-src']).toContain(`'${sri(enc(body))}'`);
    }
    expect(csp['script-src']).toHaveLength(2 + 1); // 'self' + dos hashes (el script vacío no ejecuta nada)
  });

  it('es idempotente: volver a correrlo no cambia el resultado', () => {
    expect(hardenHtml(hardened, readAsset)).toBe(hardened);
  });

  it('corta el build si un recurso referenciado no existe', () => {
    expect(() => hardenHtml('<head><script src="/falta.js"></script></head>', readAsset)).toThrow(/falta\.js/);
  });

  it('corta el build si la página no tiene <head>', () => {
    expect(() => hardenHtml('<p>nada</p>', readAsset)).toThrow(/head/);
  });

  it('la página endurecida cumple la política', async () => {
    expect(await checkHtml(hardened, readAsset)).toEqual([]);
  });
});

describe('política CSP', () => {
  const csp = parseCsp(buildCsp(['a', 'b', 'a']));

  it('los scripts solo salen del propio sitio o de un hash, nunca en línea sin hash ni con eval', () => {
    expect(csp['script-src'][0]).toBe("'self'");
    expect(csp['script-src']).not.toContain("'unsafe-inline'");
    expect(csp['script-src']).not.toContain("'unsafe-eval'");
    expect(csp['script-src'].filter((v) => v.startsWith("'sha256-"))).toHaveLength(2); // sin repetidos
  });

  it('bloquea objetos, <base>, marcos, workers y formularios; conexiones solo al propio sitio', () => {
    for (const d of ['object-src', 'base-uri', 'frame-src', 'worker-src', 'form-action']) expect(csp[d], d).toEqual(["'none'"]);
    expect(csp['connect-src']).toEqual(["'self'"]);
    expect(csp['default-src']).toEqual(["'self'"]);
  });

  it('permite agregar el origen de la API del CRM cuando exista, y solo ese', () => {
    const withApi = parseCsp(buildCsp([], { connect: ['https://crm.ejemplo.com'] }));
    expect(withApi['connect-src']).toEqual(["'self'", 'https://crm.ejemplo.com']);
  });
});

describe('estilos en línea sin unsafe-inline', () => {
  const hardened = hardenHtml(PAGE, readAsset);
  const csp = parseCsp(/http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(hardened)![1]);

  it('nada admite estilos "en general": ni style-src ni style-src-attr llevan unsafe-inline', () => {
    expect(hardened).not.toContain("'unsafe-inline'");
    expect(csp['style-src']).not.toContain("'unsafe-inline'");
    expect(csp['style-src-attr']).not.toContain("'unsafe-inline'");
  });

  it('cada <style> y cada atributo style="…" se permite por su hash (los atributos, con unsafe-hashes)', () => {
    expect(csp['style-src']).toEqual(["'self'", `'${sri(enc('html{color-scheme:dark}'))}'`]);
    expect(csp['style-src-attr'][0]).toBe("'unsafe-hashes'");
    expect(csp['style-src-attr']).toContain(`'${sri(enc('--c:#2fe6ff;--rd:90ms'))}'`);
    // El navegador hashea el valor ya sin entidades: &quot; cuenta como una comilla.
    expect(csp['style-src-attr']).toContain(`'${sri(enc('font-family:system-ui,"Segoe UI"'))}'`);
  });

  it('una página sin atributos style cierra la directiva en lugar de dejarla abierta', () => {
    const plain = parseCsp(buildCsp(['x']));
    expect(plain['style-src-attr']).toEqual(["'none'"]);
    expect(plain['style-src']).toEqual(["'self'"]);
  });

  it('resuelve las entidades que genera React y corta el build ante las que no conoce', () => {
    expect(decodeEntities('a&amp;b &lt;i&gt; &quot;x&quot; &#x27;y&#39;')).toBe('a&b <i> "x" \'y\'');
    expect(decodeEntities('&#65;&#x42;')).toBe('AB');
    expect(() => decodeEntities('&nbsp;')).toThrow(/nbsp/);
    expect(() => decodeEntities('&#9999999999;')).toThrow();
  });

  it('inlineStyles ignora el marcado que aparece dentro de scripts y estilos', () => {
    const html = '<p style="a:1"></p><script>x="<i style=\\"b:2\\">"</script><style>.q{}</style>';
    expect(inlineStyles(html)).toEqual({ elements: ['.q{}'], attributes: ['a:1'] });
  });

  it('la página endurecida cumple, y se detecta un estilo agregado después del build', async () => {
    expect(await checkHtml(hardened, readAsset)).toEqual([]);
    const injectedAttr = hardened.replace('<p style=', '<p data-x="1" style="background:url(//evil)" data-y=');
    expect((await checkHtml(injectedAttr, readAsset)).join('\n')).toMatch(/Atributo style sin hash/);
    const injectedTag = hardened.replace('</body>', '<style>body{display:none}</style></body>');
    expect((await checkHtml(injectedTag, readAsset)).join('\n')).toMatch(/<style> sin hash/);
  });

  it('se rechaza una política que vuelva a admitir unsafe-inline en estilos', async () => {
    const loose = hardened.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
    expect((await checkHtml(loose, readAsset)).join('\n')).toMatch(/style-src admite 'unsafe-inline'/);
  });
});

describe('detección de alteraciones', () => {
  const hardened = hardenHtml(PAGE, readAsset);

  it('detecta un script modificado después del build', async () => {
    const tampered = (p: string) => (p.endsWith('app.js') ? enc('console.log("app");fetch("//evil")') : readAsset(p));
    const problems = await checkHtml(hardened, tampered);
    expect(problems.join('\n')).toMatch(/integridad no coincide.*app\.js/);
  });

  it('detecta un script en línea agregado', async () => {
    const injected = hardened.replace('</body>', '<script>steal(document.cookie)</script></body>');
    expect((await checkHtml(injected, readAsset)).join('\n')).toMatch(/Script en línea sin hash/);
  });

  it('detecta un script externo, un recurso sin integrity y uno que falta', async () => {
    const external = hardened.replace('</body>', '<script src="https://evil.example/x.js"></script></body>');
    expect((await checkHtml(external, readAsset)).join('\n')).toMatch(/externo o no local/);
    const noIntegrity = hardened.replace('</body>', '<script src="/_next/static/chunks/app.js"></script></body>');
    expect((await checkHtml(noIntegrity, readAsset)).join('\n')).toMatch(/Sin integrity/);
    expect((await checkHtml(hardened, () => null)).join('\n')).toMatch(/no encontrado/);
  });

  it('detecta una página sin política, o con una que admite scripts en línea', async () => {
    expect((await checkHtml(PAGE, readAsset)).join('\n')).toMatch(/exactamente una política/);
    const loose = hardened.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    expect((await checkHtml(loose, readAsset)).join('\n')).toMatch(/unsafe-inline/);
  });

  it('detecta manejadores de eventos en línea, iframes y URLs javascript:', async () => {
    const bad = hardened.replace('</body>', '<img src="/x.svg" onerror="alert(1)"><iframe src="/a"></iframe><a href="javascript:alert(1)">x</a></body>');
    const text = (await checkHtml(bad, readAsset)).join('\n');
    expect(text).toMatch(/Atributo de evento/);
    expect(text).toMatch(/Elemento no permitido/);
    expect(text).toMatch(/javascript:/);
  });

  it('un "on…=" dentro del valor de un atributo no es un manejador', async () => {
    const ok = hardened.replace('</body>', '<meta name="description" content="trabajo on demand x=1"/></body>');
    expect(await checkHtml(ok, readAsset)).toEqual([]);
  });

  it('rutas: solo se consideran locales las que empiezan con una barra', () => {
    expect(localPath('/_next/a.js?v=1')).toBe('/_next/a.js');
    expect(localPath('//evil.example/a.js')).toBeNull();
    expect(localPath('https://evil.example/a.js')).toBeNull();
    expect(localPath('data:text/javascript,1')).toBeNull();
    expect(localPath(null)).toBeNull();
  });

  it('inlineScripts ignora los scripts con src y los bloques de datos', () => {
    const html = '<script src="/a.js"></script><script type="application/ld+json">{"a":1}</script><script>run()</script>';
    expect(inlineScripts(html)).toEqual(['run()']);
  });
});

describe('manifiesto de integridad', () => {
  const files = new Map([['es/index.html', enc('<html/>')], ['_next/a.js', enc('1')]]);
  const manifest = buildManifest(files, { commit: 'abc' });

  it('lista cada archivo, ordenado, con su integridad y tamaño', () => {
    expect(Object.keys(manifest.files)).toEqual(['_next/a.js', 'es/index.html']);
    expect(manifest.files['_next/a.js']).toEqual({ integrity: sri(enc('1')), bytes: 1 });
    expect(manifest.commit).toBe('abc');
  });

  it('lo idéntico pasa; un archivo alterado, uno de más o uno que falta se detectan', () => {
    expect(compareWithManifest(manifest, files).ok).toBe(true);
    const altered = new Map(files).set('_next/a.js', enc('2'));
    expect(compareWithManifest(manifest, altered).changed).toEqual(['_next/a.js']);
    const extra = new Map(files).set('_next/evil.js', enc('x'));
    expect(compareWithManifest(manifest, extra).extra).toEqual(['_next/evil.js']);
    const missing = new Map([['es/index.html', enc('<html/>')]]);
    expect(compareWithManifest(manifest, missing).missing).toEqual(['_next/a.js']);
  });

  it('con una descarga parcial no se reportan los archivos ausentes', () => {
    const partial = new Map([['es/index.html', enc('<html/>')]]);
    expect(compareWithManifest(manifest, partial, { complete: false }).ok).toBe(true);
  });
});

describe('encabezados de vercel.json', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const headers = Object.fromEntries(config.headers.flatMap((h) => h.headers.map((x) => [x.key, x.value])));

  it('se aplican a todas las rutas', () => {
    expect(config.headers.map((h) => h.source)).toEqual(['/(.*)']);
  });

  it('cumplen los mínimos exigidos para producción', () => {
    expect(checkHeaders(headers)).toEqual([]);
  });

  it('el verificador rechaza encabezados ausentes o débiles', () => {
    expect(checkHeaders({}).length).toBeGreaterThanOrEqual(7);
    expect(checkHeaders({ ...headers, 'Strict-Transport-Security': 'max-age=60' }).join()).toMatch(/strict-transport-security/);
    expect(checkHeaders({ ...headers, 'X-Content-Type-Options': 'sniff' }).join()).toMatch(/x-content-type-options/);
  });
});

describe('saneamiento del estado guardado en el navegador', () => {
  const REF = 'ML-261120-K7QM';
  const valid = { phase: 'survey', selected: ['ia'], cursor: 2, reference: REF, answers: { p_perfil: 'empresa', p_descripcion: 'Ferretería', a_objetivo: ['x'] }, origin: 'tarjeta', draft: null };

  it('conserva un estado legítimo', () => {
    const s = sanitize(valid);
    expect(s).toMatchObject({ phase: 'survey', selected: ['ia'], cursor: 2, reference: REF, origin: 'tarjeta' });
    expect(s.answers.p_descripcion).toBe('Ferretería');
  });

  it('valida el formato de la referencia (lo que genera createReference) y descarta el resto', () => {
    expect(isValidReference(createReference())).toBe(true);
    expect(isValidReference(createReference(new Date(2026, 0, 2), () => 0.999))).toBe(true);
    for (const bad of ['', 'ML-1', 'ml-261120-K7QM', 'ML-261120-K7QI', 'ML-261120-K7Q0', 'ML-261120-K7QMX', '<script>', 42, null, {}]) {
      expect(isValidReference(bad), String(bad)).toBe(false);
    }
  });

  it('una referencia adulterada saca del relevamiento: se vuelve al inicio sin perder la selección', () => {
    const s = sanitize({ ...valid, reference: '<img src=x onerror=alert(1)>' });
    expect(s.reference).toBe('');
    expect(s.phase).toBe('landing');
    expect(s.selected).toEqual(['ia']);
  });

  it('descarta respuestas de preguntas que no existen en el recorrido elegido', () => {
    const s = sanitize({ ...valid, answers: { p_descripcion: 'x', __proto__x: 'y', s_tipo: 'de otro servicio', inventada: 'z', c_motivo_otro: 'tampoco' } });
    expect(Object.keys(s.answers)).toEqual(['p_descripcion']);
  });

  it('descarta valores del tipo equivocado: números, objetos, nulos y listas donde va texto', () => {
    const s = sanitize({ ...valid, answers: { p_descripcion: 42, p_tamano: { a: 1 }, p_industria: ['x'], a_objetivo: 'texto', x_necesidad: null } });
    expect(s.answers).toEqual({});
  });

  it('recorta los textos a sus límites y las opciones múltiples a lo que existe', () => {
    const s = sanitize({
      ...valid,
      answers: { p_nombre: 'a'.repeat(5000), p_descripcion: 'd'.repeat(5000), x_necesidad: 'b'.repeat(5000), a_objetivo: ['1', '1', 7, 'c'.repeat(500), ...Array(50).fill('z')] },
    });
    expect((s.answers.p_nombre as string).length).toBe(site.maxLineLength);
    expect((s.answers.p_descripcion as string).length).toBe(160); // tope propio de la pregunta
    expect((s.answers.x_necesidad as string).length).toBe(site.maxTextLength);
    const ids = s.answers.a_objetivo as string[];
    expect(ids.length).toBeLessThanOrEqual(buildSections(['ia']).flatMap((x) => x.questions).find((q) => q.id === 'a_objetivo')!.options!.length);
    expect(ids.every((id) => typeof id === 'string' && id.length <= 64)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('acota el mensaje editado y normaliza el origen', () => {
    expect(sanitize({ ...valid, draft: 'x'.repeat(100_000) }).draft).toHaveLength(20_000);
    expect(sanitize({ ...valid, draft: 123 }).draft).toBeNull();
    expect(sanitize({ ...valid, origin: '<script>' }).origin).toBe('');
  });

  it('ignora servicios inexistentes o repetidos y entradas que no son un objeto', () => {
    expect(sanitize({ ...valid, selected: ['ia', 'ia', 'hackeo', 7] }).selected).toEqual(['ia']);
    expect(sanitize(null)).toEqual(initialState);
    expect(sanitize('basura')).toEqual(initialState);
    expect(sanitize({ ...valid, answers: ['x'] }).answers).toEqual({});
  });
});

describe('identificador de build publicado', () => {
  it('se lee de la carga de datos de la página, donde Next lo deja escapado', () => {
    const html = '<script>self.__next_f.push([1,"...{\\"p\\":\\"$undefined\\",\\"d\\":\\"$undefined\\",\\"b\\":\\"3d3c42e5aac5ba805825da76410c181273ba90b1\\"}\\n..."])</script>';
    expect(buildIdOf(html)).toBe('3d3c42e5aac5ba805825da76410c181273ba90b1');
  });

  it('devuelve null si no está, y no acepta valores con caracteres raros', () => {
    expect(buildIdOf('<html></html>')).toBeNull();
    expect(buildIdOf('\\"b\\":\\"a b;rm -rf\\"')).toBeNull();
  });
});

describe('flujos de GitHub Actions', () => {
  const dir = '.github/workflows';
  const files = readdirSync(dir).filter((f) => f.endsWith('.yml'));
  const read = (f: string) => readFileSync(`${dir}/${f}`, 'utf8');

  it('existen el CI y la verificación programada', () => {
    expect(files.sort()).toEqual(['ci.yml', 'verify-live.yml']);
  });

  it.each(files)('%s: toda acción de terceros está fijada por el SHA de un commit, no por una etiqueta', (f) => {
    const uses = [...read(f).matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const ref of uses) expect(ref, ref).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });

  it.each(files)('%s: permisos mínimos declarados, sin pull_request_target ni write-all', (f) => {
    const text = read(f);
    expect(text).toMatch(/^permissions:\n\s+contents: read/m);
    expect(text).not.toMatch(/pull_request_target|write-all/);
    for (const block of text.split(/uses: actions\/checkout@/).slice(1)) {
      expect(block.slice(0, 250), 'cada checkout descarta las credenciales').toContain('persist-credentials: false');
    }
  });

  it('el CI no ejecuta scripts de instalación y verifica el build', () => {
    const ci = read('ci.yml');
    expect(ci).toContain('npm ci --ignore-scripts');
    for (const step of ['npm run lint', 'npm test', 'npm run build', 'npm run verify', 'npm audit --omit=dev']) expect(ci).toContain(step);
    expect(ci).toContain('integrity-manifest-${{ github.sha }}');
  });

  it('la verificación programada valida el SHA que informa el sitio antes de usarlo, y avisa si falla', () => {
    const live = read('verify-live.yml');
    expect(live).toMatch(/schedule:/);
    expect(live).toContain('--build-id');
    expect(live).toContain("grep -Eq '^[0-9a-f]{40}$'");
    expect(live.indexOf("grep -Eq '^[0-9a-f]{40}$'")).toBeLessThan(live.indexOf('ref: ${{ steps.deployed.outputs.sha }}'));
    expect(live).toContain('--manifest deployed/.integrity/manifest.json');
    expect(live).toContain('security-alert');
    expect(live).toMatch(/issues: write/);
  });

  it('lo que informa el sitio solo entra por `ref:` o por una variable de entorno, nunca dentro de un comando', () => {
    const allowed = /^\s+(ref|VERCEL_GIT_COMMIT_SHA): \$\{\{ steps\.deployed\.outputs\.sha \}\}$/;
    const uses = read('verify-live.yml').split('\n').filter((line) => line.includes('steps.deployed.outputs'));
    expect(uses.length).toBe(2);
    for (const line of uses) expect(line, line).toMatch(allowed);
  });
});
