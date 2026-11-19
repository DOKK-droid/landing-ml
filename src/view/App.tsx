'use client';
/* Vista raíz: elige entre landing y relevamiento según la fase del controlador. */
import { useCallback } from 'react';
import { useSurvey } from '@/controller/useSurvey';
import type { Locale } from '@/model/types';
import { EmergencyButton, SiteFooter, SiteHeader } from './components/Layout';
import { Approach, Hero, HowItWorks, SelectionBar, ServicesSection } from './components/Sections';
import { SurveyView } from './survey/SurveyView';

export function App({ locale }: { locale: Locale }) {
  const ctrl = useSurvey(locale);
  const { state, actions } = ctrl;
  const inSurvey = state.phase !== 'landing';

  const startOrPick = useCallback(() => {
    if (state.selected.length) {
      actions.start();
      return;
    }
    const target = document.getElementById('servicios');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.classList.add('pulse');
    setTimeout(() => target?.classList.remove('pulse'), 1600);
  }, [state.selected.length, actions]);

  return (
    <>
      <a className="skip" href="#contenido">↓</a>
      <SiteHeader locale={locale} onHome={actions.exit} compact={inSurvey} />
      {inSurvey ? (
        <SurveyView locale={locale} ctrl={ctrl} />
      ) : (
        <main id="contenido">
          <Hero locale={locale} onStart={startOrPick} />
          <HowItWorks locale={locale} />
          <ServicesSection locale={locale} selected={state.selected} onToggle={actions.toggleService} onSet={actions.setService} />
          <Approach locale={locale} />
          <SelectionBar locale={locale} count={state.selected.length} onContinue={actions.start} onClear={actions.clearServices} />
        </main>
      )}
      <SiteFooter locale={locale} />
      {!inSurvey && <EmergencyButton locale={locale} raised={state.selected.length > 0} />}
    </>
  );
}
