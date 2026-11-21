/* QA del recorrido completo: se recorre el relevamiento tal como lo haría un cliente, para las 63 combinaciones
 * de servicios, y se comprueba que la vista previa sea fiel al mensaje que realmente se envía. */
import { describe, expect, it } from 'vitest';
import { initialState, surveyReducer, type SurveyState } from '@/controller/surveyReducer';
import { buildSections, SERVICES } from '@/model/catalog';
import { buildFlow } from '@/model/flow';
import { buildLines, buildMessage, buildWhatsAppUrl, linesToText, SAFE_URL_LENGTH, SURVEY_VERSION, type MessageInput } from '@/model/message';
import { LOCALES, type Answers, type Question, type ServiceId } from '@/model/types';
import { criticalProgress } from '@/model/validation';
import { site } from '@/config/site';

/** Las 63 combinaciones no vacías de servicios. */
const COMBINATIONS: ServiceId[][] = Array.from({ length: 2 ** SERVICES.length - 1 }, (_, i) =>
  SERVICES.filter((_, bit) => ((i + 1) >> bit) & 1).map((s) => s.id),
);

const shortAnswer = (q: Question) =>
  q.type === 'multi' ? [q.options![0].id] : q.type === 'single' ? q.options![0].id : `Respuesta ${q.id}`;

/** Recorre el relevamiento como un cliente: una pregunta por vez, respondiendo solo lo obligatorio (o todo). */
function walk(selected: ServiceId[], { answerAll = false } = {}) {
  let s: SurveyState = initialState;
  for (const id of selected) s = surveyReducer(s, { type: 'TOGGLE_SERVICE', id });
  s = surveyReducer(s, { type: 'START', reference: 'ML-261120-TEST' });

  const sections = buildSections(selected);
  const flow = buildFlow(sections);
  const visited: string[] = [];
  flow.forEach((step, i) => {
    const { question: q } = step;
    expect(s.phase, `${q.id}: sigue en el relevamiento`).toBe('survey');
    expect(s.cursor, `${q.id}: pregunta esperada`).toBe(i);
    visited.push(q.id);

    if (q.required) {
      // Sin responder no avanza y marca exactamente esa pregunta.
      const blocked = surveyReducer(s, { type: 'NEXT' });
      expect(blocked.cursor, `${q.id}: no avanza vacía`).toBe(i);
      expect(Object.keys(blocked.errors), `${q.id}: errores`).toEqual([q.id]);
    }
    if (q.required || answerAll) s = surveyReducer(s, { type: 'SET_ANSWER', id: q.id, value: shortAnswer(q) });
    s = surveyReducer(s, { type: 'NEXT' });
  });
  return { state: s, sections, flow, visited };
}

const inputFor = (selected: ServiceId[], answers: Answers, locale: MessageInput['locale'] = 'es'): MessageInput => ({
  locale, selected, sections: buildSections(selected), answers, reference: 'ML-261120-TEST',
});

describe('recorrido completo (63 combinaciones de servicios)', () => {
  it('cada combinación llega a la revisión pasando por todas las preguntas, en orden', () => {
    for (const selected of COMBINATIONS) {
      const { state, sections, visited } = walk(selected);
      expect(state.phase, selected.join('+')).toBe('review');
      expect(visited, selected.join('+')).toEqual(sections.flatMap((sec) => sec.questions.map((q) => q.id)));
      expect(sections[0].id).toBe('actividad');
      expect(sections.at(-2)?.id).toBe('cierre');
      expect(sections.at(-1)?.id).toBe('contacto');
      expect(criticalProgress(sections, state.answers).missing).toEqual([]);
    }
  });

  it('responder también lo opcional da el mismo recorrido y un mensaje más completo', () => {
    for (const selected of [['ia'], ['soporte', 'desarrollo'], SERVICES.map((s) => s.id)] as ServiceId[][]) {
      const required = walk(selected);
      const all = walk(selected, { answerAll: true });
      expect(all.state.phase).toBe('review');
      expect(all.visited).toEqual(required.visited);
      expect(buildMessage(inputFor(selected, all.state.answers)).length).toBeGreaterThan(buildMessage(inputFor(selected, required.state.answers)).length);
    }
  });

  it('el mensaje final menciona cada servicio elegido en los tres idiomas y no deja huecos', () => {
    for (const selected of COMBINATIONS) {
      const { state, sections } = walk(selected);
      for (const locale of LOCALES) {
        const msg = buildMessage({ ...inputFor(selected, state.answers, locale), sections });
        for (const id of selected) expect(msg, `${locale} ${id}`).toContain(SERVICES.find((s) => s.id === id)!.title[locale]);
        expect(msg).toContain('ML-261120-TEST');
        expect(msg).toContain(`v${SURVEY_VERSION}`);
        expect(msg).not.toMatch(/undefined|null|\[object/);
        expect(msg).not.toMatch(/\n{3,}/); // sin saltos de más
      }
    }
  });

  it('con respuestas cortas, el enlace de WhatsApp queda dentro del límite seguro en todas las combinaciones', () => {
    for (const selected of COMBINATIONS) {
      const { state } = walk(selected);
      const url = buildWhatsAppUrl(buildMessage(inputFor(selected, state.answers, 'pt')));
      expect(url.length, selected.join('+')).toBeLessThan(SAFE_URL_LENGTH);
    }
  });

  it('con cada texto libre al máximo, un servicio sigue dentro del límite y los seis lo superan (la interfaz avisa)', () => {
    // Peor caso realista: todas las preguntas respondidas y cada texto en su límite (sin acentos).
    const worstUrl = (selected: ServiceId[]) => {
      const answers: Answers = {};
      for (const section of buildSections(selected)) {
        for (const q of section.questions) {
          const max = q.type === 'textarea' ? site.maxTextLength : site.maxLineLength;
          answers[q.id] = q.type === 'multi' ? q.options!.map((o) => o.id) : q.type === 'single' ? q.options![0].id : 'a'.repeat(max);
        }
      }
      return buildWhatsAppUrl(buildMessage(inputFor(selected, answers))).length;
    };
    for (const s of SERVICES) expect(worstUrl([s.id]), s.id).toBeLessThan(SAFE_URL_LENGTH);
    // Con todos los servicios y todos los textos al máximo se pasa del límite: SurveyView muestra un aviso en ese caso.
    expect(worstUrl(SERVICES.map((s) => s.id))).toBeGreaterThan(SAFE_URL_LENGTH);
  });
});

describe('vista previa fiel al mensaje', () => {
  it('sin pendientes, la vista previa es exactamente el mensaje que se envía', () => {
    for (const selected of COMBINATIONS) {
      const { state } = walk(selected);
      const input = inputFor(selected, state.answers);
      expect(linesToText(buildLines(input, { pending: true }))).toBe(buildMessage(input));
    }
  });

  it('con pendientes, el texto enviado ignora los marcadores y no cambia', () => {
    for (const selected of COMBINATIONS) {
      const partial: Answers = { p_rubro: 'Ferretería' };
      const input = inputFor(selected, partial);
      expect(linesToText(buildLines(input, { pending: true }))).toBe(buildMessage(input));
    }
  });

  it('muestra como pendiente cada dato crítico que falta, y solo esos', () => {
    for (const selected of COMBINATIONS) {
      const sections = buildSections(selected);
      const answers: Answers = { p_rubro: 'Ferretería', p_tamano: '2-10' };
      const pending = buildLines(inputFor(selected, answers), { pending: true })
        .filter((l) => l.kind === 'item' && l.value === null)
        .map((l) => (l.kind === 'item' ? l.questionId : ''));
      expect(pending, selected.join('+')).toEqual(criticalProgress(sections, answers).missing);
      expect(pending).not.toContain('p_rubro');
      expect(pending).toContain('p_sucursales');
    }
  });

  it('las preguntas opcionales sin responder no aparecen ni como pendientes', () => {
    const lines = buildLines(inputFor(['ia'], {}), { pending: true });
    const ids = lines.filter((l) => l.kind === 'item').map((l) => (l.kind === 'item' ? l.questionId : ''));
    expect(ids).not.toContain('p_org');
    expect(ids).not.toContain('p_correo');
    expect(ids).not.toContain('e_presupuesto');
  });

  it('una opción que ya no existe en el catálogo no cuenta como respondida (el mensaje no la incluiría)', () => {
    const sections = buildSections(['ia']);
    const stale: Answers = { p_rubro: 'x', p_tamano: 'ya-no-existe', p_sucursales: ['tampoco'] };
    expect(criticalProgress(sections, stale).missing).toContain('p_tamano');
    expect(criticalProgress(sections, stale).missing).toContain('p_sucursales');
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'ia' });
    s = surveyReducer(s, { type: 'START', reference: 'R' });
    for (const [id, value] of Object.entries(stale)) s = surveyReducer(s, { type: 'SET_ANSWER', id, value });
    // …y por lo tanto no deja avanzar: el cliente vuelve a elegir en lugar de enviar sin ese dato.
    s = { ...s, cursor: 1 };
    const stuck = surveyReducer(s, { type: 'NEXT' });
    expect(stuck.cursor).toBe(1);
    expect(Object.keys(stuck.errors)).toEqual(['p_tamano']);
  });

  it('el avance de datos clave sube a medida que se responde', () => {
    const sections = buildSections(['ia']);
    const none = criticalProgress(sections, {});
    const some = criticalProgress(sections, { p_rubro: 'x', p_tamano: '1' });
    const everything = walk(['ia']).state.answers;
    expect(none.done).toBe(0);
    expect(some.done).toBe(2);
    expect(criticalProgress(sections, everything).done).toBe(none.total);
    expect(none.total).toBe(8); // 3 de actividad + 2 de IA + 2 de expectativas + 1 de contacto
  });
});
