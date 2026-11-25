import type { Metadata } from 'next';
import { isLocale } from '@/model/types';
import { RatesPage } from '@/view/RatesPage';
import { pageMeta } from '../pageMeta';

// Los idiomas los genera el layout (`generateStaticParams` de [locale]): esta página se exporta una vez por idioma.

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? pageMeta(locale, 'rates') : {};
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RatesPage locale={isLocale(locale) ? locale : 'es'} />;
}
