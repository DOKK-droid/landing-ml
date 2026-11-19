import { isLocale } from '@/model/types';
import { App } from '@/view/App';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <App locale={isLocale(locale) ? locale : 'es'} />;
}
