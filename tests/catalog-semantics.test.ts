/* La semántica del relevamiento v5, comprobada para los 5 perfiles × las 63 combinaciones de servicios:
 *   · ningún dato se pregunta dos veces;
 *   · a ningún servicio le falta lo que necesita (la matriz de docs/RELEVAMIENTO.md), se elija solo o combinado;
 *   · una condición solo mira preguntas anteriores (responder cambia lo que sigue, nunca lo que ya pasó);
 *   · las opciones que van a Frappe CRM son exactamente las de Frappe;
 *   · los pares de preguntas que se podían deducir una de otra ya no conviven;
 *   · es un diagnóstico: fortalezas, puntos débiles, intentos previos y viabilidad, sin pedirle al cliente soluciones técnicas. */
import { describe, expect, it } from 'vitest';
import { references } from '@/model/conditions';
import { allQuestions, buildSections, FRAPPE_EMPLOYEE_RANGES, INQUIRY_SECTION, SERVICES } from '@/model/catalog';
import type { Answers, Question, ServiceId } from '@/model/types';
import { isRequired } from '@/model/validation';
import { visibleIds } from './support';

const ALL: ServiceId[] = SERVICES.map((s) => s.id);
const COMBINATIONS: ServiceId[][] = Array.from({ length: 2 ** ALL.length - 1 }, (_, i) => ALL.filter((_, bit) => ((i + 1) >> bit) & 1));
const PROFILES = INQUIRY_SECTION.questions[0].options!.map((o) => o.id);

/* ---------------------------- La matriz: lo crítico de cada servicio ---------------------------- */

const ALWAYS = ['p_perfil', 'x_necesidad', 'p_nombre'];
const BY_PROFILE: Record<string, string[]> = {
  empresa: ['p_industria', 'p_descripcion', 'p_tamano'],
  organizacion: ['p_industria', 'p_descripcion', 'p_tamano'],
  proyecto: ['p_industria', 'p_descripcion', 'p_tamano'],
  independiente: ['p_industria', 'p_descripcion'],
  personal: [],
};
/** El diagnóstico, salvo con Soporte solo (ahí el pedido es concreto): lo que lo afecta o con qué cuenta, y qué intentó. */
const DIAGNOSIS_BY_PROFILE: Record<string, string[]> = {
  empresa: ['x_impacto', 'x_intentos'],
  organizacion: ['x_impacto', 'x_intentos'],
  independiente: ['x_impacto', 'x_intentos'],
  proyecto: ['x_avance', 'x_intentos'],
  personal: [],
};
const BY_SERVICE: Record<ServiceId, string[]> = {
  consultoria: ['c_entregable'],
  desarrollo: ['x_herramientas', 'x_sistema_actual', 'x_usuarios_ext', 'd_definicion', 'd_dispositivos'],
  gestion: ['x_herramientas', 'x_sistema_actual'],
  infraestructura: ['i_sintomas', 'i_respaldo', 'p_ubicacion'],
  ia: ['a_objetivo'],
  soporte: ['s_tipo', 's_equipo', 's_modalidad', 'p_ubicacion'],
};
/** Lo que no aplica a un particular (no tiene equipo, sedes, parque de equipos ni áreas de trabajo). */
const BY_SERVICE_UNLESS_PERSONAL: Partial<Record<ServiceId, string[]>> = {
  desarrollo: ['x_usuarios_int', 'x_responsable'],
  gestion: ['x_usuarios_int', 'x_areas', 'x_responsable'],
  infraestructura: ['x_sedes', 'x_equipos', 'x_responsable', 'i_caida'],
};

/** Respuestas que activan las preguntas condicionales: un sistema actual, un intento previo, una reparación presencial. */
const RICH: Answers = { x_herramientas: ['comercial'], x_intentos: 'proveedor', s_tipo: 'puntual', s_modalidad: 'presencial' };

function resolved(selected: ServiceId[], answers: Answers): Question[] {
  return buildSections(selected, answers).flatMap((s) => s.questions);
}

describe('un concepto, un id, un lugar', () => {
  it('los ids son únicos en todo el catálogo', () => {
    const ids = allQuestions(ALL).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('en ningún recorrido se repite una pregunta ni queda una sección vacía', () => {
    for (const profile of PROFILES) {
      for (const selected of COMBINATIONS) {
        const sections = buildSections(selected, { ...RICH, p_perfil: profile });
        const ids = sections.flatMap((s) => s.questions.map((q) => q.id));
        expect(new Set(ids).size, `${profile} ${selected.join('+')}`).toBe(ids.length);
        for (const s of sections) expect(s.questions.length, s.id).toBeGreaterThan(0);
      }
    }
  });
});

describe('a ningún servicio le falta lo crítico, solo o combinado', () => {
  it.each(PROFILES)('perfil %s', (profile) => {
    for (const selected of COMBINATIONS) {
      const questions = resolved(selected, { ...RICH, p_perfil: profile });
      const required = new Set(questions.filter(isRequired).map((q) => q.id));
      const onlySupport = selected.length === 1 && selected[0] === 'soporte';
      const expected = [
        ...ALWAYS,
        ...BY_PROFILE[profile],
        ...(onlySupport ? [] : DIAGNOSIS_BY_PROFILE[profile]),
        ...selected.flatMap((id) => BY_SERVICE[id]),
        ...(profile === 'personal' ? [] : selected.flatMap((id) => BY_SERVICE_UNLESS_PERSONAL[id] ?? [])),
      ];
      for (const id of expected) expect(required.has(id), `${profile} ${selected.join('+')}: ${id}`).toBe(true);
    }
  });

  it('el cierre pide alcance y plazo salvo cuando no hay reunión que preparar', () => {
    for (const selected of COMBINATIONS) {
      const required = new Set(resolved(selected, { ...RICH, p_perfil: 'empresa' }).filter(isRequired).map((q) => q.id));
      const onlySupport = selected.length === 1 && selected[0] === 'soporte';
      expect(required.has('e_alcance'), selected.join('+')).toBe(!onlySupport);
      expect(required.has('e_plazo'), selected.join('+')).toBe(true); // RICH es una reparación, no una emergencia
    }
  });

  it('siempre hay al menos un medio de contacto: sin correo, el teléfono es obligatorio', () => {
    for (const selected of COMBINATIONS) {
      const without = resolved(selected, { p_perfil: 'empresa' });
      expect(without.find((q) => q.id === 'p_telefono')?.required, selected.join('+')).toBe(true);
      const withEmail = resolved(selected, { p_perfil: 'empresa', p_correo: 'ana@empresa.com' });
      expect(withEmail.find((q) => q.id === 'p_telefono')?.required, selected.join('+')).toBe(false);
    }
  });
});

describe('las condiciones solo miran hacia atrás', () => {
  it('en cada combinación, toda pregunta que una condición mira está antes (o no está en el recorrido)', () => {
    const catalogIds = new Set(allQuestions(ALL).map((q) => q.id));
    for (const selected of COMBINATIONS) {
      const layout = allQuestions(selected);
      const position = new Map(layout.map((q, i) => [q.id, i]));
      layout.forEach((q, i) => {
        const refs = [
          ...references(q.showIf),
          ...(typeof q.required === 'object' ? references(q.required) : []),
          ...(q.variants ?? []).flatMap((v) => references(v.when)),
        ];
        for (const ref of refs) {
          expect(catalogIds.has(ref), `${q.id} mira ${ref}, que no existe`).toBe(true);
          if (position.has(ref)) expect(position.get(ref)!, `${selected.join('+')}: ${q.id} mira ${ref}`).toBeLessThan(i);
        }
      });
    }
  });
});

describe('pares que se podían deducir uno del otro', () => {
  const base: Answers = { p_perfil: 'empresa' };

  it('el motivo se cuenta una vez, en el diagnóstico: Consultoría solo pregunta qué espera llevarse', () => {
    const ids = visibleIds(['consultoria', 'desarrollo', 'ia'], base);
    expect(ids.filter((id) => /^(x_necesidad|c_motivo|d_problema|a_tarea)$/.test(id))).toEqual(['x_necesidad']);
    expect(ids).toContain('c_entregable');
  });

  it('lo que pasa hoy (`x_necesidad`) y lo que quiere lograr (`x_objetivos`) son preguntas distintas, en ese orden', () => {
    const ids = visibleIds(['gestion'], base);
    expect(ids.indexOf('x_necesidad')).toBeLessThan(ids.indexOf('x_objetivos'));
    const necesidad = allQuestions(['gestion']).find((q) => q.id === 'x_necesidad')!;
    expect(necesidad.label.es).not.toMatch(/lograr|objetivo/i);
  });

  it('un proyecto nuevo no tiene «cómo lo afecta» ni fortalezas de una operación: dice con qué cuenta', () => {
    const ids = visibleIds(['desarrollo'], { p_perfil: 'proyecto' });
    expect(ids).toContain('x_avance');
    expect(ids).not.toContain('x_impacto');
    expect(ids).not.toContain('x_fortalezas');
    expect(visibleIds(['desarrollo'], base)).not.toContain('x_avance');
  });

  it('qué no funcionó, solo si ya lo intentó', () => {
    expect(visibleIds(['gestion'], { ...base, x_intentos: 'no' })).not.toContain('x_intentos_falla');
    for (const tried of ['propio', 'proveedor', 'curso']) expect(visibleIds(['gestion'], { ...base, x_intentos: tried })).toContain('x_intentos_falla');
  });

  it('Soporte solo es un pedido concreto: sin diagnóstico ni preocupaciones, solo la pregunta abierta', () => {
    const ids = visibleIds(['soporte'], base);
    for (const id of ['x_impacto', 'x_fortalezas', 'x_intentos', 'x_objetivos', 'e_preocupaciones']) expect(ids).not.toContain(id);
    expect(ids).toContain('x_necesidad');
  });

  it('a un particular no se le pregunta por su operación (impacto, fortalezas, áreas, responsable)', () => {
    const ids = visibleIds(['gestion', 'infraestructura'], { p_perfil: 'personal' });
    for (const id of ['x_impacto', 'x_fortalezas', 'x_areas', 'x_intentos', 'x_responsable', 'i_caida', 'e_dedicacion']) expect(ids).not.toContain(id);
  });

  it('nada técnico: Infraestructura pregunta síntomas y consecuencias, no qué instalar', () => {
    const infra = allQuestions(['infraestructura']).filter((q) => q.id.startsWith('i_'));
    const words = infra.flatMap((q) => [q.label.es, ...(q.options ?? []).map((o) => o.label.es)]).join(' ').toLowerCase();
    for (const jargon of ['nube', 'servidor', 'almacenamiento', 'backup', 'cableado']) expect(words, jargon).not.toContain(jargon);
  });

  it('con IA sin una tarea clara no se pregunta frecuencia ni gravedad de un error', () => {
    const ids = visibleIds(['ia'], { ...base, a_objetivo: ['explorar'] });
    expect(ids).not.toContain('a_volumen');
    expect(ids).not.toContain('a_error');
    expect(ids).toContain('a_datos');
    expect(visibleIds(['ia'], { ...base, a_objetivo: ['documentos'] })).toContain('a_error');
  });

  it('la calidad de la información solo si hay información registrada', () => {
    expect(visibleIds(['gestion'], { ...base, x_herramientas: ['planillas'] })).not.toContain('g_calidad');
    expect(visibleIds(['gestion'], { ...base, x_herramientas: ['planillas'], g_informacion: ['nada'] })).not.toContain('g_calidad');
    expect(visibleIds(['gestion'], { ...base, x_herramientas: ['planillas'], g_informacion: ['clientes'] })).toContain('g_calidad');
  });

  it('las fortalezas no repiten lo que ya tiene su pregunta (información ordenada, un sistema que funciona)', () => {
    const fortalezas = allQuestions(['gestion']).find((q) => q.id === 'x_fortalezas')!.options!.map((o) => o.label.es.toLowerCase()).join(' ');
    for (const word of ['información', 'sistema', 'herramienta']) expect(fortalezas, word).not.toContain(word);
  });

  it('qué hacer con el sistema actual, solo si hay un sistema', () => {
    expect(visibleIds(['desarrollo'], { ...base, x_herramientas: ['papel', 'mensajeria'] })).not.toContain('x_sistema_actual');
    expect(visibleIds(['desarrollo'], { ...base, x_herramientas: ['propio'] })).toContain('x_sistema_actual');
  });

  it('si hoy no usan nada, no hay información registrada que preguntar', () => {
    expect(visibleIds(['gestion'], { ...base, x_herramientas: ['nada'] })).not.toContain('g_informacion');
    expect(visibleIds(['gestion'], { ...base, x_herramientas: ['planillas'] })).toContain('g_informacion');
  });

  it('las sedes se preguntan una vez y los equipos se cuentan aparte de las personas', () => {
    const ids = visibleIds(['infraestructura', 'gestion', 'soporte'], base);
    expect(ids.filter((id) => id === 'x_sedes')).toHaveLength(1);
    expect(ids).toContain('x_equipos');
    expect(ids).toContain('p_tamano');
  });

  it('el alcance no se pregunta con Soporte solo (lo dice el tipo de atención)', () => {
    expect(visibleIds(['soporte'], base)).not.toContain('e_alcance');
    expect(visibleIds(['soporte', 'ia'], base)).toContain('e_alcance');
  });

  it('una emergencia de Soporte solo no prepara reunión; combinada, pregunta el plazo del resto', () => {
    const emergency = { ...base, s_tipo: 'emergencia' };
    const alone = visibleIds(['soporte'], emergency);
    for (const id of ['e_plazo', 'e_presupuesto', 'e_decisor', 'e_horario', 'e_plataforma']) expect(alone).not.toContain(id);
    const plazo = resolved(['soporte', 'desarrollo'], emergency).find((q) => q.id === 'e_plazo')!;
    expect(plazo.label.es).toBe('Además de la emergencia, ¿para cuándo necesita lo demás?');
  });

  it('el síntoma se pide aparte solo si Soporte va combinado y algo está roto', () => {
    expect(visibleIds(['soporte'], { ...base, s_tipo: 'puntual' })).not.toContain('s_sintoma');
    expect(visibleIds(['soporte', 'ia'], { ...base, s_tipo: 'puntual' })).toContain('s_sintoma');
    expect(visibleIds(['soporte', 'ia'], { ...base, s_tipo: 'periodico' })).not.toContain('s_sintoma');
  });

  it('quién decide no se pregunta a un independiente ni a un particular', () => {
    for (const profile of ['independiente', 'personal']) expect(visibleIds(['ia'], { p_perfil: profile })).not.toContain('e_decisor');
    expect(visibleIds(['ia'], base)).toContain('e_decisor');
  });

  it('las funciones del software no repiten un área (turnos, stock como área) ni un canal (WhatsApp)', () => {
    const funciones = allQuestions(['desarrollo']).find((q) => q.id === 'd_funciones')!.options!.map((o) => o.label.es.toLowerCase());
    for (const word of ['whatsapp', 'turno', 'reserva', 'facturación']) expect(funciones.join(' '), word).not.toContain(word);
  });

  it('la ciudad es obligatoria solo si hay trabajo en el lugar', () => {
    const ubicacion = (selected: ServiceId[], answers: Answers) => resolved(selected, { ...base, ...answers }).find((q) => q.id === 'p_ubicacion')!.required;
    expect(ubicacion(['ia'], {})).toBe(false);
    expect(ubicacion(['infraestructura'], {})).toBe(true);
    expect(ubicacion(['soporte'], { s_modalidad: 'remota' })).toBe(false);
    expect(ubicacion(['soporte'], { s_modalidad: 'presencial' })).toBe(true);
  });

  it('una respuesta que quedó de una pregunta ahora oculta no cuenta', () => {
    // Respondió el tamaño, un intento con otro proveedor y «Otro» como falla; después cambió a uso personal: ya no se hacen.
    const answers: Answers = { p_perfil: 'personal', p_tamano: '11-50', x_intentos: 'proveedor', x_intentos_falla: ['otro'], x_intentos_falla_otro: 'x' };
    const ids = visibleIds(['consultoria'], answers);
    expect(ids).not.toContain('p_tamano');
    expect(ids).not.toContain('x_intentos_falla');
    expect(ids).not.toContain('x_intentos_falla_otro'); // su «¿cuál?» se va con ella
  });
});

describe('alineado con Frappe CRM', () => {
  /** `CRM Industry` del sitio (lista leída de la base el 2026-11-25; la prueba del servidor lo comprueba contra la base real). */
  const CRM_INDUSTRY = [
    'Accounting', 'Advertising', 'Aerospace', 'Agriculture', 'Airline', 'Apparel & Accessories', 'Automotive', 'Banking', 'Beverage & Tobacco',
    'Biotechnology', 'Broadcasting', 'Brokerage', 'Chemical', 'Computer', 'Consulting', 'Consumer Products', 'Cosmetics', 'CRM', 'Defense',
    'Department Stores', 'Ecommerce', 'Education', 'Electronics', 'Energy', 'ERP', 'Finance', 'Financial Services', 'Food', 'Food & Beverage',
    'Grocery', 'Health Care', 'Healthcare', 'Internet Publishing', 'Investment Banking', 'Legal', 'Logistics', 'Manufacturing', 'Marketing',
    'Media', 'Motion Picture & Video', 'Music', 'Newspaper Publishers', 'Nonprofit', 'Online Auctions', 'Pension Funds', 'Pharmaceuticals',
    'Private Equity', 'Publishing', 'Real Estate', 'Retail', 'Retail & Wholesale', 'SaaS', 'Securities & Commodity Exchanges', 'Semiconductors',
    'Service', 'Soap & Detergent', 'Software', 'Sports', 'Technology', 'Telecom', 'Telecommunications', 'Television', 'Transportation', 'Travel',
    'Venture Capital',
  ];
  const question = (id: string) => allQuestions(ALL).find((q) => q.id === id)!;

  it('el tamaño tiene exactamente las opciones de `no_of_employees`, en el mismo orden', () => {
    expect(question('p_tamano').options!.map((o) => o.crm)).toEqual([...FRAPPE_EMPLOYEE_RANGES]);
    expect(question('p_tamano').options!.map((o) => o.id)).toEqual([...FRAPPE_EMPLOYEE_RANGES]);
  });

  it('los usuarios del equipo usan los mismos rangos (se pueden comparar con el tamaño)', () => {
    expect(question('x_usuarios_int').options!.map((o) => o.id)).toEqual([...FRAPPE_EMPLOYEE_RANGES]);
  });

  it('cada rubro apunta a una `CRM Industry` existente, y solo «Otro» no tiene', () => {
    for (const opt of question('p_industria').options!) {
      if (opt.id === 'otro') expect(opt.crm).toBeUndefined();
      else expect(CRM_INDUSTRY, opt.id).toContain(opt.crm);
    }
  });

  it('el perfil lleva los valores del campo `landing_profile`', () => {
    expect(question('p_perfil').options!.map((o) => o.crm)).toEqual(['Empresa', 'Organización', 'Independiente', 'Proyecto', 'Personal']);
  });
});

describe('controles de las opciones', () => {
  it('toda opción «Otro» abre su «¿cuál?» justo después (salvo el rubro: la descripción ya lo dice)', () => {
    const layout = allQuestions(ALL);
    layout.forEach((q, i) => {
      if (!q.options?.some((o) => o.id === 'otro') || q.id === 'p_industria') return;
      const next = layout[i + 1];
      expect(next?.id, q.id).toBe(`${q.id}_otro`);
      expect(next.required).toBe(true);
      expect(next.showIf).toEqual({ answer: q.id, in: ['otro'] });
    });
  });

  it('las opciones exclusivas solo existen en preguntas de varias respuestas', () => {
    for (const q of allQuestions(ALL)) {
      if (q.options?.some((o) => o.exclusive)) expect(q.type, q.id).toBe('multi');
    }
  });

  it('el tope de opciones solo en preguntas de varias, y menor que la cantidad de opciones', () => {
    for (const q of allQuestions(ALL)) {
      if (q.maxChoices === undefined) continue;
      expect(q.type, q.id).toBe('multi');
      expect(q.maxChoices, q.id).toBeLessThan(q.options!.filter((o) => !o.exclusive).length);
    }
  });

  it('los rótulos cortos del mensaje existen en los tres idiomas y son más cortos que la pregunta', () => {
    for (const q of allQuestions(ALL)) {
      if (!q.short) continue;
      for (const locale of ['es', 'pt', 'en'] as const) {
        expect(q.short[locale], `${q.id} ${locale}`).toBeTruthy();
        expect(q.short[locale].length, `${q.id} ${locale}`).toBeLessThan(q.label[locale].length);
      }
    }
  });
});
