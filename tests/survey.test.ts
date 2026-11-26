import { describe, expect, it } from 'vitest';
import { surveyReducer, initialState, sanitize, type SurveyState } from '@/controller/surveyReducer';
import { allQuestions, buildSections, CONTACT_SECTION, CONTEXT_SECTION, INQUIRY_SECTION, SECTIONS_AFTER_SERVICES, SECTIONS_BEFORE_SERVICES, SERVICES } from '@/model/catalog';
import { buildFlow } from '@/model/flow';
import { buildMessage, buildWhatsAppUrl, createReference } from '@/model/message';
import { LOCALES, type Answers } from '@/model/types';
import { isRequired } from '@/model/validation';
import { fillRequired } from './support';

/** Completa lo obligatorio del estado actual (el recorrido depende de las respuestas). */
const fillState = (state: SurveyState): SurveyState => {
  const answers = fillRequired(state.selected, state.answers);
  return Object.entries(answers).reduce((s, [id, value]) => surveyReducer(s, { type: 'SET_ANSWER', id, value }), state);
};

describe('catálogo', () => {
  it('cada texto está traducido a los tres idiomas (también las variantes)', () => {
    const sections = [...SECTIONS_BEFORE_SERVICES, ...SECTIONS_AFTER_SERVICES, ...SERVICES.map((svc) => ({ id: svc.id, title: svc.title, questions: svc.questions }))];
    for (const sec of sections) {
      for (const l of LOCALES) expect(sec.title[l], `${sec.id} ${l}`).toBeTruthy();
      for (const q of sec.questions) {
        for (const l of LOCALES) expect(q.label[l], `${q.id} ${l}`).toBeTruthy();
        for (const text of [q.help, q.placeholder, ...(q.variants ?? []).flatMap((v) => [v.label, v.placeholder, v.help])]) {
          if (text) for (const l of LOCALES) expect(text[l], `${q.id} ${l}`).toBeTruthy();
        }
        q.options?.forEach((opt) => LOCALES.forEach((l) => expect(opt.label[l], `${q.id}.${opt.id} ${l}`).toBeTruthy()));
      }
    }
    for (const svc of SERVICES) for (const l of LOCALES) expect(svc.stepIntro[l], `${svc.id} ${l}`).toBeTruthy();
  });

  it('los ids de preguntas son únicos en todo el catálogo', () => {
    const ids = allQuestions(SERVICES.map((s) => s.id)).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('arma su consulta → situación actual → servicios en orden de catálogo → objetivos → contacto', () => {
    const ids = buildSections(['soporte', 'consultoria'], { p_perfil: 'empresa' }).map((s) => s.id);
    expect(ids).toEqual(['consulta', 'contexto', 'svc:consultoria', 'svc:soporte', 'cierre', 'contacto']);
  });

  it('el paso 1 pregunta quién consulta y qué necesita; para un particular, solo eso', () => {
    expect(INQUIRY_SECTION.questions.map((q) => q.id)).toEqual(['p_perfil', 'p_industria', 'p_descripcion', 'p_tamano', 'x_necesidad']);
    const personal = buildSections(['ia'], { p_perfil: 'personal' })[0].questions.map((q) => q.id);
    expect(personal).toEqual(['p_perfil', 'x_necesidad']);
  });

  it('lo compartido entre servicios vive en «Situación actual» y nunca en un servicio', () => {
    const shared = CONTEXT_SECTION.questions.map((q) => q.id);
    for (const svc of SERVICES) for (const q of svc.questions) expect(shared, `${svc.id}.${q.id}`).not.toContain(q.id);
    expect(shared).toEqual(['x_herramientas', 'x_sistema_actual', 'x_areas', 'x_integraciones', 'x_integraciones_otro', 'x_usuarios_int', 'x_usuarios_ext', 'x_sedes', 'x_equipos']);
  });

  it('el nombre y los datos de contacto se piden al final', () => {
    const sections = buildSections(['ia'], { p_perfil: 'empresa' });
    expect(sections.at(-1)?.id).toBe('contacto');
    expect(CONTACT_SECTION.questions.map((q) => q.id)).toEqual(['p_nombre', 'p_org', 'p_web', 'p_ubicacion', 'p_correo', 'p_telefono']);
    expect(sections.slice(0, -1).flatMap((s) => s.questions.map((q) => q.id))).not.toContain('p_nombre');
  });
});

describe('máquina de estados', () => {
  it('no inicia sin servicios', () => {
    expect(surveyReducer(initialState, { type: 'START', reference: 'X' }).phase).toBe('landing');
  });

  it('avanza de a una pregunta: una obligatoria sin responder bloquea y marca solo esa', () => {
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'ia' });
    s = surveyReducer(s, { type: 'START', reference: 'ML-1' });
    s = surveyReducer(s, { type: 'NEXT' });
    expect(s.cursor).toBe(0);
    expect(Object.keys(s.errors)).toEqual(['p_perfil']);

    s = surveyReducer(s, { type: 'SET_ANSWER', id: 'p_perfil', value: 'empresa' });
    expect(s.errors).toEqual({}); // al responder, el error desaparece
    s = surveyReducer(s, { type: 'NEXT' });
    expect(s.cursor).toBe(1);

    // Con todo lo obligatorio respondido, cada NEXT avanza una pregunta hasta la revisión.
    s = fillState(s);
    const total = buildFlow(buildSections(['ia'], s.answers)).length;
    for (let i = s.cursor; i < total; i++) s = surveyReducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('review');
  });

  it('una pregunta opcional sin responder se omite sin error', () => {
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'ia' });
    s = fillState(surveyReducer(s, { type: 'START', reference: 'ML-1' }));
    const flow = buildFlow(buildSections(['ia'], s.answers));
    const optional = flow.findIndex((st) => !isRequired(st.question));
    s = { ...s, cursor: optional };
    const next = surveyReducer(s, { type: 'NEXT' });
    expect(next.errors).toEqual({});
    expect(next.cursor).toBe(optional + 1);
  });

  it('BACK en la primera pregunta vuelve a la landing', () => {
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'ia' });
    s = surveyReducer(s, { type: 'START', reference: 'ML-1' });
    expect(surveyReducer(s, { type: 'BACK' }).phase).toBe('landing');
  });

  it('cambiar una respuesta rehace lo que sigue, sin mover la pregunta actual', () => {
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'desarrollo' });
    s = surveyReducer(s, { type: 'START', reference: 'ML-1' });
    s = fillState(s);
    const herramientas = buildFlow(buildSections(s.selected, s.answers)).findIndex((st) => st.question.id === 'x_herramientas');
    s = { ...s, cursor: herramientas };
    const ids = (state: SurveyState) => buildFlow(buildSections(state.selected, state.answers)).map((st) => st.question.id);
    const withSystem = surveyReducer(s, { type: 'SET_ANSWER', id: 'x_herramientas', value: ['comercial'] });
    expect(ids(withSystem)).toContain('x_sistema_actual');
    expect(ids(withSystem).indexOf('x_herramientas')).toBe(herramientas);
    const without = surveyReducer(withSystem, { type: 'SET_ANSWER', id: 'x_herramientas', value: ['papel'] });
    expect(ids(without)).not.toContain('x_sistema_actual');
    expect(without.cursor).toBe(herramientas);
  });

  it('sanitize descarta datos inválidos de sessionStorage', () => {
    const s = sanitize({ phase: 'review', selected: ['ia', 'hackeo'], cursor: 99, answers: { a: 'b' } });
    expect(s.selected).toEqual(['ia']);
    expect(s.cursor).toBe(buildFlow(buildSections(['ia'], {})).length - 1); // se ajusta a la última pregunta
    expect(sanitize({ selected: ['ia'], cursor: -4 }).cursor).toBe(0);
    expect(sanitize({ selected: ['ia'], cursor: 'x' }).cursor).toBe(0);
    expect(sanitize({ selected: ['ia'], step: 3 }).cursor).toBe(0); // estado de otra versión: parte de la primera pregunta
    expect(sanitize('basura')).toEqual(initialState);
  });
});

describe('mensaje de WhatsApp', () => {
  const answers: Answers = {
    p_perfil: 'empresa', p_industria: 'alimentos', p_descripcion: 'Distribuidora de alimentos', p_tamano: '11-50',
    x_necesidad: 'Planillas por sucursal', x_areas: ['ventas', 'stock'], x_sedes: '2-3',
    e_objetivos: 'Cerrar el mes en un día', e_plazo: 'semanas', e_horario: ['manana', 'tarde'], p_nombre: 'Ana Pérez',
  };
  const sections = buildSections(['gestion'], answers);

  it('incluye referencia, servicios y respuestas legibles en el idioma del cliente', () => {
    const msg = buildMessage({ locale: 'es', selected: ['gestion'], sections, answers, reference: 'ML-261118-ABCD', siteUrl: 'https://ejemplo.dev' });
    expect(msg).toContain('ML-261118-ABCD');
    expect(msg).toContain('*Servicios de interés:* Gestión & Integraciones');
    expect(msg).toContain('• Para quién es la consulta: Una empresa o comercio en marcha');
    expect(msg).toContain('• Qué áreas del trabajo abarca: Ventas y presupuestos, Stock e inventario');
    expect(msg).toContain('• Cuántas personas trabajan en la empresa: 11 a 50');
    expect(msg).toContain('• Desde cuántos lugares trabajan: 2 o 3');
    expect(msg).toContain('Mañana, Tarde');
    expect(msg).toContain('ejemplo.dev · ES · v4');
    expect(msg).not.toContain('Nombre de la empresa'); // vacío → se omite
  });

  it('el texto de cada pregunta sigue al perfil también en el mensaje', () => {
    const project = { ...answers, p_perfil: 'proyecto' };
    const msg = buildMessage({ locale: 'es', selected: ['gestion'], sections: buildSections(['gestion'], project), answers: project, reference: 'R' });
    expect(msg).toContain('• Cuántas personas participan del proyecto: 11 a 50');
    expect(msg).toContain('• Hasta dónde quiere llevar el proyecto en los próximos 6 a 12 meses:');
  });

  it('saluda con el nombre cuando ya se cargó', () => {
    const base = { locale: 'es' as const, selected: ['gestion' as const], sections, reference: 'R' };
    expect(buildMessage({ ...base, answers })).toMatch(/^Hola Mariano, soy Ana Pérez\./);
    expect(buildMessage({ ...base, answers: { ...answers, p_nombre: '' } })).toMatch(/^Hola Mariano, quiero hacer una consulta\./);
  });

  it('traduce las mismas respuestas al portugués', () => {
    const msg = buildMessage({ locale: 'pt', selected: ['gestion'], sections, answers, reference: 'R' });
    expect(msg).toContain('Vendas e orçamentos, Estoque e inventário');
    expect(msg).toContain('LEVANTAMENTO INICIAL');
  });

  it('codifica la URL de wa.me', () => {
    const url = buildWhatsAppUrl('Hola & chau\n*ok*', '5490000');
    expect(url).toBe('https://wa.me/5490000?text=Hola%20%26%20chau%0A*ok*');
  });

  it('genera referencias con formato ML-AAMMDD-XXXX', () => {
    expect(createReference(new Date(2026, 10, 18), () => 0)).toBe('ML-261118-AAAA');
  });
});
