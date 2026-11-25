'use client';
/* Vista de la página de tarifas (/es/tarifas/): el relevamiento técnico con su tarifa por tramos, fuera del inicio.
 * No tiene relevamiento ni estado propio: para pedir la consulta se vuelve al inicio, donde se eligen los servicios. */
import type { Locale } from '@/model/types';
import { EmergencyButton, SiteFooter, SiteHeader } from './components/Layout';
import { OfferSection } from './components/Sections';
import { useReveal } from './motion';

export function RatesPage({ locale }: { locale: Locale }) {
  useReveal(true);
  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <a className="skip" href="#contenido">↓</a>
      <SiteHeader locale={locale} page="rates" />
      <main id="contenido" className="rates">
        <OfferSection locale={locale} />
      </main>
      <SiteFooter locale={locale} />
      <EmergencyButton locale={locale} />
    </>
  );
}
