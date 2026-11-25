import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { PAGES, hreflangUrls, pageUrl } from '@/model/seo';
import { LOCALES } from '@/model/types';

export const dynamic = 'force-static';

/** Una entrada por página e idioma (inicio y tarifas), cada una con todas las versiones de esa página (incluida ella misma, como pide Google).
 *  Sin `lastModified`, `changeFrequency` ni `priority`: Google los ignora, y una fecha que cambiara en cada build rompería el
 *  manifiesto de integridad (dos builds del mismo código deben dar el mismo resultado). */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: pageUrl(site.url, locale, page),
      alternates: { languages: hreflangUrls(site.url, page) },
    })),
  );
}
