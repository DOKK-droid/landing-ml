import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { site } from '@/config/site';
import { DICTIONARIES } from '@/model/i18n';
import { LOCALES, isLocale } from '@/model/types';
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
      canonical: `/${locale}/`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/`])),
    },
    openGraph: { title: d.title, description: d.description, type: 'website', locale, url: `/${locale}/` },
    icons: { icon: '/favicon.svg' },
  };
}

export const viewport: Viewport = { themeColor: '#05070c', width: 'device-width', initialScale: 1 };

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Saira:wght@500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
