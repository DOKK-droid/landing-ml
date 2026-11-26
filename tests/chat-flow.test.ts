/* QA de la conversación (sin interfaz): el orden de las preguntas, la navegación y la vista previa que la acompaña. */
import { describe, expect, it } from 'vitest';
import { initialState, surveyReducer, type SurveyState } from '@/controller/surveyReducer';
import { buildSections, SERVICES } from '@/model/catalog';
import { buildFlow, firstStepOfSection } from '@/model/flow';
import { buildLines, buildMessage, linesToText } from '@/model/message';
import type { Answers, ServiceId } from '@/model/types';
import { isRequired, validateQuestion } from '@/model/validation';
import { sampleAnswer } from './support';

const EMPRESA: Answers = { p_perfil: 'empresa' };

const started = (selected: ServiceId[]): SurveyState => {
  let s = initialState;
  for (const id of selected) s = surveyReducer(s, { type: 'TOGGLE_SERVICE', id });
  return surveyReducer(s, { type: 'START', reference: 'ML-261120-TEST' });
};

describe('flujo de preguntas', () => {
  it('aplana las secciones en orden y numera cada pregunta dentro de su sección', () => {
    const sections = buildSections(['ia', 'soporte']);
    const flow = buildFlow(sections);
    expect(flow.map((s) => s.question.id)).toEqual(sections.flatMap((sec) => sec.questions.map((q) => q.id)));
    expect(flow.map((s) => s.index)).toEqual(flow.map((_, i) => i));
    for (const step of flow) {
      expect(step.section).toBe(sections[step.sectionIndex]);
      expect(step.size).toBe(step.section.questions.length);
      expect(step.section.questions[step.position]).toBe(step.question);
    }
  });

  it('el largo depende del perfil y de los servicios: con los seis, como en v3, aunque cubre más', () => {
    expect(buildFlow(buildSections(['ia'], EMPRESA)).length).toBe(23);
    expect(buildFlow(buildSections(['ia'], { p_perfil: 'personal' })).length).toBe(16);
    expect(buildFlow(buildSections(SERVICES.map((s) => s.id), EMPRESA)).length).toBe(37);
    // Una emergencia de un particular: lo justo para atenderla, sin reunión que preparar.
    expect(buildFlow(buildSections(['soporte'], { p_perfil: 'personal', s_tipo: 'emergencia' })).length).toBe(9);
  });

  it('encuentra la primera pregunta de cada sección', () => {
    const flow = buildFlow(buildSections(['ia'], EMPRESA));
    expect(firstStepOfSection(flow, 0)).toBe(0);
    expect(flow[firstStepOfSection(flow, 1)].question.id).toBe('x_herramientas');
    expect(flow[firstStepOfSection(flow, 2)].question.id).toBe('a_objetivo');
    expect(firstStepOfSection(flow, 99)).toBe(-1);
  });

  it('valida de a una pregunta', () => {
    const [perfil] = buildFlow(buildSections(['ia']));
    expect(validateQuestion(perfil.question, {})).toEqual({ p_perfil: 'required' });
    expect(validateQuestion(perfil.question, EMPRESA)).toEqual({});
    const descripcion = buildFlow(buildSections(['ia'], EMPRESA)).find((st) => st.question.id === 'p_descripcion')!;
    expect(validateQuestion(descripcion.question, { p_descripcion: '   ' })).toEqual({ p_descripcion: 'required' });
    expect(validateQuestion(descripcion.question, { p_descripcion: 'Ferretería de barrio' })).toEqual({});
    const optional = buildFlow(buildSections(['ia'], EMPRESA)).find((st) => !isRequired(st.question))!;
    expect(validateQuestion(optional.question, {})).toEqual({});
  });
});

describe('navegación', () => {
  it('BACK retrocede de a una pregunta y limpia los errores', () => {
    let s = started(['ia']);
    s = surveyReducer(s, { type: 'NEXT' }); // error: p_perfil sin elegir
    expect(s.errors).toEqual({ p_perfil: 'required' });
    s = surveyReducer(s, { type: 'SET_ANSWER', id: 'p_perfil', value: 'empresa' });
    s = surveyReducer(s, { type: 'NEXT' });
    expect(s.cursor).toBe(1);
    s = surveyReducer(s, { type: 'BACK' });
    expect(s.cursor).toBe(0);
    expect(s.answers.p_perfil).toBe('empresa'); // la respuesta se conserva
  });

  it('volver desde la revisión deja en la última pregunta, con todo lo respondido', () => {
    let s = started(['ia']);
    // El recorrido se rearma con cada respuesta: se avanza mirando siempre el de ese momento.
    while (s.phase === 'survey') {
      const q = buildFlow(buildSections(s.selected, s.answers))[s.cursor].question;
      if (isRequired(q)) s = surveyReducer(s, { type: 'SET_ANSWER', id: q.id, value: sampleAnswer(q) });
      s = surveyReducer(s, { type: 'NEXT' });
    }
    expect(s.phase).toBe('review');
    const flow = buildFlow(buildSections(s.selected, s.answers));
    const back = surveyReducer(s, { type: 'BACK' });
    expect(back.phase).toBe('survey');
    expect(back.cursor).toBe(flow.length - 1);
    expect(back.answers).toEqual(s.answers);
  });

  it('NEXT fuera de la fase de preguntas no hace nada', () => {
    expect(surveyReducer(initialState, { type: 'NEXT' })).toBe(initialState);
    const review: SurveyState = { ...started(['ia']), phase: 'review' };
    expect(surveyReducer(review, { type: 'NEXT' })).toBe(review);
  });

  it('GO_TO_SECTION lleva a la primera pregunta de una sección anterior', () => {
    const flow = buildFlow(buildSections(['ia'], EMPRESA));
    const s: SurveyState = { ...started(['ia']), answers: EMPRESA, cursor: flow.length - 1 }; // en "contacto"
    const back = surveyReducer(s, { type: 'GO_TO_SECTION', section: 1 });
    expect(back.cursor).toBe(firstStepOfSection(flow, 1));
    expect(back.phase).toBe('survey');
  });

  it('GO_TO_SECTION no permite saltar hacia adelante (dejaría obligatorias sin responder)', () => {
    const s = started(['ia']);
    expect(surveyReducer(s, { type: 'GO_TO_SECTION', section: 2 })).toBe(s);
    expect(surveyReducer(s, { type: 'GO_TO_SECTION', section: 99 })).toBe(s);
    expect(surveyReducer(s, { type: 'GO_TO_SECTION', section: -1 })).toBe(s);
  });

  it('desde la revisión se puede ir a cualquier sección', () => {
    const review: SurveyState = { ...started(['ia']), answers: EMPRESA, phase: 'review' };
    const s = surveyReducer(review, { type: 'GO_TO_SECTION', section: 3 });
    expect(s.phase).toBe('survey');
    expect(s.cursor).toBe(firstStepOfSection(buildFlow(buildSections(['ia'], EMPRESA)), 3));
  });
});

describe('vista previa que acompaña a la pregunta en curso', () => {
  const base = (answers: Answers = {}) => {
    const all = { ...EMPRESA, ...answers };
    return { locale: 'es' as const, selected: ['ia' as const], sections: buildSections(['ia'], all), answers: all, reference: 'R' };
  };

  it('muestra la pregunta en curso aunque sea opcional, marcada como tal', () => {
    const lines = buildLines(base(), { pending: true, focusId: 'e_presupuesto' });
    const row = lines.find((l) => l.kind === 'item' && l.questionId === 'e_presupuesto');
    expect(row).toMatchObject({ kind: 'item', value: null, optional: true });
  });

  it('las obligatorias pendientes se marcan como no opcionales', () => {
    const lines = buildLines(base(), { pending: true });
    const row = lines.find((l) => l.kind === 'item' && l.questionId === 'p_descripcion');
    expect(row).toMatchObject({ value: null, optional: false });
  });

  it('la pregunta en curso no cambia el texto que se envía', () => {
    for (const focusId of ['e_presupuesto', 'p_org', 'a_volumen', 'p_descripcion']) {
      const input = base({ p_descripcion: 'Ferretería de barrio' });
      expect(linesToText(buildLines(input, { pending: true, focusId }))).toBe(buildMessage(input));
    }
  });

  it('una pregunta en curso ya respondida aparece con su valor, no como pendiente', () => {
    const lines = buildLines(base({ e_presupuesto: 'aun' }), { pending: true, focusId: 'e_presupuesto' });
    const row = lines.find((l) => l.kind === 'item' && l.questionId === 'e_presupuesto');
    expect(row).toMatchObject({ kind: 'item' });
    expect(row && row.kind === 'item' ? row.value : null).not.toBeNull();
  });
});
