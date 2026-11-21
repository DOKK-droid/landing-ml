// @vitest-environment jsdom
/* Banner de carga en un DOM simulado: se retira solo cuando todo cargó (hidratación, tipografías y carga de la página),
 * no antes del tiempo mínimo, y siempre antes del máximo. Al retirarse marca <html data-boot="ready"> y avisa con
 * `ml:ready` (la señal para que el logo pase de 2D a 3D). El reloj y las promesas de carga son controlados. */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Boot } from '@/view/components/Boot';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement;
let reduced = false;
let readyState: DocumentReadyState = 'complete';
let fontsResolve: (() => void) | null = null;
let readyEvents = 0;
const onReady = () => { readyEvents++; };

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
    await tick(650 + 220 + 10);
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
    await tick(700); // pasan el mínimo y las tipografías, falta la carga
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
    await tick(650 + 10);
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
