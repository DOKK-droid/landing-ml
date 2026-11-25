import type { Metadata } from 'next';
import { site } from '@/config/site';
import { DICTIONARIES } from '@/model/i18n';
import { OG_LOCALE, hreflangPaths, pagePath, type Page } from '@/model/seo';
import { LOCALES, type Locale } from '@/model/types';

/**
 * Metadatos de una página del sitio en un idioma. Next combina los metadatos de layout y página de forma superficial (cada clave
 * de primer nivel que la página define reemplaza entera a la del layout), por eso cada página declara todo: título, descripción,
 * canónico, idiomas alternativos y Open Graph.
 */
export function pageMeta(locale: Locale, page: Page): Metadata {
  const d = page === 'rates' ? DICTIONARIES[locale].ratesMeta : DICTIONARIES[locale].meta;
  const path = pagePath(page, locale);
  return {
    title: d.title,
    description: d.description,
    alternates: {
      canonical: path,
      // es, pt, en y x-default (la página para quien no coincide con ninguno: el español).
      languages: hreflangPaths(page),
    },
    openGraph: {
      title: d.title,
      description: d.description,
      type: 'website',
      siteName: site.owner,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      url: path,
    },
  };
}
