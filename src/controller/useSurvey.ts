'use client';
/* ============================================================
 * CONTROLADOR — Hook que conecta la máquina de estados con la vista.
 * Persiste en sessionStorage para no perder respuestas al cambiar de idioma.
 * ============================================================ */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { buildSections } from '@/model/catalog';
import { buildMessage, buildWhatsAppUrl, createReference } from '@/model/message';
import type { AnswerValue, Locale, ServiceId } from '@/model/types';
import { initialState, surveyReducer } from './surveyReducer';

const STORAGE_KEY = 'ml-relevamiento-v1';

export function useSurvey(locale: Locale) {
  const [state, dispatch] = useReducer(surveyReducer, initialState);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: 'HYDRATE', state: JSON.parse(raw) });
    } catch {
      /* almacenamiento no disponible: se sigue en memoria */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignorar */
    }
  }, [state]);

  const sections = useMemo(() => buildSections(state.selected), [state.selected]);

  const generated = useMemo(
    () => buildMessage({ locale, selected: state.selected, sections, answers: state.answers, reference: state.reference }),
    [locale, state.selected, sections, state.answers, state.reference],
  );
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
      goToStep: (step: number) => dispatch({ type: 'GO_TO_STEP', step }),
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
    currentSection: sections[state.step],
    message,
    whatsappUrl,
    actions,
  };
}

export type SurveyController = ReturnType<typeof useSurvey>;
