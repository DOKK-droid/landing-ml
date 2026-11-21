'use client';
/* Vista del relevamiento: conversación guiada (Chat), revisión del mensaje y confirmación. */
import { useEffect, useRef, useState } from 'react';
import type { SurveyController } from '@/controller/useSurvey';
import { DICTIONARIES } from '@/model/i18n';
import { SAFE_URL_LENGTH } from '@/model/message';
import type { Locale } from '@/model/types';
import { ArrowIcon, CheckIcon, WhatsAppIcon } from '../components/Icons';
import { Chat } from './Chat';

export function SurveyView({ locale, ctrl }: { locale: Locale; ctrl: SurveyController }) {
  const { state, sections, current, actions } = ctrl;
  const d = DICTIONARIES[locale].survey;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = sections.length + 1; // + revisión
  const reviewing = state.phase === 'review';
  const sectionIndex = reviewing ? sections.length : (current?.sectionIndex ?? 0);
  const stepNumber = sectionIndex + 1;

  // Al entrar al relevamiento o a la revisión se parte desde arriba; en la revisión el foco va al título.
  // (Durante las preguntas, de llevar el foco a cada pregunta se ocupa el Composer.)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    if (state.phase === 'review') headingRef.current?.focus();
  }, [state.phase]);

  if (state.phase === 'sent') return <SentView locale={locale} onRestart={actions.restart} />;

  return (
    <main className="survey container" id="contenido">
      <div className="survey__frame">
        <div className="survey__top">
          <button type="button" className="link" onClick={actions.exit}>
            <ArrowIcon className="icon" dir="left" /> {d.exit}
          </button>
          <span className="survey__ref">{state.reference}</span>
        </div>

        <ol className="progress" aria-label={d.step(stepNumber, total)}>
          {sections.map((s, i) => {
            const status = reviewing || i < sectionIndex ? 'done' : i === sectionIndex ? 'current' : 'todo';
            return (
              <li key={s.id} className={`progress__item progress__item--${status}`} style={s.color ? ({ '--c': s.color } as React.CSSProperties) : undefined}>
                <button type="button" disabled={status === 'todo'} onClick={() => actions.goToSection(i)} aria-current={status === 'current' ? 'step' : undefined}>
                  <span className="progress__dot">{status === 'done' ? <CheckIcon className="icon" /> : i + 1}</span>
                  <span className="progress__label">{s.title[locale]}</span>
                </button>
              </li>
            );
          })}
          <li className={`progress__item progress__item--${reviewing ? 'current' : 'todo'}`}>
            <button type="button" disabled aria-current={reviewing ? 'step' : undefined}>
              <span className="progress__dot">{total}</span>
              <span className="progress__label">WhatsApp</span>
            </button>
          </li>
        </ol>

        {reviewing ? (
          <ReviewView locale={locale} ctrl={ctrl} headingRef={headingRef} stepLabel={d.step(stepNumber, total)} />
        ) : current ? (
          <Chat locale={locale} ctrl={ctrl} step={current} />
        ) : null}
      </div>
    </main>
  );
}

function ReviewView({ locale, ctrl, headingRef, stepLabel }: {
  locale: Locale; ctrl: SurveyController; headingRef: React.RefObject<HTMLHeadingElement | null>; stepLabel: string;
}) {
  const d = DICTIONARIES[locale].review;
  const [copied, setCopied] = useState(false);
  const url = ctrl.whatsappUrl();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ctrl.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* el usuario puede copiar manualmente del área de texto */
    }
  };

  return (
    <section className="panel">
      <p className="panel__step">{stepLabel}</p>
      <h1 className="panel__title" tabIndex={-1} ref={headingRef}>{d.title}</h1>
      <p className="panel__intro">{d.lead}</p>

      <label className="sr-only" htmlFor="msg">{d.title}</label>
      <textarea id="msg" className="message" value={ctrl.message} onChange={(e) => ctrl.actions.setDraft(e.target.value)} rows={18} spellCheck />
      {url.length > SAFE_URL_LENGTH && <p className="alert">{d.tooLong}</p>}

      <div className="panel__nav panel__nav--review">
        <button type="button" className="btn btn--ghost" onClick={ctrl.actions.back}>
          <ArrowIcon className="icon" dir="left" /> {d.edit}
        </button>
        <button type="button" className="btn btn--ghost" onClick={copy} aria-live="polite">
          {copied ? <><CheckIcon className="icon" /> {d.copied}</> : d.copy}
        </button>
        <a className="btn btn--whatsapp" href={url} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(ctrl.actions.markSent, 400)}>
          <WhatsAppIcon className="icon" /> {d.send}
        </a>
      </div>
    </section>
  );
}

function SentView({ locale, onRestart }: { locale: Locale; onRestart: () => void }) {
  const d = DICTIONARIES[locale].review;
  return (
    <main className="survey container" id="contenido">
      <div className="survey__frame">
        <section className="panel panel--center">
          <span className="sent__icon"><CheckIcon className="icon" /></span>
          <h1 className="panel__title">{d.sent}</h1>
          <button type="button" className="btn btn--ghost" onClick={onRestart}>{d.restart}</button>
        </section>
      </div>
    </main>
  );
}
