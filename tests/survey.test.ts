import { describe, expect, it } from 'vitest';
import { surveyReducer, initialState, sanitize, type SurveyState } from '@/controller/surveyReducer';
import { ACTIVITY_SECTION, buildSections, CLOSING_SECTION, CONTACT_SECTION, SERVICES } from '@/model/catalog';
import { buildFlow } from '@/model/flow';
import { buildMessage, buildWhatsAppUrl, createReference } from '@/model/message';
import { LOCALES } from '@/model/types';

const fillRequired = (state: SurveyState): SurveyState => {
  let s = state;
  for (const section of buildSections(s.selected)) {
    for (const q of section.questions.filter((x) => x.required)) {
      const value = q.type === 'multi' ? [q.options![0].id] : q.type === 'single' ? q.options![0].id : 'Texto de prueba';
      s = surveyReducer(s, { type: 'SET_ANSWER', id: q.id, value });
    }
  }
  return s;
};

describe('catálogo', () => {
  it('cada texto está traducido a los tres idiomas', () => {
    const sections = [ACTIVITY_SECTION, CLOSING_SECTION, CONTACT_SECTION, ...SERVICES.map((s) => ({ ...s, title: s.title }))];
    for (const sec of sections) {
      for (const l of LOCALES) expect(sec.title[l], `${sec.id} ${l}`).toBeTruthy();
      for (const q of sec.questions) {
        for (const l of LOCALES) expect(q.label[l], `${q.id} ${l}`).toBeTruthy();
        q.options?.forEach((opt) => LOCALES.forEach((l) => expect(opt.label[l], `${q.id}.${opt.id} ${l}`).toBeTruthy()));
      }
    }
  });

  it('los ids de preguntas son únicos', () => {
    const ids = buildSections(SERVICES.map((s) => s.id)).flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('arma actividad → servicios en orden de catálogo → expectativas → contacto', () => {
    const ids = buildSections(['soporte', 'consultoria']).map((s) => s.id);
    expect(ids).toEqual(['actividad', 'svc:consultoria', 'svc:soporte', 'cierre', 'contacto']);
  });

  it('el paso 1 pregunta solo a qué se dedica, cuántas personas y cuántas sucursales', () => {
    expect(ACTIVITY_SECTION.questions.map((q) => q.id)).toEqual(['p_rubro', 'p_tamano', 'p_sucursales']);
    expect(ACTIVITY_SECTION.questions.every((q) => q.required)).toBe(true);
  });

  it('el nombre y los datos de contacto se piden al final', () => {
    const sections = buildSections(['ia']);
    expect(sections.at(-1)?.id).toBe('contacto');
    expect(CONTACT_SECTION.questions.map((q) => q.id)).toEqual(['p_nombre', 'p_org', 'p_ubicacion', 'p_correo']);
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
    expect(Object.keys(s.errors)).toEqual(['p_rubro']);

    s = surveyReducer(s, { type: 'SET_ANSWER', id: 'p_rubro', value: 'Ferretería' });
    expect(s.errors).toEqual({}); // al responder, el error desaparece
    s = surveyReducer(s, { type: 'NEXT' });
    expect(s.cursor).toBe(1);

    // Con todo lo obligatorio respondido, cada NEXT avanza una pregunta hasta la revisión.
    s = fillRequired(s);
    const total = buildFlow(buildSections(['ia'])).length;
    for (let i = s.cursor; i < total; i++) s = surveyReducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('review');
  });

  it('una pregunta opcional sin responder se omite sin error', () => {
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'ia' });
    s = fillRequired(surveyReducer(s, { type: 'START', reference: 'ML-1' }));
    const flow = buildFlow(buildSections(['ia']));
    const optional = flow.findIndex((st) => !st.question.required);
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

  it('sanitize descarta datos inválidos de sessionStorage', () => {
    const s = sanitize({ phase: 'review', selected: ['ia', 'hackeo'], cursor: 99, answers: { a: 'b' } });
    expect(s.selected).toEqual(['ia']);
    expect(s.cursor).toBe(buildFlow(buildSections(['ia'])).length - 1); // se ajusta a la última pregunta
    expect(sanitize({ selected: ['ia'], cursor: -4 }).cursor).toBe(0);
    expect(sanitize({ selected: ['ia'], cursor: 'x' }).cursor).toBe(0);
    expect(sanitize({ selected: ['ia'], step: 3 }).cursor).toBe(0); // estado de otra versión: parte de la primera pregunta
    expect(sanitize('basura')).toEqual(initialState);
  });
});

describe('mensaje de WhatsApp', () => {
  const answers = {
    p_nombre: 'Ana Pérez', p_rubro: 'Distribuidora', p_tamano: '11-50', p_sucursales: '2-3',
    g_areas: ['ventas', 'stock'], g_actual: 'Planillas por sucursal',
    e_resultado: 'Cerrar el mes en un día', e_plazo: 'semanas', e_horario: ['manana', 'tarde'],
  };

  it('incluye referencia, servicios y respuestas legibles en el idioma del cliente', () => {
    const msg = buildMessage({ locale: 'es', selected: ['gestion'], sections: buildSections(['gestion']), answers, reference: 'ML-261118-ABCD', siteUrl: 'https://ejemplo.dev' });
    expect(msg).toContain('ML-261118-ABCD');
    expect(msg).toContain('*Servicios de interés:* Gestión & Integraciones');
    expect(msg).toContain('• Qué áreas quiere ordenar: Ventas y presupuestos, Stock e inventario');
    expect(msg).toContain('• Cuántas personas trabajan en la organización: 11 a 50');
    expect(msg).toContain('• Cuántas sucursales u oficinas tiene: 2 o 3');
    expect(msg).toContain('Mañana, Tarde');
    expect(msg).toContain('ejemplo.dev · ES');
    expect(msg).not.toContain('Empresa u organización'); // vacío → se omite
  });

  it('saluda con el nombre cuando ya se cargó', () => {
    const base = { locale: 'es' as const, selected: ['gestion' as const], sections: buildSections(['gestion']), reference: 'R' };
    expect(buildMessage({ ...base, answers })).toMatch(/^Hola Mariano, soy Ana Pérez\./);
    expect(buildMessage({ ...base, answers: { ...answers, p_nombre: '' } })).toMatch(/^Hola Mariano, quiero hacer una consulta\./);
  });

  it('traduce las mismas respuestas al portugués', () => {
    const msg = buildMessage({ locale: 'pt', selected: ['gestion'], sections: buildSections(['gestion']), answers, reference: 'R' });
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
