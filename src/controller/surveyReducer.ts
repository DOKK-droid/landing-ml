/* ============================================================
 * CONTROLADOR — Máquina de estados del relevamiento (pura, testeable).
 * El relevamiento es una conversación: una pregunta por vez. `cursor` es la posición de la pregunta actual
 * en la lista aplanada de preguntas (ver model/flow.ts).
 *
 *   landing ──START──▶ survey(cursor 0..n-1) ──NEXT(última)──▶ review ──SENT──▶ sent
 *      ▲                  │ BACK(cursor 0)                       │ BACK
 *      └──────────────────┘◀─────────────────────────────────────┘
 * ============================================================ */
import { site } from '@/config/site';
import { buildSections, isServiceId } from '@/model/catalog';
import { buildFlow, firstStepOfSection } from '@/model/flow';
import { isServerReference, isValidReference } from '@/model/message';
import { normalizeOrigin, validateQuestion } from '@/model/validation';
import type { AnswerValue, Answers, Errors, Section, ServiceId } from '@/model/types';

export type Phase = 'landing' | 'survey' | 'review' | 'sent';

export interface SurveyState {
  phase: Phase;
  selected: ServiceId[];
  /** Pregunta actual (posición en `buildFlow`). */
  cursor: number;
  answers: Answers;
  errors: Errors;
  reference: string;
  /** Origen de la visita (p. ej. "tarjeta" desde el QR). Se conserva al cambiar de idioma. */
  origin: string;
  /** Texto editado a mano en la revisión; null = se genera desde las respuestas. */
  draft: string | null;
}

export type SurveyAction =
  | { type: 'TOGGLE_SERVICE'; id: ServiceId }
  | { type: 'SET_SERVICE'; id: ServiceId; selected: boolean }
  | { type: 'CLEAR_SERVICES' }
  | { type: 'START'; reference: string }
  | { type: 'SET_ORIGIN'; origin: string }
  | { type: 'SET_ANSWER'; id: string; value: AnswerValue }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO_TO_SECTION'; section: number }
  | { type: 'EXIT' }
  | { type: 'SET_DRAFT'; text: string }
  | { type: 'SENT' }
  | { type: 'REGISTERED'; reference: string }
  | { type: 'RESTART' }
  | { type: 'HYDRATE'; state: SurveyState };

export const initialState: SurveyState = {
  phase: 'landing',
  selected: [],
  cursor: 0,
  answers: {},
  errors: {},
  reference: '',
  origin: '',
  draft: null,
};

function withoutError(errors: Errors, id: string): Errors {
  if (!(id in errors)) return errors;
  const next = { ...errors };
  delete next[id];
  return next;
}

export function surveyReducer(state: SurveyState, action: SurveyAction): SurveyState {
  switch (action.type) {
    case 'TOGGLE_SERVICE': {
      const on = !state.selected.includes(action.id);
      return surveyReducer(state, { type: 'SET_SERVICE', id: action.id, selected: on });
    }
    case 'SET_SERVICE': {
      const has = state.selected.includes(action.id);
      if (has === action.selected) return state;
      const selected = action.selected ? [...state.selected, action.id] : state.selected.filter((s) => s !== action.id);
      return { ...state, selected, draft: null };
    }
    case 'CLEAR_SERVICES':
      return { ...state, selected: [], draft: null };

    case 'SET_ORIGIN': {
      // Gana el primero: si la visita ya tenía origen, un enlace posterior no lo pisa.
      const origin = state.origin || normalizeOrigin(action.origin);
      return origin === state.origin ? state : { ...state, origin };
    }

    case 'START':
      if (!state.selected.length) return state;
      return { ...state, phase: 'survey', cursor: 0, errors: {}, reference: state.reference || action.reference };

    case 'SET_ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.id]: action.value },
        errors: withoutError(state.errors, action.id),
        draft: null,
      };

    case 'NEXT': {
      // Avanza una pregunta. Una obligatoria sin responder no deja pasar; una opcional sin responder se omite.
      const flow = buildFlow(buildSections(state.selected));
      const step = flow[state.cursor];
      if (!step || state.phase !== 'survey') return state;
      const errors = validateQuestion(step.question, state.answers);
      if (Object.keys(errors).length) return { ...state, errors };
      const isLast = state.cursor >= flow.length - 1;
      return isLast ? { ...state, errors: {}, phase: 'review' } : { ...state, errors: {}, cursor: state.cursor + 1 };
    }

    case 'BACK': {
      if (state.phase === 'review') {
        const last = buildFlow(buildSections(state.selected)).length - 1;
        return { ...state, phase: 'survey', cursor: Math.max(last, 0), errors: {} };
      }
      if (state.cursor === 0) return { ...state, phase: 'landing', errors: {} };
      return { ...state, cursor: state.cursor - 1, errors: {} };
    }

    case 'GO_TO_SECTION': {
      // Solo hacia atrás (o hasta la sección actual): saltar adelante dejaría obligatorias sin responder.
      const flow = buildFlow(buildSections(state.selected));
      const current = state.phase === 'review' ? Infinity : (flow[state.cursor]?.sectionIndex ?? 0);
      const target = firstStepOfSection(flow, action.section);
      if (target < 0 || action.section > current) return state;
      return { ...state, phase: 'survey', cursor: target, errors: {} };
    }

    case 'EXIT':
      return { ...state, phase: 'landing', errors: {} };

    case 'SET_DRAFT':
      return { ...state, draft: action.text };

    case 'SENT':
      return { ...state, phase: 'sent' };

    case 'REGISTERED': {
      // Desde que el CRM la registró, la consulta usa la referencia del servidor: arriba, en el mensaje (también en el
      // editado a mano) y en un reenvío. Así el cliente ve la misma referencia que llegó a WhatsApp y al CRM.
      if (!isServerReference(action.reference) || action.reference === state.reference) return state;
      const draft = state.draft && state.reference ? state.draft.split(state.reference).join(action.reference) : state.draft;
      return { ...state, reference: action.reference, draft };
    }

    case 'RESTART':
      return { ...initialState, origin: state.origin };

    case 'HYDRATE':
      return sanitize(action.state);

    default:
      return state;
  }
}

/** Largo máximo de un id de opción guardado y del mensaje editado a mano en la revisión. */
const MAX_OPTION_ID = 64;
const MAX_DRAFT = 20_000;

/**
 * Deja solo lo que la interfaz podría haber guardado: respuestas de preguntas que existen en el recorrido elegido,
 * del tipo que corresponde y dentro de los límites de largo. Lo demás se descarta, porque `sessionStorage` puede
 * haber sido editado a mano o venir de otra versión, y cada valor termina en pantalla y en el mensaje.
 */
function sanitizeAnswers(raw: unknown, sections: Section[]): Answers {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const answers: Answers = {};
  for (const question of sections.flatMap((section) => section.questions)) {
    const value = source[question.id];
    if (question.type === 'multi') {
      if (!Array.isArray(value)) continue;
      const ids = [...new Set(value.filter((id): id is string => typeof id === 'string'))]
        .map((id) => id.slice(0, MAX_OPTION_ID))
        .slice(0, question.options?.length ?? 0);
      if (ids.length) answers[question.id] = ids;
    } else if (typeof value === 'string') {
      const max = question.type === 'textarea' ? site.maxTextLength : question.type === 'text' ? site.maxLineLength : MAX_OPTION_ID;
      answers[question.id] = value.slice(0, max);
    }
  }
  return answers;
}

/** Valida un estado recuperado de sessionStorage (puede venir de otra versión o haber sido manipulado). */
export function sanitize(raw: unknown): SurveyState {
  if (!raw || typeof raw !== 'object') return initialState;
  const s = raw as Partial<Record<keyof SurveyState, unknown>>;
  const selected = Array.isArray(s.selected)
    ? [...new Set(s.selected.filter((id): id is ServiceId => typeof id === 'string' && isServiceId(id)))]
    : [];
  const sections = buildSections(selected);
  const total = buildFlow(sections).length;
  const cursor = typeof s.cursor === 'number' && Number.isFinite(s.cursor) ? Math.min(Math.max(Math.trunc(s.cursor), 0), total - 1) : 0;
  const reference = isValidReference(s.reference) ? s.reference : '';
  const stored = typeof s.phase === 'string' && ['landing', 'survey', 'review', 'sent'].includes(s.phase) ? (s.phase as Phase) : 'landing';
  return {
    // Sin servicios o sin una referencia válida no hay relevamiento que retomar: START siempre asigna una.
    phase: selected.length && reference ? stored : 'landing',
    selected,
    cursor,
    answers: sanitizeAnswers(s.answers, sections),
    errors: {},
    reference,
    origin: normalizeOrigin(s.origin),
    draft: typeof s.draft === 'string' ? s.draft.slice(0, MAX_DRAFT) : null,
  };
}
