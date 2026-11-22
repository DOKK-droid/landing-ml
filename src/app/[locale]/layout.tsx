import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { site } from '@/config/site';
import { resumeScript } from '@/controller/resume';
import { DICTIONARIES } from '@/model/i18n';
import { OG_LOCALE, hreflangPaths, localePath } from '@/model/seo';
import { LOCALES, isLocale } from '@/model/types';
import { Boot } from '@/view/components/Boot';
import '@fontsource-variable/saira';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@/styles/globals.css';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = DICTIONARIES[locale].meta;
  return {
    metadataBase: new URL(site.url),
    title: d.title,
    description: d.description,
    alternates: {
      canonical: localePath(locale),
      // es, pt, en y x-default (la página para quien no coincide con ninguno: el español).
      languages: hreflangPaths(),
    },
    openGraph: {
      title: d.title,
      description: d.description,
      type: 'website',
      siteName: site.owner,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      url: localePath(locale),
    },
    icons: { icon: '/favicon.svg' },
  };
}

export const viewport: Viewport = { themeColor: '#05070c', width: 'device-width', initialScale: 1 };

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    // suppressHydrationWarning: el script de <head> agrega `data-resume` a <html> antes de que React hidrate.
    // data-boot="loading": hasta que el banner de carga se retira (ver view/components/Boot.tsx) la entrada del
    // inicio espera y el logo se queda plano; Boot lo cambia a "ready".
    <html lang={locale} data-boot="loading" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: resumeScript }} />
      </head>
      <body>
        <Boot locale={locale} />
        {children}
      </body>
    </html>
  );
}
