/* ============================================================
 * MODELO — Reglas de validación (puras).
 * ============================================================ */
import type { AnswerValue, Answers, Errors, Section } from './types';

export function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim().length === 0;
}

export function validateSection(section: Section, answers: Answers): Errors {
  const errors: Errors = {};
  for (const q of section.questions) {
    if (q.required && isEmpty(answers[q.id])) errors[q.id] = 'required';
  }
  return errors;
}

export function hasErrors(errors: Errors): boolean {
  return Object.keys(errors).length > 0;
}
