/* Ayudas compartidas por las pruebas del relevamiento (v4: el recorrido depende de las respuestas). */
import { buildSections } from '@/model/catalog';
import type { Answers, AnswerValue, Question, ServiceId } from '@/model/types';
import { isAnswered, isRequired } from '@/model/validation';

/** Una respuesta válida para la pregunta: la primera opción, o un texto con la forma que pide. */
export function sampleAnswer(q: Question, text = 'Texto de prueba'): AnswerValue {
  if (q.type === 'multi') return [q.options![0].id];
  if (q.type === 'single') return q.options![0].id;
  if (q.format === 'email') return 'ana@empresa.com';
  if (q.format === 'phone') return '+54 9 11 1234 5678';
  if (q.format === 'url') return 'empresa.com';
  return text;
}

/**
 * Completa todo lo obligatorio del recorrido. Se repite hasta que no falte nada, porque una respuesta puede sumar
 * preguntas obligatorias más adelante (p. ej. sin correo, el teléfono pasa a serlo).
 */
export function fillRequired(selected: readonly ServiceId[], answers: Answers = {}, base: Answers = {}): Answers {
  let current: Answers = { ...base, ...answers };
  for (let round = 0; round < 10; round++) {
    const missing = buildSections(selected, current).flatMap((s) => s.questions).filter((q) => isRequired(q) && !isAnswered(q, current[q.id]));
    if (!missing.length) return current;
    for (const q of missing) current = { ...current, [q.id]: sampleAnswer(q) };
  }
  throw new Error('fillRequired no converge');
}

/** Ids de las preguntas visibles para estas respuestas. */
export function visibleIds(selected: readonly ServiceId[], answers: Answers): string[] {
  return buildSections(selected, answers).flatMap((s) => s.questions.map((q) => q.id));
}
