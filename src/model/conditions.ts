/* ============================================================
 * MODELO — Evaluación de las condiciones del catálogo (funciones puras).
 * El servidor tiene la misma lógica en `landing_crm/intake/conditions.py`, y `catalog_cases.json` (lo exporta
 * scripts/export-catalog.mjs) comprueba que las dos calculen lo mismo.
 * ============================================================ */
import type { AnswerValue, Answers, Condition, ServiceId } from './types';

export interface ConditionContext {
  services: readonly ServiceId[];
  /** Solo las respuestas de las preguntas visibles anteriores: una respuesta vieja de una pregunta oculta no cuenta. */
  answers: Answers;
}

function ids(value: AnswerValue | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter((id) => id.trim() !== '');
}

export function evaluate(condition: Condition, ctx: ConditionContext): boolean {
  if ('all' in condition) return condition.all.every((c) => evaluate(c, ctx));
  if ('any' in condition) return condition.any.some((c) => evaluate(c, ctx));
  if ('not' in condition) return !evaluate(condition.not, ctx);
  if ('services' in condition) return condition.services.some((s) => ctx.services.includes(s));
  if ('onlyServices' in condition) return ctx.services.length > 0 && ctx.services.every((s) => condition.onlyServices.includes(s));
  if ('minServices' in condition) return ctx.services.length >= condition.minServices;
  if ('answered' in condition) return ids(ctx.answers[condition.answered]).length > 0;
  if ('in' in condition) return ids(ctx.answers[condition.answer]).some((id) => condition.in.includes(id));
  if ('only' in condition) {
    const chosen = ids(ctx.answers[condition.answer]);
    return chosen.length > 0 && chosen.every((id) => condition.only.includes(id));
  }
  throw new Error(`Condición desconocida: ${JSON.stringify(condition)}`);
}

/** Ids de las preguntas que mira una condición (para comprobar que solo mira hacia atrás). */
export function references(condition: Condition | undefined): string[] {
  if (!condition) return [];
  if ('all' in condition) return condition.all.flatMap(references);
  if ('any' in condition) return condition.any.flatMap(references);
  if ('not' in condition) return references(condition.not);
  if ('answered' in condition) return [condition.answered];
  if ('answer' in condition) return [condition.answer];
  return [];
}
