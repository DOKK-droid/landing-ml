'use client';
/* El relevamiento como una conversación guiada: sección actual bien visible arriba, la vista previa del
 * mensaje en el medio y, abajo, la pregunta en curso con su zona de respuesta. Una pregunta por vez. */
import type { SurveyController } from '@/controller/useSurvey';
import type { FlowStep } from '@/model/flow';
import { DICTIONARIES } from '@/model/i18n';
import type { Locale } from '@/model/types';
import { SectionIcon } from '../components/Icons';
import { useSwap } from '../motion';
import { Composer } from './Composer';
import { Preview } from './Preview';

/** Salida de la pregunta anterior y duración del "escribiendo…" antes de la siguiente (ms). */
const EXIT_MS = 170;
const TYPING_MS = 380;

export function Chat({ locale, ctrl, step }: { locale: Locale; ctrl: SurveyController; step: FlowStep }) {
  const { state, sections, flow, previewLines, progress, actions } = ctrl;
  const d = DICTIONARIES[locale].survey;
  const { section } = step;
  // El banner y la vista previa siguen a la pregunta actual al instante; la zona de respuesta cambia en secuencia.
  const { shown, phase } = useSwap(step, step.index, EXIT_MS, TYPING_MS);

  return (
    <div className="chat" style={{ '--c': section.color ?? 'var(--cyan)' } as React.CSSProperties}>
      <header className="chat__banner" key={section.id}>
        <span className="chat__tile"><SectionIcon sectionId={section.id} /></span>
        <div className="chat__heading">
          <p className="chat__kicker">
            {d.section(step.sectionIndex + 1, sections.length)}
            <span aria-hidden="true"> · </span>
            {d.question(step.position + 1, step.size)}
          </p>
          <h1 className="chat__title">{section.title[locale]}</h1>
        </div>
        <div className="chat__dots" role="img" aria-label={d.question(step.position + 1, step.size)}>
          {Array.from({ length: step.size }, (_, i) => (
            <i key={i} className={i < step.position ? 'is-done' : i === step.position ? 'is-now' : ''} />
          ))}
        </div>
      </header>

      <Preview
        locale={locale}
        lines={previewLines}
        progress={progress}
        currentSectionId={section.id}
        currentQuestionId={step.question.id}
      />

      <Composer
        locale={locale}
        step={shown}
        phase={phase}
        isLast={shown.index === flow.length - 1}
        value={state.answers[shown.question.id]}
        error={Boolean(state.errors[shown.question.id])}
        onAnswer={(value) => actions.setAnswer(shown.question.id, value)}
        onNext={actions.next}
        onBack={actions.back}
      />
    </div>
  );
}
