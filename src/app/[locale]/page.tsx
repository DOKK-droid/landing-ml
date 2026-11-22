import { site } from '@/config/site';
import { jsonLdScript, structuredData } from '@/model/seo';
import { isLocale } from '@/model/types';
import { App } from '@/view/App';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = isLocale(locale) ? locale : 'es';
  return (
    <>
      {/* Datos estructurados: es un bloque de datos (no se ejecuta), así que la política de contenido no lo restringe. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(structuredData(lang, site)) }} />
      <App locale={lang} />
    </>
  );
}
