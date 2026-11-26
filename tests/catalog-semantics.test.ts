/* La semántica del relevamiento v4, comprobada para los 5 perfiles × las 63 combinaciones de servicios:
 *   · ningún dato se pregunta dos veces;
 *   · a ningún servicio le falta lo que necesita (la matriz de docs/RELEVAMIENTO.md), se elija solo o combinado;
 *   · una condición solo mira preguntas anteriores (responder cambia lo que sigue, nunca lo que ya pasó);
 *   · las opciones que van a Frappe CRM son exactamente las de Frappe;
 *   · los pares de preguntas que se podían deducir una de otra ya no conviven. */
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
const BY_SERVICE: Record<ServiceId, string[]> = {
  consultoria: ['c_motivo', 'c_entregable'],
  desarrollo: ['x_herramientas', 'x_sistema_actual', 'x_usuarios_ext', 'd_dispositivos'],
  gestion: ['x_herramientas', 'x_sistema_actual', 'x_areas'],
  infraestructura: ['i_necesidad', 'p_ubicacion'],
  ia: ['a_objetivo'],
  soporte: ['s_tipo', 's_equipo', 's_modalidad', 'p_ubicacion'],
};
/** Lo que no aplica a un particular (no tiene equipo, sedes ni parque de equipos). */
const BY_SERVICE_UNLESS_PERSONAL: Partial<Record<ServiceId, string[]>> = {
  desarrollo: ['x_usuarios_int'],
  gestion: ['x_usuarios_int'],
  infraestructura: ['x_sedes', 'x_equipos'],
};

/** Respuestas que activan las preguntas condicionales: un sistema actual, un motivo que no es solo una duda, una reparación presencial. */
const RICH: Answers = { c_motivo: ['tiempo'], x_herramientas: ['comercial'], s_tipo: 'puntual', s_modalidad: 'presencial' };

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
      const expected = [
        ...ALWAYS,
        ...BY_PROFILE[profile],
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

  it('con solo una duda puntual no se pregunta qué quiere llevarse de la consultoría', () => {
    expect(visibleIds(['consultoria'], { ...base, c_motivo: ['duda'] })).not.toContain('c_entregable');
    expect(visibleIds(['consultoria'], { ...base, c_motivo: ['duda', 'idea'] })).toContain('c_entregable');
  });

  it('qué hacer con el sistema actual, solo si hay un sistema', () => {
    expect(visibleIds(['desarrollo'], { ...base, x_herramientas: ['papel', 'mensajeria'] })).not.toContain('x_sistema_actual');
    expect(visibleIds(['desarrollo'], { ...base, x_herramientas: ['propio'] })).toContain('x_sistema_actual');
  });

  it('si hoy no usan nada, no hay información que migrar', () => {
    expect(visibleIds(['gestion'], { ...base, x_herramientas: ['nada'] })).not.toContain('g_migracion');
    expect(visibleIds(['gestion'], { ...base, x_herramientas: ['planillas'] })).toContain('g_migracion');
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

  it('pagos y avisos por WhatsApp son integraciones; turnos, un área: no se repiten en las funciones del software', () => {
    const funciones = allQuestions(['desarrollo']).find((q) => q.id === 'd_funciones')!.options!.map((o) => o.label.es.toLowerCase());
    for (const word of ['pago', 'whatsapp', 'turno', 'reserva']) expect(funciones.join(' '), word).not.toContain(word);
  });

  it('la ciudad es obligatoria solo si hay trabajo en el lugar', () => {
    const ubicacion = (selected: ServiceId[], answers: Answers) => resolved(selected, { ...base, ...answers }).find((q) => q.id === 'p_ubicacion')!.required;
    expect(ubicacion(['ia'], {})).toBe(false);
    expect(ubicacion(['infraestructura'], {})).toBe(true);
    expect(ubicacion(['soporte'], { s_modalidad: 'remota' })).toBe(false);
    expect(ubicacion(['soporte'], { s_modalidad: 'presencial' })).toBe(true);
  });

  it('una respuesta que quedó de una pregunta ahora oculta no cuenta', () => {
    // Respondió el tamaño y «Otro» como entregable; después cambió a uso personal y a una duda puntual: esas dos ya no se hacen.
    const answers: Answers = { p_perfil: 'personal', p_tamano: '11-50', c_motivo: ['duda'], c_entregable: ['otro'], c_entregable_otro: 'x' };
    const ids = visibleIds(['consultoria'], answers);
    expect(ids).not.toContain('p_tamano');
    expect(ids).not.toContain('c_entregable');
    expect(ids).not.toContain('c_entregable_otro'); // su «¿cuál?» se va con ella
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
});
