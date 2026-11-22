/* ============================================================
 * MODELO — SEO: direcciones por idioma, idiomas alternativos (hreflang) y datos estructurados (JSON-LD).
 * Puro: recibe la URL base, no lee el entorno ni usa React. Lo consumen robots.ts, sitemap.ts, el layout y la página.
 * ============================================================ */
import { SERVICES } from './catalog';
import { DICTIONARIES } from './i18n';
import { DEFAULT_LOCALE, LOCALES, type Locale } from './types';

/** Lo que de `site` hace falta para describir al negocio. */
export interface SeoSite {
  url: string;
  owner: string;
  /** Internacional, sin "+" ni espacios (el formato de wa.me). */
  whatsapp: string;
  linkedin: string;
}

/** Ruta de cada idioma (con la barra final: el sitio exporta con trailingSlash). */
export const localePath = (locale: Locale): string => `/${locale}/`;

/** URL base sin barra final. */
export const baseUrl = (url: string): string => url.replace(/\/+$/, '');

/** URL absoluta de la página de un idioma. */
export const pageUrl = (url: string, locale: Locale): string => `${baseUrl(url)}${localePath(locale)}`;

/** Idiomas alternativos como rutas (para `metadata.alternates.languages`). `x-default` es la página para quien no coincide con ninguno. */
export function hreflangPaths(): Record<Locale | 'x-default', string> {
  return { es: localePath('es'), pt: localePath('pt'), en: localePath('en'), 'x-default': localePath(DEFAULT_LOCALE) };
}

/** Lo mismo con URLs absolutas (el sitemap las exige). */
export function hreflangUrls(url: string): Record<Locale | 'x-default', string> {
  const paths = hreflangPaths();
  return Object.fromEntries(Object.entries(paths).map(([k, p]) => [k, `${baseUrl(url)}${p}`])) as Record<Locale | 'x-default', string>;
}

/** Código de Open Graph (idioma_TERRITORIO): con solo "es" Facebook y LinkedIn no lo reconocen. */
export const OG_LOCALE: Record<Locale, string> = { es: 'es_LA', pt: 'pt_BR', en: 'en_US' };

/** Nombres de idioma para los datos estructurados. */
const LANGUAGE_NAME: Record<Locale, string> = { es: 'Spanish', pt: 'Portuguese', en: 'English' };

/**
 * Datos estructurados de la página de un idioma. Solo dice lo que la página ya muestra (nombre, cargo, servicios,
 * teléfono, LinkedIn): las pautas de Google exigen que el marcado coincida con el contenido visible.
 */
export function structuredData(locale: Locale, site: SeoSite) {
  const base = baseUrl(site.url);
  const page = pageUrl(site.url, locale);
  const d = DICTIONARIES[locale];
  const ids = { website: `${base}/#website`, person: `${base}/#person`, service: `${base}/#service` };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': ids.website, url: page, name: site.owner, inLanguage: locale },
      {
        '@type': 'WebPage',
        '@id': `${page}#webpage`,
        url: page,
        name: d.meta.title,
        description: d.meta.description,
        inLanguage: locale,
        isPartOf: { '@id': ids.website },
        about: { '@id': ids.service },
      },
      {
        '@type': 'Person',
        '@id': ids.person,
        name: site.owner,
        jobTitle: d.role,
        url: page,
        sameAs: [site.linkedin],
        knowsAbout: SERVICES.map((s) => s.short[locale]),
        worksFor: { '@id': ids.service },
      },
      {
        '@type': 'ProfessionalService',
        '@id': ids.service,
        name: site.owner,
        description: d.meta.description,
        url: page,
        serviceType: SERVICES.map((s) => s.title[locale]),
        sameAs: [site.linkedin],
        telephone: `+${site.whatsapp}`,
        availableLanguage: LOCALES.map((l) => LANGUAGE_NAME[l]),
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'sales',
          telephone: `+${site.whatsapp}`,
          url: `https://wa.me/${site.whatsapp}`,
          availableLanguage: LOCALES.map((l) => LANGUAGE_NAME[l]),
        },
      },
    ],
  };
}

/**
 * Serializa el JSON-LD para ponerlo dentro de un <script type="application/ld+json">. `JSON.stringify` no escapa `<`:
 * un texto con `</script>` cerraría la etiqueta antes de tiempo. Se escapan también `>` y `&`. Los separadores de línea
 * de Unicode no hacen falta: en un bloque de datos JSON son válidos (no se ejecuta como JavaScript).
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
