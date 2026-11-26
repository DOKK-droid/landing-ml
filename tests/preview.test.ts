/* QA de la vista previa: se renderiza en el servidor (sin navegador) y se revisa el marcado resultante. */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildSections, getService } from '@/model/catalog';
import { buildLines } from '@/model/message';
import type { Answers, Locale } from '@/model/types';
import { criticalProgress } from '@/model/validation';
import { Preview } from '@/view/survey/Preview';

/** Una empresa: el perfil es la primera respuesta y decide qué se pregunta después. */
const EMPRESA: Answers = { p_perfil: 'empresa' };

function render(extra: Answers, locale: Locale = 'es', currentSectionId = 'consulta', currentQuestionId?: string) {
  const answers = { ...EMPRESA, ...extra };
  const sections = buildSections(['ia'], answers);
  const lines = buildLines({ locale, selected: ['ia'], sections, answers, reference: 'ML-261120-TEST' }, { pending: true, focusId: currentQuestionId });
  return renderToStaticMarkup(createElement(Preview, { locale, lines, progress: criticalProgress(sections, answers), currentSectionId, currentQuestionId }));
}

describe('vista previa', () => {
  it('muestra el avance de datos clave y los pendientes', () => {
    // IA para una empresa: perfil, rubro, descripción, tamaño, situación, impacto, intentos previos, qué haría la IA,
    // alcance, plazo, nombre y un medio de contacto (sin correo, el teléfono).
    const html = render({ p_descripcion: 'Ferretería' });
    expect(html).toContain('Vista previa del mensaje');
    expect(html).toContain('Datos clave: 2 de 12');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="2"');
    expect(html).toContain('aria-valuemax="12"');
    expect(html).toContain('Ferretería');
    expect((html.match(/class="pv-pending"/g) ?? []).length).toBe(10); // los otros 10 datos críticos
  });

  it('marca la sección actual y no la de los otros pasos', () => {
    const html = render({}, 'es', 'consulta');
    expect(html).toMatch(/data-section="consulta" class="pv-line pv-section is-current"/);
    expect(html).toMatch(/data-section="svc:ia" class="pv-line pv-section "/);
  });

  it('cuando están todos los datos clave lo indica', () => {
    const answers: Answers = {
      ...EMPRESA, p_industria: 'comercio', p_descripcion: 'x', p_tamano: '1-10', x_necesidad: 'x', x_impacto: ['tiempo'], x_intentos: 'no',
      a_objetivo: [getService('ia').questions[0].options![0].id], e_alcance: 'etapa', e_plazo: 'ya', p_nombre: 'Ana', p_correo: 'ana@x.com',
    };
    const sections = buildSections(['ia'], answers);
    expect(criticalProgress(sections, answers).missing).toEqual([]);
    const html = render(answers);
    expect(html).toContain('Datos clave completos');
    expect(html).toContain('is-complete');
    expect(html).not.toContain('pv-pending');
  });

  it('escapa lo que escribe el cliente: no se inyecta HTML', () => {
    const html = render({ p_descripcion: '<img src=x onerror=alert(1)>', p_nombre: '<script>alert(1)</script>' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('aplica el formato de WhatsApp con elementos, no con HTML en crudo', () => {
    const html = render({ p_descripcion: 'x' });
    expect(html).toContain('<strong>RELEVAMIENTO INICIAL</strong>');
    expect(html).toContain('<em>Enviado desde');
  });

  it('respeta el idioma', () => {
    expect(render({}, 'pt')).toContain('pendente');
    expect(render({}, 'en')).toContain('Message preview');
  });

  it('la región con scroll es alcanzable con teclado y está etiquetada', () => {
    const html = render({});
    expect(html).toMatch(/role="region"[^>]*aria-label="Vista previa del mensaje"|aria-label="Vista previa del mensaje"[^>]*role="region"/);
    expect(html).toContain('tabindex="0"');
  });

  it('en la conversación la vista previa siempre se ve: ya no tiene botón para plegarla', () => {
    expect(render({})).not.toContain('<button');
  });

  it('resalta el renglón de la pregunta que se está respondiendo', () => {
    const html = render({ p_descripcion: 'Ferretería' }, 'es', 'consulta', 'p_tamano');
    expect(html).toMatch(/data-q="p_tamano" class="pv-line pv-item is-pending is-asking"/);
    expect(html).toMatch(/data-q="p_descripcion" class="pv-line pv-item is-filled is-current"/);
  });

  it('una pregunta opcional en curso aparece como "opcional" y no como pendiente', () => {
    const html = render({}, 'es', 'cierre', 'e_presupuesto');
    expect(html).toMatch(/data-q="e_presupuesto" class="pv-line pv-item is-pending is-asking"/);
    expect(html).toContain('<span class="pv-pending">opcional</span>');
  });
});
