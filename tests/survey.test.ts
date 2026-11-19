import { describe, expect, it } from 'vitest';
import { surveyReducer, initialState, sanitize, type SurveyState } from '@/controller/surveyReducer';
import { buildSections, SERVICES, PROFILE_SECTION, CLOSING_SECTION } from '@/model/catalog';
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
    const sections = [PROFILE_SECTION, CLOSING_SECTION, ...SERVICES.map((s) => ({ ...s, title: s.title }))];
    for (const sec of sections) {
      for (const l of LOCALES) expect(sec.title[l], `${sec.id} ${l}`).toBeTruthy();
      for (const q of sec.questions) {
        for (const l of LOCALES) expect(q.label[l], `${q.id} ${l}`).toBeTruthy();
        q.options?.forEach((o) => LOCALES.forEach((l) => expect(o.label[l], `${q.id}.${o.id} ${l}`).toBeTruthy()));
      }
    }
  });

  it('los ids de preguntas son únicos', () => {
    const ids = buildSections(SERVICES.map((s) => s.id)).flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('arma perfil + servicios en orden de catálogo + cierre', () => {
    const ids = buildSections(['soporte', 'consultoria']).map((s) => s.id);
    expect(ids).toEqual(['perfil', 'svc:consultoria', 'svc:soporte', 'cierre']);
  });
});

describe('máquina de estados', () => {
  it('no inicia sin servicios', () => {
    expect(surveyReducer(initialState, { type: 'START', reference: 'X' }).phase).toBe('landing');
  });

  it('bloquea el avance si faltan obligatorios y lo permite al completarlos', () => {
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'ia' });
    s = surveyReducer(s, { type: 'START', reference: 'ML-1' });
    s = surveyReducer(s, { type: 'NEXT' });
    expect(s.step).toBe(0);
    expect(Object.keys(s.errors)).toEqual(['p_nombre', 'p_rubro']);

    s = fillRequired(s);
    expect(s.errors).toEqual({});
    s = surveyReducer(s, { type: 'NEXT' });
    s = surveyReducer(s, { type: 'NEXT' });
    s = surveyReducer(s, { type: 'NEXT' });
    expect(s.phase).toBe('review');
  });

  it('BACK en el primer paso vuelve a la landing', () => {
    let s = surveyReducer(initialState, { type: 'TOGGLE_SERVICE', id: 'ia' });
    s = surveyReducer(s, { type: 'START', reference: 'ML-1' });
    expect(surveyReducer(s, { type: 'BACK' }).phase).toBe('landing');
  });

  it('sanitize descarta datos inválidos de sessionStorage', () => {
    const s = sanitize({ phase: 'review', selected: ['ia', 'hackeo'], step: 99, answers: { a: 'b' } });
    expect(s.selected).toEqual(['ia']);
    expect(s.step).toBe(2);
    expect(sanitize('basura')).toEqual(initialState);
  });
});

describe('mensaje de WhatsApp', () => {
  const answers = {
    p_nombre: 'Ana Pérez', p_rubro: 'Distribuidora', p_tamano: '11-50',
    g_areas: ['ventas', 'stock'], g_actual: 'Planillas por sucursal',
    e_resultado: 'Cerrar el mes en un día', e_plazo: 'semanas', e_horario: ['manana', 'tarde'],
  };

  it('incluye referencia, servicios y respuestas legibles en el idioma del cliente', () => {
    const msg = buildMessage({ locale: 'es', selected: ['gestion'], sections: buildSections(['gestion']), answers, reference: 'ML-261118-ABCD', siteUrl: 'https://ejemplo.dev' });
    expect(msg).toContain('ML-261118-ABCD');
    expect(msg).toContain('*Servicios de interés:* Gestión & Integraciones');
    expect(msg).toContain('• Qué áreas quiere ordenar: Ventas y presupuestos, Stock e inventario');
    expect(msg).toContain('• Cuántas personas trabajan: 11 a 50');
    expect(msg).toContain('Mañana, Tarde');
    expect(msg).toContain('ejemplo.dev · ES');
    expect(msg).not.toContain('Empresa u organización'); // vacío → se omite
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
