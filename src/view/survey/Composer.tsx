'use client';
/* Zona de respuesta de la conversación: muestra la pregunta actual y la forma de contestarla.
 * Una pregunta por vez: opciones como chips (una o varias) o un campo de texto con botón de enviar.
 * Al elegir una opción única se pasa sola a la siguiente; en el resto se avanza con el botón.
 * En una de varias, una opción exclusiva («Todavía nada», «No lo sé») desmarca las demás y viceversa. Un correo, un
 * teléfono o una web con otra forma no dejan pasar, y un error de tipeo conocido en el correo se ofrece corregido. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { site } from '@/config/site';
import type { FlowStep } from '@/model/flow';
import { DICTIONARIES } from '@/model/i18n';
import type { AnswerValue, ErrorKind, Locale, Question } from '@/model/types';
import { isAnswered, isRequired, suggestEmail } from '@/model/validation';
import { ArrowIcon, CheckIcon } from '../components/Icons';
import { hasHover, type SwapPhase } from '../motion';

/** Pausa tras elegir una opción única, antes de pasar a la siguiente: deja ver la elección y el cambio en la vista previa. */
export const PICK_DELAY_MS = 320;
/** Alto máximo del campo de texto que crece mientras se escribe. */
const MAX_TEXTAREA_PX = 150;

/** Las opciones marcadas tras tocar `id` en una pregunta de varias: una exclusiva queda sola; otra la desmarca. */
export function toggleChoice(question: Question, current: string[], id: string): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  const exclusive = new Set(question.options?.filter((opt) => opt.exclusive).map((opt) => opt.id));
  return exclusive.has(id) ? [id] : [...current.filter((x) => !exclusive.has(x)), id];
}

/** Teclado del celular según el formato pedido (si la pregunta no trae uno propio). */
const INPUT_MODE = { email: 'email', phone: 'tel', url: 'url' } as const;

interface ComposerProps {
  locale: Locale;
  step: FlowStep;
  phase: SwapPhase;
  isLast: boolean;
  value: AnswerValue | undefined;
  /** Por qué no puede avanzar: falta el dato o el texto no tiene la forma pedida. */
  error?: ErrorKind;
  onAnswer: (value: AnswerValue) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Composer({ locale, step, phase, isLast, value, error, onAnswer, onNext, onBack }: ComposerProps) {
  const d = DICTIONARIES[locale].survey;
  const q = step.question;
  const qid = `q-${q.id}`;
  const multi = q.type === 'multi';
  const isChoice = q.type === 'single' || multi;
  const answered = isAnswered(q, value);
  const required = isRequired(q);
  const text = typeof value === 'string' ? value : '';
  const suggestion = q.format === 'email' ? suggestEmail(text) : null;

  const questionRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  /** Lleva el foco a lo que hay que atender: el campo (si hay mouse; en táctil abriría el teclado sin pedirlo) o la pregunta. */
  const focusAnswer = () => {
    const target = !isChoice && hasHover() ? inputRef.current : questionRef.current;
    target?.focus({ preventScroll: true });
  };
  useEffect(() => {
    if (phase === 'ready') focusAnswer();
  }, [phase, q.id]);
  useEffect(() => {
    if (error && phase === 'ready') focusAnswer();
  }, [error]);

  // El campo de texto crece con lo que se escribe, hasta un tope.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (q.type !== 'textarea' || !el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [text, q.type, phase]);

  const go = () => {
    clearTimer();
    onNext();
  };
  const pick = (id: string) => {
    onAnswer(id);
    clearTimer();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onNext();
    }, PICK_DELAY_MS);
  };
  const toggle = (id: string) => onAnswer(toggleChoice(q, Array.isArray(value) ? value : [], id));

  if (phase === 'typing') {
    return (
      <form className="composer" onSubmit={(e) => e.preventDefault()}>
        <div className="composer__stage composer__stage--typing" key="typing" role="status">
          <span className="avatar" aria-hidden="true">ML</span>
          <span className="bubble bubble--typing" aria-hidden="true"><i /><i /><i /></span>
          <span className="sr-only">{d.preparing}</span>
        </div>
      </form>
    );
  }

  // Obligatoria sin responder: no hay "siguiente". Opcional sin responder: el mismo botón es "Omitir".
  const forward = answered || required ? (isLast ? d.review : d.next) : d.skip;
  const showForward = isChoice && (multi || answered || !required);
  const showSkip = !isChoice && !required && !answered;
  const intro = step.position === 0 ? step.section.intro?.[locale] : undefined;
  const help = q.help?.[locale];
  const describedBy = [help && `${qid}-help`, error && `${qid}-err`].filter(Boolean).join(' ') || undefined;
  const errorText = error === 'format' && q.format ? d.invalid[q.format] : d.fieldRequired;
  const common = {
    id: `f-${q.id}`,
    ref: inputRef,
    value: text,
    placeholder: q.placeholder?.[locale] ?? d.answerPlaceholder,
    maxLength: q.maxLength ?? (q.type === 'textarea' ? site.maxTextLength : site.maxLineLength),
    'aria-labelledby': qid,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onAnswer(e.target.value),
  };

  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); go(); }} noValidate>
      <div className="composer__stage" key={q.id} data-question={q.id} inert={phase === 'leaving'}>
        {intro && <p className="bubble bubble--intro">{intro}</p>}

        <div className="chat-msg">
          <span className="avatar" aria-hidden="true">ML</span>
          <div className="bubble bubble--q">
            <h2 id={qid} ref={questionRef} tabIndex={-1} className="bubble__text">{q.label[locale]}</h2>
            {help && <p className="bubble__help" id={`${qid}-help`}>{help}</p>}
            <p className="bubble__meta">
              <span className={`tag ${required ? 'tag--req' : ''}`}>{required ? d.required : d.optional}</span>
              {isChoice && <span>{multi ? d.chooseAny : d.chooseOne}</span>}
            </p>
          </div>
        </div>

        <div className={`answer ${error ? 'is-error' : ''}`}>
          {isChoice ? (
            <div className="chips" role="group" aria-labelledby={qid} aria-describedby={describedBy}>
              {q.options?.map((opt, i) => {
                const on = multi ? Array.isArray(value) && value.includes(opt.id) : value === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`chip ${on ? 'chip--on' : ''}`}
                    aria-pressed={on}
                    style={{ '--i': i } as React.CSSProperties}
                    onClick={() => (multi ? toggle(opt.id) : pick(opt.id))}
                  >
                    {on && <CheckIcon className="icon" />}
                    <span>{opt.label[locale]}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="answer__row">
                {q.type === 'textarea' ? (
                  <textarea
                    {...common}
                    rows={2}
                    onKeyDown={(e) => {
                      // Como en un chat: Enter envía y Mayús+Enter agrega una línea (solo con teclado físico).
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && hasHover()) {
                        e.preventDefault();
                        e.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                ) : (
                  <input
                    {...common}
                    type={q.format === 'phone' ? 'tel' : 'text'}
                    autoComplete={q.autoComplete}
                    inputMode={q.inputMode ?? (q.format ? INPUT_MODE[q.format] : undefined)}
                    spellCheck={q.format ? false : undefined}
                    autoCapitalize={q.format ? 'off' : undefined}
                    enterKeyHint={isLast ? 'done' : 'next'}
                  />
                )}
                <button type="submit" className="answer__send" aria-label={isLast ? d.review : d.send}>
                  <ArrowIcon className="icon" />
                </button>
              </div>
              {q.type === 'textarea' && (
                <p className="answer__meta" aria-hidden="true">
                  <span className="answer__hint">{d.enterHint}</span>
                  <span>{text.length}/{site.maxTextLength}</span>
                </p>
              )}
            </>
          )}

          {suggestion && (
            <p className="answer__suggest">
              <button type="button" className="link" onClick={() => onAnswer(suggestion)}>
                {d.suggest} <strong>{suggestion}</strong>?
              </button>
            </p>
          )}
          {error && <p className="answer__error" id={`${qid}-err`} role="alert">{errorText}</p>}

          <div className="answer__nav">
            <button type="button" className="link" onClick={() => { clearTimer(); onBack(); }}>
              <ArrowIcon className="icon" dir="left" /> {d.back}
            </button>
            {showSkip && <button type="button" className="link" onClick={go}>{d.skip}</button>}
            {showForward && (
              <button type="button" className={`btn ${answered || required ? 'btn--primary' : 'btn--ghost'} btn--sm`} onClick={go}>
                {forward} {(answered || required) && <ArrowIcon className="icon" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
