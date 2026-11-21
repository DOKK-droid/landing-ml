'use client';
/* ============================================================
 * CONTROLADOR — Hook que conecta la máquina de estados con la vista.
 * Persiste en sessionStorage para no perder respuestas al cambiar de idioma.
 * ============================================================ */
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildSections } from '@/model/catalog';
import { buildFlow } from '@/model/flow';
import { buildLines, buildMessage, buildWhatsAppUrl, createReference } from '@/model/message';
import type { AnswerValue, Locale, ServiceId } from '@/model/types';
import { criticalProgress } from '@/model/validation';
import { RESUME_ATTR, STORAGE_KEY } from './resume';
import { initialState, surveyReducer, type SurveyState } from './surveyReducer';

/** Espera tras la última tecla antes de guardar: evita serializar y escribir el estado completo en cada pulsación. */
const SAVE_DELAY_MS = 250;

export function useSurvey(locale: Locale) {
  const [state, dispatch] = useReducer(surveyReducer, initialState);
  // `ready`: ya se leyó el almacenamiento. Hasta entonces no se guarda nada, o se pisaría lo guardado con el
  // estado vacío (en desarrollo, Strict Mode ejecuta los efectos dos veces y lo hacía).
  const [ready, setReady] = useState(false);
  const pending = useRef<SurveyState | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: 'HYDRATE', state: JSON.parse(raw) });
    } catch {
      /* almacenamiento no disponible: se sigue en memoria */
    }
    // Trazabilidad: ?o=tarjeta (QR de la tarjeta) queda en el estado y viaja en el mensaje.
    const origin = new URLSearchParams(window.location.search).get('o');
    if (origin) dispatch({ type: 'SET_ORIGIN', origin });
    setReady(true); // mismo lote que HYDRATE: un único render con el estado restaurado
  }, []);

  // Con el estado ya restaurado y antes de pintar, se muestra la página (ver resume.ts).
  // Va en un efecto de layout para que los efectos de la vista (foco al título del paso) ya la encuentren visible.
  useLayoutEffect(() => {
    if (ready) document.documentElement.removeAttribute(RESUME_ATTR);
  }, [ready]);

  /** Escribe de inmediato el último estado pendiente (si lo hay). */
  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!pending.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending.current));
    } catch {
      /* ignorar */
    }
    pending.current = null;
  }, []);

  useEffect(() => {
    if (!ready) return;
    pending.current = state;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [ready, state, flush]);

  // Al cambiar de idioma (otra página) o cerrar la pestaña no se pierde lo último escrito.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, [flush]);

  const sections = useMemo(() => buildSections(state.selected), [state.selected]);
  const flow = useMemo(() => buildFlow(sections), [sections]);
  /** Pregunta que se está respondiendo (solo en la fase de preguntas). */
  const current = state.phase === 'survey' ? flow[state.cursor] : undefined;
  const focusId = current?.question.id;

  // El texto solo se usa en la revisión y al enviar: no se reconstruye mientras se escribe cada respuesta.
  const needsMessage = state.phase === 'review' || state.phase === 'sent';
  const generated = useMemo(
    () => (needsMessage ? buildMessage({ locale, selected: state.selected, sections, answers: state.answers, reference: state.reference, origin: state.origin }) : ''),
    [needsMessage, locale, state.selected, sections, state.answers, state.reference, state.origin],
  );

  // Vista previa en vivo mientras se responde. `useDeferredValue` deja que lo que se escribe tenga prioridad
  // y que la vista previa se ponga al día enseguida, sin trabarse en cada tecla.
  const inSurvey = state.phase === 'survey';
  const deferredAnswers = useDeferredValue(state.answers);
  const previewLines = useMemo(
    () => (inSurvey ? buildLines({ locale, selected: state.selected, sections, answers: deferredAnswers, reference: state.reference, origin: state.origin }, { pending: true, focusId }) : []),
    [inSurvey, locale, state.selected, sections, deferredAnswers, state.reference, state.origin, focusId],
  );
  const progress = useMemo(() => criticalProgress(sections, deferredAnswers), [sections, deferredAnswers]);
  const message = state.draft ?? generated;

  const actions = useMemo(
    () => ({
      toggleService: (id: ServiceId) => dispatch({ type: 'TOGGLE_SERVICE', id }),
      setService: (id: ServiceId, selected: boolean) => dispatch({ type: 'SET_SERVICE', id, selected }),
      clearServices: () => dispatch({ type: 'CLEAR_SERVICES' }),
      start: () => dispatch({ type: 'START', reference: createReference() }),
      setAnswer: (id: string, value: AnswerValue) => dispatch({ type: 'SET_ANSWER', id, value }),
      next: () => dispatch({ type: 'NEXT' }),
      back: () => dispatch({ type: 'BACK' }),
      goToSection: (section: number) => dispatch({ type: 'GO_TO_SECTION', section }),
      exit: () => dispatch({ type: 'EXIT' }),
      setDraft: (text: string) => dispatch({ type: 'SET_DRAFT', text }),
      markSent: () => dispatch({ type: 'SENT' }),
      restart: () => dispatch({ type: 'RESTART' }),
    }),
    [],
  );

  const whatsappUrl = useCallback(() => buildWhatsAppUrl(message), [message]);

  return {
    state,
    sections,
    flow,
    current,
    previewLines,
    progress,
    message,
    whatsappUrl,
    actions,
  };
}

export type SurveyController = ReturnType<typeof useSurvey>;
