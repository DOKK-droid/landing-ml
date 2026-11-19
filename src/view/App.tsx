'use client';
/* Vista raíz: elige entre landing y relevamiento según la fase del controlador. */
import { useCallback, useState } from 'react';
import { useSurvey } from '@/controller/useSurvey';
import type { Locale, ServiceId } from '@/model/types';
import { EmergencyButton, SiteFooter, SiteHeader } from './components/Layout';
import { Approach, Concept, Hero, SelectionBar, ServicesSection } from './components/Sections';
import { SurveyView } from './survey/SurveyView';

export function App({ locale }: { locale: Locale }) {
  const ctrl = useSurvey(locale);
  const { state, actions } = ctrl;
  const inSurvey = state.phase !== 'landing';
  const [openId, setOpenId] = useState<ServiceId | null>(null);

  const startOrPick = useCallback(() => {
    if (state.selected.length) {
      actions.start();
      return;
    }
    document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [state.selected.length, actions]);

  /** Desde el diagrama: lleva a la tarjeta del servicio y abre su detalle. */
  const pickFromDiagram = useCallback((id: ServiceId) => {
    setOpenId(id);
    document.getElementById(`svc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <a className="skip" href="#contenido">↓</a>
      <SiteHeader locale={locale} onHome={actions.exit} compact={inSurvey} />
      {inSurvey ? (
        <SurveyView locale={locale} ctrl={ctrl} />
      ) : (
        <main id="contenido">
          <Hero locale={locale} onStart={startOrPick} />
          <Concept locale={locale} selected={state.selected} onPick={pickFromDiagram} />
          <ServicesSection locale={locale} selected={state.selected} openId={openId} onOpen={setOpenId} onToggle={actions.toggleService} />
          <Approach locale={locale} />
          <SelectionBar locale={locale} count={state.selected.length} onContinue={actions.start} onClear={actions.clearServices} />
        </main>
      )}
      <SiteFooter locale={locale} />
      {!inSurvey && <EmergencyButton locale={locale} raised={state.selected.length > 0} />}
    </>
  );
}
