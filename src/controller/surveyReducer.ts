/* ============================================================
 * CONTROLADOR — Máquina de estados del relevamiento (pura, testeable).
 *
 *   landing ──START──▶ survey(step 0..n-1) ──NEXT(último)──▶ review ──SENT──▶ sent
 *      ▲                  │ BACK(step 0)                       │ EDIT
 *      └──────────────────┘◀───────────────────────────────────┘
 * ============================================================ */
import { buildSections, isServiceId } from '@/model/catalog';
import { hasErrors, validateSection } from '@/model/validation';
import type { AnswerValue, Answers, Errors, ServiceId } from '@/model/types';

export type Phase = 'landing' | 'survey' | 'review' | 'sent';

export interface SurveyState {
  phase: Phase;
  selected: ServiceId[];
  step: number;
  answers: Answers;
  errors: Errors;
  reference: string;
  /** Texto editado a mano en la revisión; null = se genera desde las respuestas. */
  draft: string | null;
}

export type SurveyAction =
  | { type: 'TOGGLE_SERVICE'; id: ServiceId }
  | { type: 'SET_SERVICE'; id: ServiceId; selected: boolean }
  | { type: 'CLEAR_SERVICES' }
  | { type: 'START'; reference: string }
  | { type: 'SET_ANSWER'; id: string; value: AnswerValue }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'EXIT' }
  | { type: 'SET_DRAFT'; text: string }
  | { type: 'SENT' }
  | { type: 'RESTART' }
  | { type: 'HYDRATE'; state: SurveyState };

export const initialState: SurveyState = {
  phase: 'landing',
  selected: [],
  step: 0,
  answers: {},
  errors: {},
  reference: '',
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

    case 'START':
      if (!state.selected.length) return state;
      return { ...state, phase: 'survey', step: 0, errors: {}, reference: state.reference || action.reference };

    case 'SET_ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.id]: action.value },
        errors: withoutError(state.errors, action.id),
        draft: null,
      };

    case 'NEXT': {
      const sections = buildSections(state.selected);
      const section = sections[state.step];
      if (!section) return state;
      const errors = validateSection(section, state.answers);
      if (hasErrors(errors)) return { ...state, errors };
      const isLast = state.step >= sections.length - 1;
      return isLast ? { ...state, errors: {}, phase: 'review' } : { ...state, errors: {}, step: state.step + 1 };
    }

    case 'BACK':
      if (state.phase === 'review') return { ...state, phase: 'survey' };
      if (state.step === 0) return { ...state, phase: 'landing', errors: {} };
      return { ...state, step: state.step - 1, errors: {} };

    case 'GO_TO_STEP': {
      const total = buildSections(state.selected).length;
      const step = Math.min(Math.max(action.step, 0), total - 1);
      return { ...state, phase: 'survey', step, errors: {} };
    }

    case 'EXIT':
      return { ...state, phase: 'landing', errors: {} };

    case 'SET_DRAFT':
      return { ...state, draft: action.text };

    case 'SENT':
      return { ...state, phase: 'sent' };

    case 'RESTART':
      return initialState;

    case 'HYDRATE':
      return sanitize(action.state);

    default:
      return state;
  }
}

/** Valida un estado recuperado de sessionStorage (puede venir de otra versión). */
export function sanitize(raw: unknown): SurveyState {
  if (!raw || typeof raw !== 'object') return initialState;
  const s = raw as Partial<SurveyState>;
  const selected = Array.isArray(s.selected) ? s.selected.filter((id): id is ServiceId => typeof id === 'string' && isServiceId(id)) : [];
  const phase: Phase = s.phase && ['landing', 'survey', 'review', 'sent'].includes(s.phase) ? s.phase : 'landing';
  const total = buildSections(selected).length;
  const step = typeof s.step === 'number' ? Math.min(Math.max(s.step, 0), total - 1) : 0;
  return {
    phase: selected.length ? phase : 'landing',
    selected,
    step,
    answers: s.answers && typeof s.answers === 'object' ? (s.answers as Answers) : {},
    errors: {},
    reference: typeof s.reference === 'string' ? s.reference : '',
    draft: typeof s.draft === 'string' ? s.draft : null,
  };
}
