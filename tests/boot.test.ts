// @vitest-environment jsdom
/* Banner de carga en un DOM simulado: se retira solo cuando todo cargó (hidratación, tipografías y carga de la página),
 * no antes del tiempo mínimo, y siempre antes del máximo. Al retirarse marca <html data-boot="ready"> y avisa con
 * `ml:ready` (la señal para que el logo pase de 2D a 3D). El reloj y las promesas de carga son controlados.
 * Además dibuja el globo del inicio (el círculo de alrededor de ML) y deja que el logo aparezca y se borre con un barrido. */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Boot, MIN_FIRST_MS } from '@/view/components/Boot';
import { SEGMENTS } from '@/view/logoSweep';
import { TRAIL } from '@/view/logoTrail';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement;
let reduced = false;
let readyState: DocumentReadyState = 'complete';
let fontsResolve: (() => void) | null = null;
let readyEvents = 0;
const onReady = () => { readyEvents++; };

let frames: FrameRequestCallback[] = [];
let cancelled = 0;
let arcs = 0;
const grad = () => ({ addColorStop() {} });
const fakeCtx = () => new Proxy({}, {
  get: (_t, k) => {
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return grad;
    if (k === 'arc') return () => { arcs++; };
    return () => {};
  },
  set: () => true,
}) as unknown as CanvasRenderingContext2D;

const overlay = () => document.querySelector<HTMLElement>('.boot');
const html = () => document.documentElement;
const bar = () => Number(document.querySelector<HTMLElement>('.boot__bar i')?.style.getPropertyValue('--p') ?? NaN);

/** Avanza el reloj simulado `ms` milisegundos dejando correr las promesas. */
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

async function mount(locale: 'es' | 'pt' | 'en' = 'es') {
  await act(async () => { root!.render(createElement(Boot, { locale })); });
}

beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  readyState = 'complete';
  fontsResolve = null;
  readyEvents = 0;
  window.sessionStorage.clear();
  html().dataset.boot = 'loading';
  Object.defineProperty(document, 'readyState', { get: () => readyState, configurable: true });
  Object.defineProperty(document, 'fonts', { value: { ready: Promise.resolve() }, configurable: true });
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduced-motion') ? reduced : false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  frames = []; cancelled = 0; arcs = 0;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => { frames.push(cb); return frames.length; }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => { cancelled++; }) as typeof window.cancelAnimationFrame;
  HTMLCanvasElement.prototype.getContext = (() => fakeCtx()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { get: () => 180, configurable: true });
  window.addEventListener('ml:ready', onReady);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  container.remove();
  window.removeEventListener('ml:ready', onReady);
  delete html().dataset.boot;
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('banner de carga', () => {
  it('se ve desde el primer momento, con su texto en el idioma de la página y avisando a los lectores de pantalla', async () => {
    await mount('pt');
    expect(overlay()).not.toBeNull();
    expect(overlay()!.getAttribute('role')).toBe('status');
    expect(overlay()!.textContent).toContain('Carregando');
    expect(html().dataset.boot).toBe('loading');
    await mount('en');
    expect(overlay()!.textContent).toContain('Loading');
  });

  it('con todo ya cargado igual espera el tiempo mínimo para no parpadear', async () => {
    await mount();
    await tick(500);
    expect(overlay()!.classList.contains('is-leaving')).toBe(false);
    expect(html().dataset.boot).toBe('loading');
    expect(readyEvents).toBe(0);
  });

  it('cumplido el mínimo se retira: marca la página como lista, avisa y desaparece tras su salida', async () => {
    await mount();
    await tick(MIN_FIRST_MS + 220 + 10);
    expect(overlay()!.classList.contains('is-leaving')).toBe(true);
    expect(html().dataset.boot).toBe('ready');
    expect(readyEvents).toBe(1);
    expect(window.sessionStorage.getItem('ml-booted')).toBe('1');
    await tick(560);
    expect(overlay()).toBeNull();
  });

  it('espera a que termine la carga de la página (evento load)', async () => {
    readyState = 'loading';
    await mount();
    await tick(3000);
    expect(overlay()!.classList.contains('is-leaving')).toBe(false);
    expect(html().dataset.boot).toBe('loading');
    readyState = 'complete';
    await act(async () => { window.dispatchEvent(new Event('load')); });
    await tick(300);
    expect(html().dataset.boot).toBe('ready');
  });

  it('espera a las tipografías', async () => {
    Object.defineProperty(document, 'fonts', { value: { ready: new Promise<void>((r) => { fontsResolve = r; }) }, configurable: true });
    await mount();
    await tick(3000);
    expect(html().dataset.boot).toBe('loading');
    await act(async () => { fontsResolve!(); });
    await tick(300);
    expect(html().dataset.boot).toBe('ready');
  });

  it('si algo no termina nunca, se retira igual al llegar al máximo (8 s)', async () => {
    Object.defineProperty(document, 'fonts', { value: { ready: new Promise<void>(() => {}) }, configurable: true });
    await mount();
    await tick(7900);
    expect(html().dataset.boot).toBe('loading');
    await tick(100 + 220 + 10);
    expect(html().dataset.boot).toBe('ready');
    expect(readyEvents).toBe(1);
  });

  it('en una visita posterior de la sesión (todo en caché) el mínimo es casi nulo', async () => {
    window.sessionStorage.setItem('ml-booted', '1');
    await mount();
    await tick(120 + 220 + 10);
    expect(html().dataset.boot).toBe('ready');
  });

  it('la barra avanza con lo que se completa y termina llena', async () => {
    readyState = 'loading';
    await mount();
    const start = bar();
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThanOrEqual(0.5); // hidratado y tipografías; faltan la carga y el tiempo mínimo
    await tick(MIN_FIRST_MS + 50); // pasan el mínimo y las tipografías, falta la carga
    const mid = bar();
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeLessThan(1);
    readyState = 'complete';
    await act(async () => { window.dispatchEvent(new Event('load')); });
    await tick(10);
    expect(bar()).toBe(1);
  });

  it('con "reducir movimiento" se retira de inmediato y sin transición', async () => {
    reduced = true;
    await mount();
    await tick(MIN_FIRST_MS + 10);
    expect(html().dataset.boot).toBe('ready');
    expect(overlay()).toBeNull();
    expect(readyEvents).toBe(1);
  });

  it('si la página se cierra antes de terminar, no queda nada pendiente ni avisa', async () => {
    await mount();
    await act(async () => { root!.unmount(); });
    root = createRoot(container);
    await tick(9000);
    expect(readyEvents).toBe(0);
    expect(html().dataset.boot).toBe('loading');
  });

  it('el aviso se emite una sola vez aunque el máximo y la carga coincidan', async () => {
    await mount();
    await tick(8500);
    expect(readyEvents).toBe(1);
  });
});

describe('banner de carga: el globo y el barrido del logo', () => {
  it('el círculo de alrededor es el globo del inicio (un canvas), no el anillo de antes; y ML aparece y se borra solo, en su propio SVG: ni una línea dibujada encima', async () => {
    await mount();
    const mark = document.querySelector('.boot__mark')!;
    expect(mark.querySelector('canvas.logo3d__cv')).not.toBeNull();
    expect(document.querySelector('.boot__ring, .boot__track, .boot__arc')).toBeNull();
    const ml = mark.querySelector('.boot__ml')!;
    const logo = ml.querySelector('svg.logo__svg')!;
    expect(logo).not.toBeNull();
    expect(ml.querySelector('.logo__pulse'), 'ya no hay una línea encima del logo').toBeNull();
    expect(ml.querySelectorAll('svg')).toHaveLength(1);
    // el barrido: dos degradados por tramo (la máscara y la luz), cuatro máscaras y una copia de luz de cada forma, dentro del propio logo
    expect(logo.querySelectorAll('linearGradient[data-sweep]')).toHaveLength(SEGMENTS.length * 2);
    expect(logo.querySelectorAll('mask')).toHaveLength(4);
    expect(logo.querySelectorAll('polygon.logo__lit')).toHaveLength(5 + TRAIL.length * 2);
    // y la estela lleva un destello por línea (y su halo): solo el banner los pide
    expect(logo.querySelectorAll('.logo__trail-layer > path.logo__flow')).toHaveLength(TRAIL.length);
    expect(logo.querySelectorAll('.logo__trail-layer > path.logo__flow-glow')).toHaveLength(TRAIL.length);
    expect(mark.getAttribute('aria-hidden')).toBe('true'); // decorativo: lo que se anuncia es el texto "Cargando…"
  });

  it('el globo se dibuja con la densidad de pantalla y gira mientras el banner está a la vista', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    await mount();
    const cv = document.querySelector<HTMLCanvasElement>('.boot__mark canvas')!;
    expect(cv.width).toBe(Math.round(180 * 1.3 * 2)); // la capa de 180 px + 15 % de margen a cada lado, a 2x
    expect(arcs, 'ya dibujó el globo').toBeGreaterThan(0);
    const before = arcs;
    expect(frames.length).toBe(2); // el globo y el barrido piden el siguiente cuadro
    await act(async () => { const run = frames; frames = []; run.forEach((f) => f(performance.now() + 500)); });
    expect(arcs).toBeGreaterThan(before);
    expect(frames.length, 'y siguen pidiendo cuadros').toBe(2);
  });

  it('al retirarse el banner el globo y el barrido dejan de pedir cuadros (no queda nada corriendo detrás)', async () => {
    await mount();
    expect(cancelled).toBe(0);
    await tick(MIN_FIRST_MS + 220 + 560 + 20);
    expect(overlay()).toBeNull();
    expect(cancelled).toBeGreaterThan(0);
    const pending = frames.length;
    await act(async () => { const run = frames; frames = []; run.forEach((f) => f(performance.now() + 5000)); });
    expect(pending, 'quedaba un cuadro ya pedido').toBeGreaterThan(0);
    expect(frames.length, 'pero al llegar no pinta ni pide otro').toBe(0);
  });

  it('con "reducir movimiento" dibuja el globo UNA vez (quieto), deja el logo entero a la vista y no pide cuadros', async () => {
    reduced = true;
    await mount();
    expect(arcs).toBeGreaterThan(0);
    expect(frames.length).toBe(0);
    for (const g of document.querySelectorAll('linearGradient[data-sweep]')) {
      const want = g.getAttribute('data-sweep')!.startsWith('vis:') ? '1' : '0'; // máscara abierta del todo, luz apagada
      for (const stop of g.querySelectorAll('stop')) expect(stop.getAttribute('stop-opacity'), g.getAttribute('data-sweep')!).toBe(want);
    }
  });

  it('sin canvas 2D no falla: el banner se ve igual, sin globo', async () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    await mount();
    expect(overlay()).not.toBeNull();
    expect(frames.length, 'solo el barrido pide cuadros').toBe(1);
  });
});
