/* SEO: robots.txt, sitemap, idiomas alternativos (hreflang) y datos estructurados (JSON-LD).
 * La lógica es pura y se prueba directa; el resultado real se comprueba sobre la carpeta out/ cuando existe. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { site } from '@/config/site';
import { SERVICES } from '@/model/catalog';
import { DICTIONARIES } from '@/model/i18n';
import { OG_LOCALE, baseUrl, hreflangPaths, hreflangUrls, jsonLdScript, pageUrl, structuredData } from '@/model/seo';
import { LOCALES } from '@/model/types';

const BASE = 'https://ejemplo.com';

describe('direcciones por idioma', () => {
  it('quita las barras finales de la base y termina cada página en barra (el sitio exporta con trailingSlash)', () => {
    expect(baseUrl('https://ejemplo.com///')).toBe(BASE);
    expect(pageUrl('https://ejemplo.com/', 'pt')).toBe('https://ejemplo.com/pt/');
    for (const l of LOCALES) expect(pageUrl(BASE, l)).toBe(`${BASE}/${l}/`);
  });

  it('declara es, pt y en, y x-default apunta al español (la raíz lleva noindex: no puede ser destino de hreflang)', () => {
    const paths = hreflangPaths();
    expect(Object.keys(paths).sort()).toEqual(['en', 'es', 'pt', 'x-default']);
    expect(paths['x-default']).toBe('/es/');
    for (const l of LOCALES) expect(paths[l]).toBe(`/${l}/`);
    expect(Object.values(paths)).not.toContain('/');
  });

  it('la versión absoluta usa la misma base', () => {
    for (const url of Object.values(hreflangUrls(`${BASE}/`))) expect(url.startsWith(`${BASE}/`)).toBe(true);
  });

  it('los códigos de Open Graph llevan territorio (idioma_TERRITORIO) y son distintos por idioma', () => {
    for (const code of Object.values(OG_LOCALE)) expect(code).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    expect(new Set(Object.values(OG_LOCALE)).size).toBe(LOCALES.length);
  });
});

describe('robots.txt', () => {
  const r = robots();
  const rules = [r.rules].flat();

  it('permite todo y no bloquea la raíz (un robot bloqueado no leería su noindex)', () => {
    expect(rules).toHaveLength(1);
    expect(rules[0].userAgent).toBe('*');
    expect(rules[0].allow).toBe('/');
    expect(rules[0].disallow).toBeUndefined();
  });

  it('indica el sitemap con URL absoluta', () => {
    expect(r.sitemap).toBe(`${baseUrl(site.url)}/sitemap.xml`);
  });
});

describe('sitemap.xml', () => {
  const entries = sitemap();

  it('lista una página por idioma, ninguna más (la raíz solo redirige)', () => {
    expect(entries.map((e) => e.url)).toEqual(LOCALES.map((l) => pageUrl(site.url, l)));
  });

  it('cada entrada lista todas las versiones, incluida ella misma, con x-default', () => {
    for (const e of entries) {
      const langs = e.alternates?.languages as Record<string, string>;
      expect(Object.keys(langs).sort()).toEqual(['en', 'es', 'pt', 'x-default']);
      expect(Object.values(langs)).toContain(e.url);
    }
  });

  it('no lleva fechas: una fecha que cambiara en cada build rompería el manifiesto de integridad', () => {
    for (const e of entries) {
      expect(e.lastModified).toBeUndefined();
      expect(JSON.stringify(sitemap())).toBe(JSON.stringify(sitemap()));
    }
  });
});

describe('datos estructurados (JSON-LD)', () => {
  for (const locale of LOCALES) {
    describe(locale, () => {
      const data = structuredData(locale, { ...site, url: BASE });
      const graph = data['@graph'] as Record<string, unknown>[];
      const node = (type: string) => graph.find((n) => n['@type'] === type) as Record<string, any>;
      const d = DICTIONARIES[locale];

      it('es un grafo de schema.org con el sitio, la página, la persona y el servicio', () => {
        expect(data['@context']).toBe('https://schema.org');
        expect(graph.map((n) => n['@type']).sort()).toEqual(['Person', 'ProfessionalService', 'WebPage', 'WebSite']);
      });

      it('dice lo mismo que la página: nombre, cargo y descripción del idioma', () => {
        expect(node('Person').name).toBe(site.owner);
        expect(node('Person').jobTitle).toBe(d.role);
        expect(node('WebPage').name).toBe(d.meta.title);
        expect(node('WebPage').description).toBe(d.meta.description);
        expect(node('WebPage').inLanguage).toBe(locale);
        expect(node('WebPage').url).toBe(`${BASE}/${locale}/`);
      });

      it('lista los servicios del catálogo en ese idioma, sin inventar ninguno', () => {
        expect(node('ProfessionalService').serviceType).toEqual(SERVICES.map((s) => s.title[locale]));
        expect(node('Person').knowsAbout).toEqual(SERVICES.map((s) => s.short[locale]));
      });

      it('el contacto sale de la configuración del sitio', () => {
        expect(node('ProfessionalService').telephone).toBe(`+${site.whatsapp}`);
        expect(node('ProfessionalService').contactPoint.url).toBe(`https://wa.me/${site.whatsapp}`);
        expect(node('Person').sameAs).toEqual([site.linkedin]);
      });

      it('los @id enlazan entre sí y no cambian con el idioma', () => {
        const ids = new Set(graph.map((n) => n['@id']));
        expect(node('WebPage').isPartOf['@id']).toBe(node('WebSite')['@id']);
        expect(ids.has(node('WebPage').about['@id'])).toBe(true);
        expect(ids.has(node('Person').worksFor['@id'])).toBe(true);
        const other = structuredData(locale === 'es' ? 'en' : 'es', { ...site, url: BASE })['@graph'] as Record<string, unknown>[];
        expect(other.find((n) => n['@type'] === 'Person')!['@id']).toBe(node('Person')['@id']);
      });
    });
  }

  it('al serializar no deja "<", ">" ni "&" y se recupera idéntico (un texto con </script> no cierra la etiqueta)', () => {
    const hostile = { name: '</script><img src=x onerror=alert(1)> & más', nested: ['<!--', ']]>'] };
    const out = jsonLdScript(hostile);
    expect(out).not.toMatch(/[<>&]/);
    expect(JSON.parse(out)).toEqual(hostile);
  });
});

const OUT = join(__dirname, '..', 'out');
describe.skipIf(!existsSync(join(OUT, 'es/index.html')))('build real (carpeta out/)', () => {
  const read = (p: string) => readFileSync(join(OUT, p), 'utf8');
  const origin = (url: string) => new URL(url).origin;

  it('publica robots.txt con el sitemap y sin bloquear nada', () => {
    const txt = read('robots.txt');
    expect(txt).toMatch(/User-Agent: \*/i);
    expect(txt).toMatch(/Allow: \//i);
    expect(txt).not.toMatch(/Disallow:\s*\S/i);
    expect(txt).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/i);
  });

  it('publica sitemap.xml con las tres páginas y sus alternativas hreflang', () => {
    const xml = read('sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toHaveLength(3);
    expect(locs.map((u) => new URL(u).pathname).sort()).toEqual(['/en/', '/es/', '/pt/']);
    for (const code of ['es', 'pt', 'en', 'x-default']) expect(xml).toContain(`hreflang="${code}"`);
    expect(xml).not.toContain('<lastmod>');
  });

  it('robots.txt, sitemap, canónico y datos estructurados usan la misma dirección base', () => {
    const bases = new Set<string>();
    bases.add(origin(/Sitemap:\s*(\S+)/i.exec(read('robots.txt'))![1]));
    for (const m of read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)) bases.add(origin(m[1]));
    for (const l of LOCALES) {
      const html = read(`${l}/index.html`);
      bases.add(origin(/<link rel="canonical" href="([^"]+)"/.exec(html)![1]));
      const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
      for (const n of ld['@graph']) if (n.url) bases.add(origin(n.url));
    }
    expect([...bases]).toHaveLength(1);
  });

  for (const l of LOCALES) {
    it(`${l}/: hreflang con x-default, Open Graph con territorio y un solo bloque JSON-LD válido`, () => {
      const html = read(`${l}/index.html`);
      for (const code of ['es', 'pt', 'en', 'x-default']) expect(html).toMatch(new RegExp(`<link rel="alternate" hrefLang="${code}"|<link rel="alternate" hreflang="${code}"`, 'i'));
      expect(html).toContain(`<meta property="og:locale" content="${OG_LOCALE[l]}"`);
      expect(html).toContain('og:locale:alternate');
      expect(html).toContain(`<html lang="${l}"`);
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(blocks).toHaveLength(1);
      expect(() => JSON.parse(blocks[0][1])).not.toThrow();
    });
  }

  it('la raíz sigue con noindex y no está en el sitemap', () => {
    expect(read('index.html')).toMatch(/<meta name="robots" content="noindex/i);
    expect(read('sitemap.xml')).not.toMatch(/<loc>https?:\/\/[^/<]+\/<\/loc>/);
  });
});
