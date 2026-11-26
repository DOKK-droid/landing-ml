// @vitest-environment jsdom
/* QA de la conversación en un DOM simulado (jsdom): se opera la interfaz como lo haría un cliente —clics en chips,
 * escribir, Omitir, Atrás— y se comprueba qué se ve en cada momento, incluida la secuencia temporal de la
 * transición entre preguntas. No reemplaza una prueba en un navegador real (estilos, fluidez, teclado móvil). */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '@/controller/resume';
import { allQuestions, buildSections, INQUIRY_SECTION } from '@/model/catalog';
import { buildFlow } from '@/model/flow';
import type { Answers } from '@/model/types';
import { App } from '@/view/App';
import { PICK_DELAY_MS } from '@/view/survey/Composer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EXIT_MS = 170;
const TYPING_MS = 380;
const SERVICE = 'ia' as const;
/** Las preguntas posibles del recorrido (el que se ve depende de las respuestas). */
const QUESTIONS = allQuestions([SERVICE]);
const questionOf = (id: string) => QUESTIONS.find((q) => q.id === id)!;

let root: Root | null = null;
let container: HTMLElement;

/** Un navegador mínimo: sin "reducir movimiento" ni mouse por defecto, y sin las APIs de scroll que jsdom no trae. */
function stubBrowser({ reduced, hover }: { reduced: boolean; hover: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduced-motion') ? reduced : query.includes('hover: hover') ? hover : false,
    media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  // jsdom no trae canvas: el logo del inicio se queda sin escena (solo la marca y el halo), como en un navegador sin 2D.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = () => {};
}

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));
const text = (sel: string) => $(sel)?.textContent?.trim() ?? '';
const question = () => text('.bubble__text');
const stageId = () => $('.composer__stage')?.getAttribute('data-question');
const buttonByText = (label: string) => $$('button').find((b) => b.textContent?.trim() === label);

const tick = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
const click = (el: Element | null | undefined) => {
  if (!el) throw new Error('No se encontró el elemento a tocar');
  return act(async () => { (el as HTMLElement).click(); });
};
const typeInto = (el: HTMLInputElement | HTMLTextAreaElement, value: string) =>
  act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });

async function mount() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(createElement(App, { locale: 'es' })); });
}

/** Del landing a la primera pregunta (con un servicio). */
async function startSurvey() {
  await mount();
  await click($(`#svc-${SERVICE} .toggle`));
  await click($('.selbar .btn--primary'));
  await tick(0);
}

/**
 * Espera a que la pregunta esté lista (sin transición pendiente). Son dos pasos porque el segundo temporizador
 * (el "escribiendo…") recién se arma cuando React termina de dibujar el cambio que dispara el primero.
 */
const settle = async () => {
  await tick(EXIT_MS + 5);
  await tick(TYPING_MS + 5);
};

async function answerText(value: string) {
  await typeInto($<HTMLInputElement>('.answer__row input, .answer__row textarea')!, value);
  await click($('.answer__send'));
  await settle();
}
async function pickFirstChip() {
  await click($('.chip'));
  await tick(PICK_DELAY_MS + 5);
  await settle();
}
async function skip() {
  await click(buttonByText('Omitir'));
  await settle();
}
/** Perfil (empresa) y rubro: deja en la primera pregunta de texto, la descripción. */
async function startAtText() {
  await startSurvey();
  await pickFirstChip();
  await pickFirstChip();
}
/**
 * En la primera pregunta del servicio, con el paso 1 respondido y la situación actual (opcional para IA) omitida.
 * Se retoma ahí en vez de recorrer todo con clics: en una máquina cargada eso solo tarda más que el límite de la prueba.
 * El recorrido completo con clics tiene su propia prueba («recorrido completo por la interfaz»).
 */
async function reachService() {
  await mountAt('a_objetivo', EMPRESA);
}

/** Abre el relevamiento directo en una pregunta, con estas respuestas (como si se retomara una pestaña). */
async function mountAt(questionId: string, answers: Answers) {
  const cursor = buildFlow(buildSections([SERVICE], answers)).findIndex((st) => st.question.id === questionId);
  if (cursor < 0) throw new Error(`${questionId} no está en el recorrido`);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    phase: 'survey', selected: [SERVICE], cursor, errors: {}, reference: 'ML-261120-TEST', origin: '', draft: null, answers,
  }));
  await mount();
  await tick(0);
}
const EMPRESA: Answers = { p_perfil: 'empresa', p_industria: 'comercio', p_descripcion: 'Ferretería', p_tamano: '1-10', x_necesidad: 'Facturas' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  sessionStorage.clear();
  stubBrowser({ reduced: true, hover: false });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  container?.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('una pregunta por vez', () => {
  it('muestra la sección en curso, su avance y una sola pregunta', async () => {
    await startSurvey();
    expect(text('.chat__title')).toBe('Su consulta');
    expect(text('.chat__kicker')).toContain('Sección 1 de 5');
    expect(text('.chat__kicker')).toContain('Pregunta 1 de 4');
    expect($$('.chat__dots i')).toHaveLength(4);
    expect($$('.chat__dots i.is-now')).toHaveLength(1);
    expect($$('.bubble--q')).toHaveLength(1);
    expect(question()).toBe('¿Para quién es la consulta?');
    expect(text('.preview__title')).toBe('Vista previa del mensaje');
    expect($('.preview__bubble')?.textContent).toContain('RELEVAMIENTO INICIAL');
  });

  it('marca si la pregunta es obligatoria u opcional y cómo se responde', async () => {
    await startSurvey();
    expect(text('.bubble__meta')).toContain('Obligatorio');
    expect(text('.bubble__meta')).toContain('Elija una opción.');
    await pickFirstChip();
    await pickFirstChip();
    expect(text('.bubble__meta')).toContain('Obligatorio');
    expect(text('.bubble__meta')).not.toContain('Elija una opción.');
  });

  it('muestra la introducción de la sección solo en su primera pregunta', async () => {
    await startSurvey();
    expect(text('.bubble--intro')).toBe(INQUIRY_SECTION.intro!.es);
    await pickFirstChip();
    expect($('.bubble--intro')).toBeNull();
  });

  it('la ayuda de la pregunta se ve y describe el campo', async () => {
    await startAtText();
    const help = $('.bubble__help')!;
    expect(help.textContent).toBe('Solo qué hace. Lo que necesita resolver se lo preguntamos enseguida.');
    expect($('.answer__row input')?.getAttribute('aria-describedby')).toBe(help.id);
  });

  it('el perfil cambia el texto de lo que sigue: un proyecto no es una empresa', async () => {
    await startSurvey();
    await click($$('.chip')[3]); // «Un proyecto o emprendimiento nuevo»
    await tick(PICK_DELAY_MS + 5);
    await settle();
    expect(question()).toBe('¿En qué rubro está el proyecto?');
    await pickFirstChip();
    expect(question()).toBe('En una frase: ¿de qué se trata el proyecto y para quién es?');
  });

  it('un particular no ve rubro, descripción ni tamaño', async () => {
    await startSurvey();
    await click($$('.chip')[4]); // «Uso personal o del hogar»
    await tick(PICK_DELAY_MS + 5);
    await settle();
    expect(stageId()).toBe('x_necesidad');
    expect(text('.chat__kicker')).toContain('Pregunta 2 de 2');
  });
});

describe('responder con texto', () => {
  it('una obligatoria vacía no avanza y muestra el error; al escribir desaparece', async () => {
    await startAtText();
    await click($('.answer__send'));
    expect(stageId()).toBe('p_descripcion');
    expect(text('.answer__error')).toBe('Complete este dato para continuar.');
    expect($('.answer')?.classList.contains('is-error')).toBe(true);
    expect($('.answer__row input')?.getAttribute('aria-invalid')).toBe('true');

    await typeInto($<HTMLInputElement>('.answer__row input')!, 'Ferretería');
    expect($('.answer__error')).toBeNull();
  });

  it('lo que se escribe aparece en la vista previa y al enviar pasa a la siguiente pregunta', async () => {
    await startAtText();
    await typeInto($<HTMLInputElement>('.answer__row input')!, 'Ferretería');
    expect($('[data-q="p_descripcion"]')?.textContent).toContain('Ferretería');
    expect($('[data-q="p_descripcion"]')?.classList.contains('is-filled')).toBe(true);

    await click($('.answer__send'));
    await settle();
    expect(stageId()).toBe('p_tamano');
    expect(text('.chat__kicker')).toContain('Pregunta 4 de 5');
    expect($$('.chat__dots i.is-done')).toHaveLength(3);
    expect($('[data-q="p_tamano"]')?.classList.contains('is-asking')).toBe(true);
  });

  it('el campo de una línea respeta su límite de caracteres', async () => {
    await startAtText();
    expect($('.answer__row input')?.getAttribute('maxlength')).toBe('160'); // tope propio de la descripción
  });
});

describe('responder con chips', () => {
  it('una opción única se elige y, tras una pausa, pasa sola a la siguiente', async () => {
    await startSurvey();
    expect(stageId()).toBe('p_perfil');

    await click($('.chip'));
    const chip = $('.chip')!;
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.classList.contains('chip--on')).toBe(true);
    expect(stageId()).toBe('p_perfil'); // todavía no avanzó: se ve la elección
    expect($('[data-q="p_perfil"]')?.textContent).toContain(questionOf('p_perfil').options![0].label.es);

    await tick(PICK_DELAY_MS + 5);
    await settle();
    expect(stageId()).toBe('p_industria');
  });

  it('cambiar de opción durante la pausa avanza una sola vez, con la última elegida', async () => {
    await startSurvey();
    const [first, second] = $$('.chip');
    await click(first);
    await tick(100);
    await click(second);
    await tick(PICK_DELAY_MS + 5);
    await settle();
    expect(stageId()).toBe('p_industria'); // no saltó dos preguntas
    await click(buttonByText('Atrás'));
    await settle();
    expect($('.chip--on')?.textContent).toBe(questionOf('p_perfil').options![1].label.es);
  });

  it('las opciones múltiples no avanzan solas: se marcan varias y se sigue con el botón', async () => {
    await reachService();
    expect(stageId()).toBe('a_objetivo');
    const chips = $$('.chip');
    await click(chips[0]);
    await click(chips[1]);
    await tick(PICK_DELAY_MS + 50);
    expect(stageId()).toBe('a_objetivo');
    expect($$('.chip--on')).toHaveLength(2);
    expect($('[data-q="a_objetivo"]')?.textContent).toContain(', '); // las dos, en la vista previa

    await click(buttonByText('Siguiente'));
    await settle();
    expect(stageId()).toBe('a_volumen');
  });

  it('«Otro» abre «¿cuál?», obligatoria', async () => {
    await reachService();
    await click($$('.chip').at(-1)); // «Otro»
    await click(buttonByText('Siguiente'));
    await settle();
    expect(stageId()).toBe('a_objetivo_otro');
    expect(question()).toBe('Otra tarea: ¿cuál?');
    await click($('.answer__send'));
    expect(text('.answer__error')).toBe('Complete este dato para continuar.');
  });

  it('una opción exclusiva desmarca las demás, y elegir otra la desmarca a ella', async () => {
    await mountAt('x_herramientas', EMPRESA);
    const chip = (label: string) => $$('.chip').find((c) => c.textContent?.trim() === label)!;
    await click(chip('Papel o cuadernos'));
    await click(chip('Planillas (Excel, Google Sheets)'));
    expect($$('.chip--on')).toHaveLength(2);
    await click(chip('Todavía nada: es algo nuevo'));
    expect($$('.chip--on').map((c) => c.textContent?.trim())).toEqual(['Todavía nada: es algo nuevo']);
    await click(chip('No lo sé'));
    expect($$('.chip--on').map((c) => c.textContent?.trim())).toEqual(['No lo sé']);
    await click(chip('Papel o cuadernos'));
    expect($$('.chip--on').map((c) => c.textContent?.trim())).toEqual(['Papel o cuadernos']);
  });

  it('una obligatoria múltiple sin marcar no avanza y avisa', async () => {
    await reachService();
    await click(buttonByText('Siguiente'));
    expect(stageId()).toBe('a_objetivo');
    expect(text('.answer__error')).toBe('Complete este dato para continuar.');
  });

  it('los chips son botones accesibles dentro de un grupo rotulado con la pregunta', async () => {
    await startSurvey();
    const group = $('.chips')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent).toBe(question());
    for (const chip of $$('.chip')) {
      expect(chip.tagName).toBe('BUTTON');
      expect(chip.getAttribute('type')).toBe('button');
      expect(chip.hasAttribute('aria-pressed')).toBe(true);
    }
  });
});

describe('datos de contacto', () => {
  const READY: Answers = { ...EMPRESA, a_objetivo: ['documentos'], e_alcance: 'etapa', e_plazo: 'ya', p_nombre: 'Ana Pérez' };

  it('un correo mal escrito no deja pasar y explica cómo debería verse', async () => {
    await mountAt('p_correo', READY);
    await typeInto($<HTMLInputElement>('.answer__row input')!, 'ana@empresa');
    await click($('.answer__send'));
    expect(stageId()).toBe('p_correo');
    expect(text('.answer__error')).toBe('Revise el correo: debería verse como nombre@empresa.com.');
    expect($('.answer__row input')?.getAttribute('inputmode')).toBe('email');
  });

  it('ofrece corregir un error de tipeo conocido en el dominio', async () => {
    await mountAt('p_correo', READY);
    await typeInto($<HTMLInputElement>('.answer__row input')!, 'ana@gmial.com');
    expect(text('.answer__suggest')).toBe('¿Quiso decir ana@gmail.com?');
    await click($('.answer__suggest button'));
    expect($<HTMLInputElement>('.answer__row input')?.value).toBe('ana@gmail.com');
    expect($('.answer__suggest')).toBeNull();
  });

  it('sin correo, el teléfono pasa a ser obligatorio; con correo, es opcional', async () => {
    await mountAt('p_correo', READY);
    await skip();
    expect(stageId()).toBe('p_telefono');
    expect(text('.bubble__meta')).toContain('Obligatorio');
    expect(text('.bubble__help')).toBe('Sin correo, necesitamos un teléfono para contactarlo.');
    expect($('.answer__row input')?.getAttribute('type')).toBe('tel');
    await typeInto($<HTMLInputElement>('.answer__row input')!, '1234');
    await click($('.answer__send'));
    expect(text('.answer__error')).toMatch(/^Revise el teléfono/);

    await click(buttonByText('Atrás'));
    await settle();
    await answerText('ana@empresa.com');
    expect(stageId()).toBe('p_telefono');
    expect(text('.bubble__meta')).toContain('Opcional');
  });
});

describe('omitir y volver', () => {
  it('una pregunta opcional se omite sin error y queda sin responder', async () => {
    await reachService();
    await click($('.chip'));
    await click(buttonByText('Siguiente'));
    await settle();
    expect(stageId()).toBe('a_volumen');
    expect(text('.bubble__meta')).toContain('Opcional');
    expect(buttonByText('Siguiente')).toBeUndefined(); // sin respuesta, el botón es "Omitir"

    await skip();
    expect(stageId()).toBe('a_datos');
    expect($('.answer__error')).toBeNull();
    expect($('[data-q="a_volumen"]')).toBeNull(); // no aparece en el mensaje
  });

  it('Atrás vuelve a la pregunta anterior y conserva lo escrito', async () => {
    await startAtText();
    await answerText('Ferretería');
    await click(buttonByText('Atrás'));
    await settle();
    expect(stageId()).toBe('p_descripcion');
    expect($<HTMLInputElement>('.answer__row input')?.value).toBe('Ferretería');
  });

  it('Atrás en la primera pregunta vuelve al inicio sin perder la selección', async () => {
    await startSurvey();
    await click(buttonByText('Atrás'));
    expect($('.hero')).not.toBeNull();
    expect($(`#svc-${SERVICE} .toggle--on`)).not.toBeNull();
  });

  it('las secciones ya vistas se pueden reabrir y las siguientes no', async () => {
    await reachService();
    expect(text('.chat__title')).toBe('Inteligencia Artificial');
    const pills = $$('.progress__item button') as HTMLButtonElement[];
    expect(pills[0].disabled).toBe(false);
    expect(pills[3].disabled).toBe(true); // «Objetivos y reunión»: todavía no
    await click(pills[0]);
    await settle();
    expect(stageId()).toBe('p_perfil');
    expect(text('.chat__title')).toBe('Su consulta');
  });
});

describe('recorrido completo por la interfaz', () => {
  it('se puede completar todo lo obligatorio, omitir el resto y llegar a la revisión con el mensaje listo', async () => {
    await startSurvey();
    let guard = 0;
    while (!$('#msg') && guard++ < 60) {
      const q = questionOf(stageId()!);
      const required = text('.bubble__meta').includes('Obligatorio');
      if (q.type === 'text' || q.type === 'textarea') {
        if (!required) await skip();
        else if (q.format === 'phone') await answerText('+54 9 11 1234 5678');
        else await answerText(`Respuesta ${q.id}`);
      } else if (q.type === 'single') {
        if (required) await pickFirstChip();
        else await skip();
      } else if (required) {
        await click($('.chip'));
        await click(buttonByText('Siguiente') ?? buttonByText('Revisar mensaje'));
        await settle();
      } else {
        await skip();
      }
    }
    const message = $<HTMLTextAreaElement>('#msg');
    expect(message, 'llegó a la revisión').not.toBeNull();
    expect(message!.value).toContain('RELEVAMIENTO INICIAL');
    expect(message!.value).toContain('Respuesta p_descripcion');
    expect(message!.value).toContain('Respuesta x_necesidad');
    expect(message!.value).toContain('Respuesta p_nombre');
    expect(message!.value).toContain('+54 9 11 1234 5678');
    expect(message!.value).not.toMatch(/pendiente/i);
    expect($('a.btn--whatsapp')?.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(guard).toBeLessThanOrEqual(QUESTIONS.length);
  });
});

describe('persistencia', () => {
  it('guarda la posición y, al volver a montar, retoma en la misma pregunta', async () => {
    await startAtText();
    await answerText('Ferretería');
    await tick(400); // el guardado se escribe 250 ms después del último cambio
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!);
    expect(saved.cursor).toBe(3);
    expect(saved.phase).toBe('survey');
    expect(saved.answers.p_descripcion).toBe('Ferretería');

    await act(async () => root!.unmount());
    root = null;
    container.remove();
    await mount();
    await tick(0);
    expect(stageId()).toBe('p_tamano');
    expect($('[data-q="p_descripcion"]')?.textContent).toContain('Ferretería');
  });
});

describe('la transición entre preguntas (con animaciones)', () => {
  beforeEach(() => stubBrowser({ reduced: false, hover: false }));

  it('la primera pregunta arranca con "escribiendo…" y luego aparece', async () => {
    await startSurvey();
    expect($('.bubble--typing')).not.toBeNull();
    expect($('.bubble--q')).toBeNull();
    expect(text('.composer .sr-only')).toBe('Preparando la siguiente pregunta');
    await tick(TYPING_MS + 10);
    expect($('.bubble--typing')).toBeNull();
    expect(question()).toBe('¿Para quién es la consulta?');
  });

  it('al responder: sale la pregunta, aparece "escribiendo…" y entra la siguiente, en ese orden', async () => {
    await startSurvey();
    await tick(TYPING_MS + 10);
    await click($('.chip'));
    await tick(PICK_DELAY_MS + 5);

    // 1) La banda y la vista previa ya van por la pregunta 2; la zona de respuesta todavía muestra la 1, saliendo.
    expect(text('.chat__kicker')).toContain('Pregunta 2 de 5');
    expect(stageId()).toBe('p_perfil');
    expect($('.composer__stage')?.hasAttribute('inert')).toBe(true);

    // 2) "Escribiendo…"
    await tick(EXIT_MS + 5);
    expect($('.bubble--typing')).not.toBeNull();
    expect($('.answer')).toBeNull();

    // 3) Entra la pregunta nueva
    await tick(TYPING_MS + 5);
    expect($('.bubble--typing')).toBeNull();
    expect(stageId()).toBe('p_industria');
    expect($('.composer__stage')?.hasAttribute('inert')).toBe(false);
  });

  it('al volver atrás no se simula que se escribe', async () => {
    await startSurvey();
    await tick(TYPING_MS + 10);
    await pickFirstChip();
    await click(buttonByText('Atrás'));
    expect($('.composer__stage')?.hasAttribute('inert')).toBe(true);
    await tick(EXIT_MS + 5);
    expect($('.bubble--typing')).toBeNull();
    expect(stageId()).toBe('p_perfil');
  });

  it('con "reducir movimiento" el cambio es inmediato y no hay indicador', async () => {
    stubBrowser({ reduced: true, hover: false });
    await startAtText();
    expect($('.bubble--typing')).toBeNull();
    await typeInto($<HTMLInputElement>('.answer__row input')!, 'Ferretería');
    await click($('.answer__send'));
    expect(stageId()).toBe('p_tamano');
    expect($('.bubble--typing')).toBeNull();
  });
});

describe('foco y teclado', () => {
  it('en táctil el foco va a la pregunta (no abre el teclado sin que se pida)', async () => {
    await startSurvey();
    expect(document.activeElement).toBe($('.bubble__text'));
  });

  it('con mouse el foco va al campo de texto, listo para escribir', async () => {
    stubBrowser({ reduced: true, hover: true });
    await startAtText();
    expect(document.activeElement).toBe($('.answer__row input'));
  });

  /** En la pregunta abierta de la necesidad (un texto largo). */
  async function reachTextarea() {
    const { x_necesidad: _, ...before } = EMPRESA;
    await mountAt('x_necesidad', before);
    expect(stageId()).toBe('x_necesidad');
  }

  it('en un texto largo, Enter envía y Mayús+Enter no (solo con teclado físico)', async () => {
    stubBrowser({ reduced: true, hover: true });
    await reachTextarea();
    const area = $<HTMLTextAreaElement>('textarea')!;
    expect(area.getAttribute('maxlength')).toBe('600');
    await typeInto(area, 'Cargar facturas');

    await key(area, 'Enter', { shiftKey: true });
    await settle();
    expect(stageId()).toBe('x_necesidad');

    await key(area, 'Enter');
    await settle();
    expect(stageId()).toBe('x_herramientas');
  });

  it('en táctil Enter no envía (agrega una línea)', async () => {
    await reachTextarea();
    const area = $<HTMLTextAreaElement>('textarea')!;
    await typeInto(area, 'Cargar facturas');
    await key(area, 'Enter');
    await settle();
    expect(stageId()).toBe('x_necesidad');
  });

  it('el campo está rotulado con la pregunta', async () => {
    await startAtText();
    const input = $('.answer__row input')!;
    expect(document.getElementById(input.getAttribute('aria-labelledby')!)?.textContent).toBe(question());
  });
});
