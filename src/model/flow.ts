/* ============================================================
 * MODELO — El relevamiento como una conversación: una pregunta por vez.
 * Aplana las secciones en una lista ordenada de pasos; el controlador solo guarda la posición (`cursor`).
 * ============================================================ */
import type { Question, Section } from './types';

export interface FlowStep {
  /** Posición en toda la conversación (0 = primera pregunta). */
  index: number;
  sectionIndex: number;
  section: Section;
  question: Question;
  /** Posición de la pregunta dentro de su sección (0 = primera) y cantidad de preguntas de la sección. */
  position: number;
  size: number;
}

export function buildFlow(sections: Section[]): FlowStep[] {
  const steps: FlowStep[] = [];
  sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question, position) => {
      steps.push({ index: steps.length, sectionIndex, section, question, position, size: section.questions.length });
    });
  });
  return steps;
}

/** Posición de la primera pregunta de una sección (-1 si no existe). */
export function firstStepOfSection(flow: FlowStep[], sectionIndex: number): number {
  return flow.findIndex((step) => step.sectionIndex === sectionIndex);
}
