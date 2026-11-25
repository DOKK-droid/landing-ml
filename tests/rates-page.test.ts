/* La tarifa del relevamiento técnico vive en su propia página (/es/tarifas/), enlazada desde el menú, y no en el inicio.
 * Se prueba el marcado de cada página (renderizado en el servidor, como lo exporta Next), el script de reanudación (que no debe ocultar las
 * tarifas) y, si existe la carpeta out/, el HTML construido: canónico, idiomas alternativos y que el inicio ya no traiga la sección. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { pageMeta } from '@/app/[locale]/pageMeta';
import sitemap from '@/app/sitemap';
import { resumeScript } from '@/controller/resume';
import { initialState } from '@/controller/surveyReducer';
import { site } from '@/config/site';
import { DICTIONARIES } from '@/model/i18n';
import { PAGES, RATES_SLUG, hreflangPaths, hreflangUrls, pagePath, pageUrl } from '@/model/seo';
import { LOCALES } from '@/model/types';
import { App } from '@/view/App';
import { RatesPage } from '@/view/RatesPage';

const home = (locale: string) => renderToStaticMarkup(createElement(App, { locale: locale as 'es' }));
const rates = (locale: string) => renderToStaticMarkup(createElement(RatesPage, { locale: locale as 'es' }));
/** Los href de todas las etiquetas <a> del fragmento. */
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*?href="([^"]*)"/g)].map((m) => m[1]);
/** Las etiquetas <a> del fragmento con sus atributos y su texto. `next/link` emite los atributos en otro orden que un <a> escrito a mano: no se depende del orden. */
const anchors = (html: string) =>
  [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => ({
    attrs: Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])) as Record<string, string>,
    text: m[2].replace(/<[^>]*>/g, '').trim(),
  }));
const nav = (html: string) => html.slice(html.indexOf('<nav class="header__nav"'), html.indexOf('</nav>', html.indexOf('<nav class="header__nav"')));

describe('direcciones de las tarifas', () => {
  it('cada idioma tiene su página: /es/tarifas/, /pt/tarifas/, /en/tarifas/ (con la barra final del export)', () => {
    expect(RATES_SLUG).toBe('tarifas');
    for (const l of LOCALES) {
      expect(pagePath('rates', l)).toBe(`/${l}/tarifas/`);
      expect(pagePath('home', l)).toBe(`/${l}/`);
      expect(pageUrl('https://ejemplo.com/', l, 'rates')).toBe(`https://ejemplo.com/${l}/tarifas/`);
    }
  });

  it('los idiomas alternativos de las tarifas apuntan a las tarifas (x-default, al español), no al inicio', () => {
    expect(hreflangPaths('rates')).toEqual({ es: '/es/tarifas/', pt: '/pt/tarifas/', en: '/en/tarifas/', 'x-default': '/es/tarifas/' });
    expect(hreflangPaths()).toEqual(hreflangPaths('home'));
    expect(hreflangUrls('https://ejemplo.com/', 'rates')['x-default']).toBe('https://ejemplo.com/es/tarifas/');
  });

  it('el sitemap lista el inicio y las tarifas en cada idioma, cada uno con sus propias alternativas', () => {
    const entries = sitemap();
    expect(entries.map((e) => e.url)).toEqual(PAGES.flatMap((page) => LOCALES.map((l) => pageUrl(site.url, l, page))));
    for (const e of entries) {
      const langs = e.alternates?.languages as Record<string, string>;
      const isRates = e.url.includes('/tarifas/');
      expect(Object.keys(langs).sort()).toEqual(['en', 'es', 'pt', 'x-default']);
      for (const url of Object.values(langs)) expect(url.includes('/tarifas/'), `${e.url} → ${url}`).toBe(isRates);
      expect(Object.values(langs)).toContain(e.url);
    }
  });

  it('los metadatos de las tarifas tienen su propio título, descripción, canónico y Open Graph (Next no los hereda del inicio)', () => {
    for (const l of LOCALES) {
      const m = pageMeta(l, 'rates');
      const d = DICTIONARIES[l].ratesMeta;
      expect(m.title).toBe(d.title);
      expect(m.description).toBe(d.description);
      expect(m.title).not.toBe(DICTIONARIES[l].meta.title);
      expect(m.alternates?.canonical).toBe(`/${l}/tarifas/`);
      expect(m.alternates?.languages).toEqual(hreflangPaths('rates'));
      expect(m.openGraph).toMatchObject({ url: `/${l}/tarifas/`, title: d.title, description: d.description, siteName: site.owner });
      // sin cifras en el texto: el precio sale de site.consulta y no debe quedar copiado en una descripción
      expect(d.description, l).not.toMatch(/\d/);
      expect(pageMeta(l, 'home').alternates?.canonical).toBe(`/${l}/`);
    }
  });
});

describe('el inicio ya no trae la sección de tarifas', () => {
  for (const l of LOCALES) {
    it(`${l}: ni la tarjeta de oferta ni el ancla #consulta; el aviso del precio y el menú llevan a la página de tarifas`, () => {
      const html = home(l);
      expect(html).not.toContain('offer__card');
      expect(html).not.toContain('id="consulta"');
      expect(html).not.toContain('offer__tiers');
      expect(hrefs(html)).not.toContain('#consulta');
      expect(hrefs(html)).toContain(`/${l}/tarifas/`);
      // el aviso del precio sigue en el inicio (es la entrada en el celular, donde no hay menú)
      expect(html).toContain('hero__offer');
      // el menú: Servicios y Enfoque siguen siendo anclas del inicio, Tarifas es la nueva pestaña
      const links = hrefs(nav(html));
      expect(links).toEqual(['#servicios', `/${l}/tarifas/`, '#enfoque', '#contacto']);
      expect(nav(html)).toContain(`>${DICTIONARIES[l].nav.rates}</a>`);
      expect(nav(html)).not.toContain('aria-current="page"');
    });
  }
});

describe('la página de tarifas', () => {
  for (const l of LOCALES) {
    it(`${l}: lleva la oferta con un solo h1 y el menú marca Tarifas como la página actual`, () => {
      const html = rates(l);
      const d = DICTIONARIES[l];
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html).toContain(`<h1 id="offer-title" class="section__title">${d.consulta.title}</h1>`);
      expect(html).toContain('offer__card');
      expect(html).toContain('offer__tiers');
      expect(html).not.toContain('class="hero"'); // sin el resto del inicio
      expect(html).toContain('id="contenido"'); // destino del enlace "saltar al contenido"
      expect(html).toContain('id="contacto"'); // el pie, destino de "Contacto"
      expect(html).toContain('class="emergency"');
      const current = anchors(nav(html)).filter((a) => a.attrs['aria-current'] === 'page');
      expect(current.map((a) => [a.text, a.attrs.href])).toEqual([[d.nav.rates, `/${l}/tarifas/`]]);
    });

    it(`${l}: desde aquí el menú, el logo, el botón y el enlace a Soporte vuelven al inicio con direcciones completas`, () => {
      const html = rates(l);
      expect(hrefs(nav(html))).toEqual([`/${l}/#servicios`, `/${l}/tarifas/`, `/${l}/#enfoque`, '#contacto']);
      expect(anchors(html).find((a) => a.attrs.class === 'brand')?.attrs.href).toBe(`/${l}/`);
      // el botón de la oferta ya no inicia un relevamiento (no hay servicios elegidos aquí): lleva a elegirlos
      const cta = anchors(html).find((a) => a.attrs.class?.includes('btn--primary'));
      expect(cta?.attrs.href).toBe(`/${l}/#servicios`);
      expect(cta?.text).toBe(DICTIONARIES[l].consulta.cta);
      expect(html).not.toContain('<button');
      expect(hrefs(html)).toContain(`/${l}/#svc-soporte`);
      // nunca un ancla suelta del inicio (#servicios, #svc-soporte, #enfoque) que aquí no existe
      for (const h of hrefs(html).filter((x) => x.startsWith('#'))) expect(['#contenido', '#contacto']).toContain(h);
    });

    it(`${l}: el selector de idioma lleva a las tarifas en el otro idioma, no al inicio`, () => {
      const html = rates(l);
      const lang = html.slice(html.indexOf('<nav class="lang"'), html.indexOf('</nav>', html.indexOf('<nav class="lang"')));
      expect(hrefs(lang)).toEqual(LOCALES.map((x) => `/${x}/tarifas/`));
      expect(lang.match(/aria-current="true"/g)).toHaveLength(1);
      // y en el inicio sigue llevando al inicio
      const h = home(l);
      expect(hrefs(h.slice(h.indexOf('<nav class="lang"'), h.indexOf('</nav>', h.indexOf('<nav class="lang"'))))).toEqual(LOCALES.map((x) => `/${x}/`));
    });
  }

  it('muestra el mismo precio que antes en el inicio: sale de la misma configuración', () => {
    const html = rates('es');
    expect(html).toContain('USD 54');
    expect(html).toContain('USD 72');
  });
});

describe('reanudar el relevamiento solo en el inicio', () => {
  const pending = JSON.stringify({ ...initialState, phase: 'survey', selected: ['ia'], reference: 'ML-261120-K7QM' });
  const marks = (pathname: string) => {
    const calls: string[] = [];
    runInNewContext(resumeScript, {
      location: { pathname },
      sessionStorage: { getItem: () => pending },
      document: { documentElement: { setAttribute: (n: string) => calls.push(`set ${n}`), removeAttribute: () => {} } },
      setTimeout: () => 1,
    });
    return calls;
  };

  it('con un relevamiento en curso marca el inicio de cada idioma, pero no las tarifas (nada la quitaría: ocultaría la página hasta que venza la red de seguridad)', () => {
    for (const l of LOCALES) {
      expect(marks(`/${l}/`), `/${l}/`).toHaveLength(1);
      expect(marks(`/${l}`), `/${l}`).toHaveLength(1);
      expect(marks(`/${l}/index.html`), `/${l}/index.html`).toHaveLength(1);
      expect(marks(`/${l}/tarifas/`), `/${l}/tarifas/`).toEqual([]);
    }
    expect(marks('/')).toEqual([]);
  });
});

const OUT = join(__dirname, '..', 'out');
describe.skipIf(!existsSync(join(OUT, 'es/tarifas/index.html')))('build real (carpeta out/)', () => {
  const read = (p: string) => readFileSync(join(OUT, p), 'utf8');

  for (const l of LOCALES) {
    it(`${l}/tarifas/: canónico y alternativas hacia las tarifas, título propio y sin marcas de reanudación ni datos del inicio`, () => {
      const html = read(`${l}/tarifas/index.html`);
      expect(html).toContain(`<html lang="${l}"`);
      expect(html).toMatch(new RegExp(`<link rel="canonical" href="https?://[^"]+/${l}/tarifas/"`));
      for (const code of ['es', 'pt', 'en', 'x-default']) {
        const target = code === 'x-default' ? 'es' : code;
        expect(html, code).toMatch(new RegExp(`<link rel="alternate" hrefLang="${code}" href="https?://[^"]+/${target}/tarifas/"|<link rel="alternate" hreflang="${code}" href="https?://[^"]+/${target}/tarifas/"`, 'i'));
      }
      expect(html).toContain(`<title>${DICTIONARIES[l].ratesMeta.title}</title>`);
      expect(html).toContain(`og:url" content="`);
      expect(html).toMatch(new RegExp(`og:url" content="https?://[^"]+/${l}/tarifas/"`));
      expect(html).toContain('offer__card');
      expect(html).toContain('USD 54');
    });

    it(`${l}/: el inicio construido ya no incluye la oferta y enlaza a las tarifas`, () => {
      const html = read(`${l}/index.html`);
      expect(html).not.toContain('offer__card');
      expect(html).not.toContain('id="consulta"');
      expect(html).toContain(`href="/${l}/tarifas/"`);
    });
  }

  it('el sitemap incluye las seis páginas', () => {
    const xml = read('sitemap.xml');
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname).sort();
    expect(paths).toEqual(['/en/', '/en/tarifas/', '/es/', '/es/tarifas/', '/pt/', '/pt/tarifas/']);
  });
});
