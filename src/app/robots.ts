import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { baseUrl } from '@/model/seo';

// Con `output: 'export'` los archivos de metadatos deben marcarse como estáticos.
export const dynamic = 'force-static';

/** Todo el sitio es público: no hay rutas privadas que ocultar. La raíz (`/`) solo redirige y lleva `noindex` en su propia página,
 *  por eso no se bloquea aquí: un robot bloqueado no llegaría a leer ese `noindex`. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${baseUrl(site.url)}/sitemap.xml`,
  };
}
