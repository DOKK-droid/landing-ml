/* ============================================================
 * MODELO — Reglas de validación (puras).
 * ============================================================ */
import type { AnswerValue, Answers, Errors, Question, Section } from './types';

export function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim().length === 0;
}

/**
 * ¿La pregunta tiene una respuesta que realmente llegará al mensaje?
 * Una opción cuyo id ya no existe (p. ej. un relevamiento guardado antes de cambiar el catálogo) no cuenta:
 * el mensaje la omite, y no puede darse por respondido un dato que no se va a enviar.
 */
export function isAnswered(question: Question, value: AnswerValue | undefined): boolean {
  if (isEmpty(value)) return false;
  if (question.type === 'single' || question.type === 'multi') {
    const ids = Array.isArray(value) ? value : [value as string];
    return ids.some((id) => question.options?.some((opt) => opt.id === id));
  }
  return true;
}

/** Errores de una sola pregunta: la conversación valida de a una. */
export function validateQuestion(question: Question, answers: Answers): Errors {
  return question.required && !isAnswered(question, answers[question.id]) ? { [question.id]: 'required' } : {};
}

export function hasErrors(errors: Errors): boolean {
  return Object.keys(errors).length > 0;
}

export interface CriticalProgress {
  /** Datos obligatorios ya respondidos. */
  done: number;
  /** Datos obligatorios de todo el recorrido elegido (no solo del paso actual). */
  total: number;
  /** Ids de las preguntas obligatorias que faltan, en orden de aparición. */
  missing: string[];
}

/** Avance de la información crítica (las preguntas obligatorias) en todo el recorrido. */
export function criticalProgress(sections: Section[], answers: Answers): CriticalProgress {
  const missing: string[] = [];
  let total = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      if (!q.required) continue;
      total += 1;
      if (!isAnswered(q, answers[q.id])) missing.push(q.id);
    }
  }
  return { done: total - missing.length, total, missing };
}

/**
 * Origen de la visita (por ejemplo `?o=tarjeta` en el QR de la tarjeta).
 * Solo letras, números, guion y guion bajo, hasta 24 caracteres: viaja dentro del mensaje, así que se filtra.
 */
export function normalizeOrigin(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9_-]{1,24}$/i.test(value.trim()) ? value.trim().toLowerCase() : '';
}
