// @vitest-environment jsdom
/* El diagrama de "Tecnología pensada desde su negocio" en un DOM simulado: el reloj sigue al scroll y el estallido
 * solo llega cuando el círculo se cierra con la figura a la vista. Posición y alto de la figura son los que se
 * le dicen a getBoundingClientRect; el tiempo y los cuadros, controlados a mano. */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeroDiagram } from '@/view/components/HeroDiagram';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VH = 800;
const H = 440;
let root: Root | null = null;
let container: HTMLElement;
let top = 2000;
let height = H;
let queue: FrameRequestCallback[] = [];
let clock = 5000;
let reduced = false;

const fig = () => container.querySelector<HTMLElement>('figure.diagram')!;
const reveal = () => container.querySelector<SVGPathElement>('.diagram__reveal')!;
const offset = () => Number(reveal().style.strokeDashoffset);
const progress = () => 1 - offset();
const lit = () => container.querySelectorAll('.diagram__tick.is-lit').length;

/** Corre `n` cuadros de 1/60 s. */
async function pump(n: number) {
  await act(async () => {
    for (let i = 0; i < n; i++) {
      clock += 1000 / 60;
      const run = queue;
      queue = [];
      for (const cb of run) cb(clock);
    }
  });
}
/** Mueve la figura (como un scroll) y avisa. */
async function scrollTo(newTop: number, newHeight = H) {
  top = newTop;
  height = newHeight;
  await act(async () => { window.dispatchEvent(new Event('scroll')); });
}

beforeEach(async () => {
  top = 2000; height = H; queue = []; clock = 5000; reduced = false;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => { queue.push(cb); return queue.length; }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => { queue = []; }) as typeof window.cancelAnimationFrame;
  Object.defineProperty(window, 'innerHeight', { value: VH, configurable: true });
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduced-motion') ? reduced : false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.tagName === 'FIGURE'
      ? ({ top, height, bottom: top + height, left: 0, right: 500, width: 500, x: 0, y: top, toJSON() {} } as DOMRect)
      : ({ top: 0, height: 0, bottom: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON() {} } as DOMRect);
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  container.remove();
  vi.restoreAllMocks();
});

async function mount() {
  await act(async () => { root!.render(createElement(HeroDiagram, { locale: 'es', selected: [], onPick: () => {} })); });
}

describe('reloj del diagrama', () => {
  it('antes de llegar al scroll no hay barrido ni agujas ni estallido', async () => {
    await mount();
    await pump(30);
    expect(progress()).toBe(0);
    expect(fig().hasAttribute('data-sweep')).toBe(false);
    expect(fig().classList.contains('is-complete')).toBe(false);
    expect(lit()).toBe(0);
  });

  it('al subir por la pantalla el círculo se va cerrando, con las agujas y las horas encendidas', async () => {
    await mount();
    await scrollTo(500); // p ≈ 0.5
    await pump(120);
    const p = progress();
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
    expect(fig().hasAttribute('data-sweep')).toBe(true);
    expect(lit()).toBe(Math.floor(p * 12));
    const minute = container.querySelector<SVGLineElement>('.diagram__hand:not(.diagram__hand--hour)')!;
    expect(minute.getAttribute('x2')).not.toBeNull();
    expect(fig().classList.contains('is-complete')).toBe(false);
  });

  it('la aguja larga apunta justo a la punta del trazo revelado', async () => {
    await mount();
    await scrollTo(500);
    await pump(120);
    const head = container.querySelector<SVGCircleElement>('.diagram__head')!;
    const cx = Number(head.getAttribute('cx')), cy = Number(head.getAttribute('cy'));
    // El trazo revelado por p termina en el punto de la elipse a esa fracción del perímetro
    const p = progress();
    const angle = p * Math.PI * 2;
    // a ≈ b (170 vs 178): el ángulo medido desde el centro coincide con el avance hasta ~2°
    const measured = Math.atan2(cx - 230, -(cy - 220));
    const wrapped = measured < 0 ? measured + Math.PI * 2 : measured;
    expect(Math.abs(wrapped - angle)).toBeLessThan(0.05);
  });

  it('retrocede con el scroll hacia arriba mientras no se haya cerrado', async () => {
    await mount();
    await scrollTo(450);
    await pump(150);
    const high = progress();
    await scrollTo(650);
    await pump(150);
    expect(progress()).toBeLessThan(high);
    expect(fig().classList.contains('is-complete')).toBe(false);
  });

  it('al cerrarse con la figura entera a la vista, estalla la animación completa', async () => {
    await mount();
    await scrollTo(VH * 0.58 - H / 2); // figura entera, centro al 58 %
    await pump(200);
    expect(progress()).toBe(1);
    expect(lit()).toBe(12);
    expect(fig().classList.contains('is-complete')).toBe(true);
  });

  it('llegar de golpe (ancla) igual da la vuelta completa: no se salta el barrido', async () => {
    await mount();
    await scrollTo(VH * 0.58 - H / 2);
    await pump(10); // ~0,17 s
    expect(progress()).toBeGreaterThan(0);
    expect(progress()).toBeLessThan(0.5);
    expect(fig().classList.contains('is-complete')).toBe(false);
    await pump(200);
    expect(fig().classList.contains('is-complete')).toBe(true);
  });

  it('si se pasa de largo, el estallido espera a que la figura vuelva a verse', async () => {
    await mount();
    await scrollTo(-1200); // muy por encima: p=1 pero casi nada a la vista
    await pump(200);
    expect(progress()).toBe(1);
    expect(fig().classList.contains('is-complete')).toBe(false);
    await scrollTo(120); // vuelve a la vista
    await pump(5);
    expect(fig().classList.contains('is-complete')).toBe(true);
  });

  it('una vez completo deja de escuchar el scroll', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    await mount();
    await scrollTo(VH * 0.58 - H / 2);
    await pump(200);
    expect(fig().classList.contains('is-complete')).toBe(true);
    expect(remove.mock.calls.some(([t]) => t === 'scroll')).toBe(true);
    await scrollTo(2000);
    await pump(30);
    expect(fig().classList.contains('is-complete')).toBe(true);
  });

  it('con "reducir movimiento" aparece completo al instante, sin barrido', async () => {
    reduced = true;
    await mount();
    expect(fig().classList.contains('is-complete')).toBe(true);
    expect(queue.length).toBe(0);
    expect(fig().hasAttribute('data-sweep')).toBe(false);
  });

  it('desmontar suelta el scroll y cancela los cuadros pendientes', async () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    await mount();
    await scrollTo(500);
    await act(async () => { root!.unmount(); });
    root = createRoot(container);
    expect(remove.mock.calls.filter(([t]) => t === 'scroll').length).toBeGreaterThan(0);
    expect(queue.length).toBe(0);
  });
});

describe('estructura del diagrama', () => {
  it('conserva los seis módulos con su destino y suma 12 marcas de hora, dos agujas y la máscara de la órbita', async () => {
    await mount();
    expect(container.querySelectorAll('a.diagram__node').length).toBe(6);
    expect(container.querySelectorAll('.diagram__tick').length).toBe(12);
    expect(container.querySelectorAll('.diagram__hand').length).toBe(2);
    const orbit = container.querySelector('.diagram__orbit')!;
    const maskRef = orbit.getAttribute('mask')!;
    const id = /url\(#(.+)\)/.exec(maskRef)![1];
    expect(id).not.toContain(':');
    expect(container.querySelector('mask')!.getAttribute('id')).toBe(id);
  });

  it('la línea punteada cierra sin costura: un número entero de puntos en el perímetro', async () => {
    await mount();
    const dash = container.querySelector('.diagram__orbit')!.getAttribute('stroke-dasharray')!;
    const [on, off] = dash.split(' ').map(Number);
    const period = on + off;
    const perimeter = Math.PI * 348 * (1 + (3 * (8 / 348) ** 2) / (10 + Math.sqrt(4 - 3 * (8 / 348) ** 2)));
    expect(Math.abs(perimeter / period - Math.round(perimeter / period))).toBeLessThan(0.01);
  });
});
