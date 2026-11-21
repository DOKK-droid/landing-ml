'use client';
/* Vista raíz: elige entre landing y relevamiento según la fase del controlador. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSurvey } from '@/controller/useSurvey';
import type { Locale, ServiceId } from '@/model/types';
import { EmergencyButton, SiteFooter, SiteHeader } from './components/Layout';
import { Approach, Concept, Hero, OfferSection, SelectionBar, ServicesSection } from './components/Sections';
import { hasHover, prefersReducedMotion, scrollBehavior, useReveal } from './motion';
import { SurveyView } from './survey/SurveyView';

export function App({ locale }: { locale: Locale }) {
  const ctrl = useSurvey(locale);
  const { state, actions } = ctrl;
  const inSurvey = state.phase !== 'landing';
  const [openId, setOpenId] = useState<ServiceId | null>(null);
  const [flashId, setFlashId] = useState<ServiceId | null>(null);
  const timers = useRef<number[]>([]);

  useReveal(!inSurvey);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const startOrPick = useCallback(() => {
    if (state.selected.length) {
      actions.start();
      return;
    }
    document.getElementById('servicios')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, [state.selected.length, actions]);

  /**
   * Desde el diagrama: lleva a la tarjeta del servicio.
   * Con mouse el detalle ya se abre al pasar el cursor (y no hay botón), así que solo se destaca la tarjeta
   * cuando termina el scroll. En táctil se abre el detalle, que allí es lo único que lo muestra.
   */
  const pickFromDiagram = useCallback((id: ServiceId) => {
    document.getElementById(`svc-${id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    if (!hasHover()) {
      setOpenId(id);
      return;
    }
    const wait = prefersReducedMotion() ? 0 : 450;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [
      window.setTimeout(() => setFlashId(id), wait),
      window.setTimeout(() => setFlashId(null), wait + 1300),
    ];
  }, []);

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <a className="skip" href="#contenido">↓</a>
      <SiteHeader locale={locale} onHome={actions.exit} compact={inSurvey} />
      {/* Fija bajo el menú (no ocupa lugar en el flujo): ver .selbar. */}
      {!inSurvey && <SelectionBar locale={locale} count={state.selected.length} onContinue={actions.start} onClear={actions.clearServices} />}
      {inSurvey ? (
        <SurveyView locale={locale} ctrl={ctrl} />
      ) : (
        <main id="contenido">
          <Hero locale={locale} onStart={startOrPick} />
          <Concept locale={locale} selected={state.selected} onPick={pickFromDiagram} />
          <ServicesSection locale={locale} selected={state.selected} openId={openId} flashId={flashId} onOpen={setOpenId} onToggle={actions.toggleService} />
          <OfferSection locale={locale} onStart={startOrPick} />
          <Approach locale={locale} />
        </main>
      )}
      <SiteFooter locale={locale} />
      {!inSurvey && <EmergencyButton locale={locale} />}
    </>
  );
}
