/* QA del recorrido completo: se recorre el relevamiento tal como lo haría un cliente, para las 63 combinaciones
 * de servicios y los 5 perfiles, y se comprueba que la vista previa sea fiel al mensaje que realmente se envía.
 * Desde v4 el recorrido depende de las respuestas: se avanza mirando siempre el recorrido de ese momento. */
import { describe, expect, it } from 'vitest';
import { initialState, surveyReducer, type SurveyState } from '@/controller/surveyReducer';
import { allQuestions, buildSections, INQUIRY_SECTION, SERVICES } from '@/model/catalog';
import { buildFlow } from '@/model/flow';
import { buildLines, buildMessage, buildWhatsAppUrl, linesToText, SAFE_URL_LENGTH, SURVEY_VERSION, type MessageInput } from '@/model/message';
import { LOCALES, type Answers, type ServiceId } from '@/model/types';
import { criticalProgress, isRequired } from '@/model/validation';
import { site } from '@/config/site';
import { sampleAnswer } from './support';

/** Las 63 combinaciones no vacías de servicios. */
const COMBINATIONS: ServiceId[][] = Array.from({ length: 2 ** SERVICES.length - 1 }, (_, i) =>
  SERVICES.filter((_, bit) => ((i + 1) >> bit) & 1).map((s) => s.id),
);
const PROFILES = INQUIRY_SECTION.questions[0].options!.map((o) => o.id);

/** Recorre el relevamiento como un cliente: una pregunta por vez, respondiendo solo lo obligatorio (o todo). */
function walk(selected: ServiceId[], { answerAll = false, profile = 'empresa' } = {}) {
  let s: SurveyState = initialState;
  for (const id of selected) s = surveyReducer(s, { type: 'TOGGLE_SERVICE', id });
  s = surveyReducer(s, { type: 'START', reference: 'ML-261120-TEST' });

  const visited: string[] = [];
  for (let guard = 0; s.phase === 'survey'; guard++) {
    expect(guard, 'el recorrido termina').toBeLessThan(80);
    const flow = buildFlow(buildSections(selected, s.answers));
    const { question: q } = flow[s.cursor];
    expect(visited, `${q.id}: no se repite`).not.toContain(q.id);
    visited.push(q.id);

    if (isRequired(q)) {
      // Sin responder no avanza y marca exactamente esa pregunta.
      const blocked = surveyReducer(s, { type: 'NEXT' });
      expect(blocked.cursor, `${q.id}: no avanza vacía`).toBe(s.cursor);
      expect(Object.keys(blocked.errors), `${q.id}: errores`).toEqual([q.id]);
    }
    const value = q.id === 'p_perfil' ? profile : sampleAnswer(q, `Respuesta ${q.id}`);
    if (isRequired(q) || answerAll || q.id === 'p_perfil') s = surveyReducer(s, { type: 'SET_ANSWER', id: q.id, value });
    const before = s.cursor;
    s = surveyReducer(s, { type: 'NEXT' });
    if (s.phase === 'survey') expect(s.cursor, `${q.id}: avanza una`).toBe(before + 1);
  }
  const sections = buildSections(selected, s.answers);
  return { state: s, sections, flow: buildFlow(sections), visited };
}

const inputFor = (selected: ServiceId[], answers: Answers, locale: MessageInput['locale'] = 'es'): MessageInput => ({
  locale, selected, sections: buildSections(selected, answers), answers, reference: 'ML-261120-TEST',
});

describe('recorrido completo (63 combinaciones de servicios × 5 perfiles)', () => {
  // Un caso por perfil (63 recorridos cada uno): en una máquina cargada cada uno tarda varios segundos.
  it.each(PROFILES)('perfil %s: cada combinación llega a la revisión pasando por todas las preguntas, en orden y sin repetir', (profile) => {
    for (const selected of COMBINATIONS) {
      const { state, sections, visited } = walk(selected, { profile });
      const label = `${profile} ${selected.join('+')}`;
      expect(state.phase, label).toBe('review');
      expect(visited, label).toEqual(sections.flatMap((sec) => sec.questions.map((q) => q.id)));
      expect(sections[0].id).toBe('consulta');
      expect(sections.at(-1)?.id).toBe('contacto');
      expect(criticalProgress(sections, state.answers).missing, label).toEqual([]);
    }
  }, 120_000);

  it('responder también lo opcional da el mismo recorrido y un mensaje más completo', () => {
    for (const selected of [['ia'], ['soporte', 'desarrollo'], SERVICES.map((s) => s.id)] as ServiceId[][]) {
      const required = walk(selected);
      const all = walk(selected, { answerAll: true });
      expect(all.state.phase).toBe('review');
      // Lo opcional puede sumar una pregunta (p. ej. «Otro» abre «¿cuál?»), nunca quitar una de las obligatorias.
      for (const id of required.visited) expect(all.visited).toContain(id);
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
    // Peor caso realista: todas las preguntas posibles respondidas y cada texto en su límite (sin acentos).
    const worstUrl = (selected: ServiceId[]) => {
      const answers: Answers = { p_perfil: 'empresa' };
      for (const q of allQuestions(selected)) {
        if (q.id === 'p_perfil') continue;
        const max = q.maxLength ?? (q.type === 'textarea' ? site.maxTextLength : site.maxLineLength);
        // En una de varias se marcan todas menos las exclusivas («No lo sé», «Con ninguna»…), que la interfaz deja solas.
        const multi = () => q.options!.filter((o) => !o.exclusive).map((o) => o.id);
        answers[q.id] = q.type === 'multi' ? multi() : q.type === 'single' ? q.options![0].id : 'a'.repeat(max);
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
      const partial: Answers = { p_perfil: 'empresa', p_descripcion: 'Ferretería' };
      const input = inputFor(selected, partial);
      expect(linesToText(buildLines(input, { pending: true }))).toBe(buildMessage(input));
    }
  });

  it('muestra como pendiente cada dato crítico que falta, y solo esos', () => {
    for (const selected of COMBINATIONS) {
      const answers: Answers = { p_perfil: 'empresa', p_descripcion: 'Ferretería', p_tamano: '1-10' };
      const sections = buildSections(selected, answers);
      const pending = buildLines(inputFor(selected, answers), { pending: true })
        .filter((l) => l.kind === 'item' && l.value === null)
        .map((l) => (l.kind === 'item' ? l.questionId : ''));
      expect(pending, selected.join('+')).toEqual(criticalProgress(sections, answers).missing);
      expect(pending).not.toContain('p_descripcion');
      expect(pending).toContain('p_industria');
    }
  });

  it('las preguntas opcionales sin responder no aparecen ni como pendientes', () => {
    const lines = buildLines(inputFor(['ia'], { p_perfil: 'empresa' }), { pending: true });
    const ids = lines.filter((l) => l.kind === 'item').map((l) => (l.kind === 'item' ? l.questionId : ''));
    expect(ids).not.toContain('p_org');
    expect(ids).not.toContain('p_correo');
    expect(ids).not.toContain('e_presupuesto');
  });

  it('una opción que ya no existe en el catálogo no cuenta como respondida (el mensaje no la incluiría)', () => {
    const stale: Answers = { p_perfil: 'empresa', p_descripcion: 'x', p_tamano: 'ya-no-existe', x_herramientas: ['tampoco'] };
    const sections = buildSections(['gestion'], stale);
    expect(criticalProgress(sections, stale).missing).toContain('p_tamano');
    expect(criticalProgress(sections, stale).missing).toContain('x_herramientas');
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'gestion' });
    s = surveyReducer(s, { type: 'START', reference: 'R' });
    for (const [id, value] of Object.entries(stale)) s = surveyReducer(s, { type: 'SET_ANSWER', id, value });
    // …y por lo tanto no deja avanzar: el cliente vuelve a elegir en lugar de enviar sin ese dato.
    const cursor = buildFlow(sections).findIndex((st) => st.question.id === 'p_tamano');
    s = { ...s, cursor };
    const stuck = surveyReducer(s, { type: 'NEXT' });
    expect(stuck.cursor).toBe(cursor);
    expect(Object.keys(stuck.errors)).toEqual(['p_tamano']);
  });

  it('el avance de datos clave sube a medida que se responde', () => {
    const start: Answers = { p_perfil: 'empresa' };
    const sections = buildSections(['ia'], start);
    const first = criticalProgress(sections, start);
    const some = criticalProgress(sections, { ...start, p_descripcion: 'x', p_tamano: '1-10' });
    const everything = walk(['ia']).state.answers;
    expect(first.done).toBe(1);
    expect(some.done).toBe(3);
    expect(criticalProgress(buildSections(['ia'], everything), everything).done).toBe(first.total);
    // Perfil, rubro, descripción, tamaño y necesidad + qué haría la IA + alcance y plazo + nombre y teléfono (sin correo).
    expect(first.total).toBe(10);
  });
});
