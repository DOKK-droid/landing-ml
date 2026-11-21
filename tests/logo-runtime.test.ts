// @vitest-environment jsdom
/* La parte de la escena del logo que toca el navegador: tamaño de los canvas, bucle de cuadros, pausa fuera de pantalla,
 * "reducir movimiento" y limpieza. Los canvas y los observadores son falsos: se prueba la lógica, no el dibujo
 * (el dibujo lo cubre logo-scene.test.ts y, a ojo, un render a PNG). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startLogoScene } from '@/view/logoScene';

const grad = () => ({ addColorStop() {} });
const fakeCtx = () => {
  const calls = { setTransform: [] as number[][], clearRect: 0 };
  const ctx = new Proxy({}, {
    get: (_t, k) => {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return grad;
      if (k === 'setTransform') return (...a: number[]) => { calls.setTransform.push(a); };
      if (k === 'clearRect') return () => { calls.clearRect++; };
      return () => {};
    },
    set: () => true,
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
};

let queue: { id: number; cb: FrameRequestCallback }[] = [];
let nextId = 1;
let clock = 1000;
let reduced = false;
let io: ((e: { isIntersecting: boolean }[]) => void) | null = null;
let ioDisconnected = false;
let roDisconnected = false;
let mqListener: (() => void) | null = null;

const pump = (frames: number) => {
  for (let i = 0; i < frames; i++) {
    clock += 1000 / 60;
    const run = queue;
    queue = [];
    for (const f of run) f.cb(clock);
  }
};

function setup(width = 300) {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  const back = document.createElement('canvas');
  const front = document.createElement('canvas');
  const mark = document.createElement('div');
  const b = fakeCtx(), f = fakeCtx();
  back.getContext = (() => b.ctx) as never;
  front.getContext = (() => f.ctx) as never;
  return { root, back, front, mark, b, f };
}

beforeEach(() => {
  queue = []; nextId = 1; clock = 1000; reduced = false; io = null; ioDisconnected = false; roDisconnected = false; mqListener = null;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => { const id = nextId++; queue.push({ id, cb }); return id; }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => { queue = queue.filter((q) => q.id !== id); }) as typeof window.cancelAnimationFrame;
  window.matchMedia = ((query: string) => ({
    get matches() { return query.includes('reduced-motion') ? reduced : false; },
    media: query,
    addEventListener: (_: string, l: () => void) => { mqListener = l; },
    removeEventListener: () => { mqListener = null; },
  })) as unknown as typeof window.matchMedia;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { constructor(public cb: () => void) {} observe() {} disconnect() { roDisconnected = true; } };
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    constructor(cb: (e: { isIntersecting: boolean }[]) => void) { io = cb; }
    observe() {}
    disconnect() { ioDisconnected = true; }
  };
});
afterEach(() => vi.restoreAllMocks());

describe('startLogoScene', () => {
  it('dimensiona los canvas con margen y densidad de pantalla, y dibuja un primer cuadro', () => {
    const s = setup(300);
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    startLogoScene(s.root, s.back, s.front, s.mark);
    // 300 px de capa + 15 % de margen a cada lado, a 2x
    expect(s.back.width).toBe(Math.round(300 * 1.3 * 2));
    expect(s.front.height).toBe(Math.round(300 * 1.3 * 2));
    expect(s.b.calls.setTransform.at(-1)).toEqual([2, 0, 0, 2, 0, 0]);
    expect(s.b.calls.clearRect).toBeGreaterThan(0);
    expect(s.mark.style.transform).toMatch(/^rotateY\(.+deg\) rotateX\(.+deg\) translateY\(.+px\)$/);
  });

  it('limita la densidad a 2x aunque la pantalla sea mayor', () => {
    const s = setup(200);
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    startLogoScene(s.root, s.back, s.front, s.mark);
    expect(s.back.width).toBe(Math.round(200 * 1.3 * 2));
  });

  it('anima: cada cuadro mueve la marca y pide el siguiente', () => {
    const s = setup();
    startLogoScene(s.root, s.back, s.front, s.mark);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) { pump(1); seen.add(s.mark.style.transform); }
    expect(seen.size).toBeGreaterThan(30);
    expect(queue.length).toBe(1);
  });

  it('se detiene fuera de pantalla y sigue al volver', () => {
    const s = setup();
    startLogoScene(s.root, s.back, s.front, s.mark);
    pump(2);
    io!([{ isIntersecting: false }]);
    pump(2);
    expect(queue.length).toBe(0);
    io!([{ isIntersecting: true }]);
    expect(queue.length).toBe(1);
    pump(1);
    expect(queue.length).toBe(1);
  });

  it('con "reducir movimiento" dibuja un solo cuadro en reposo y no pide cuadros', () => {
    reduced = true;
    const s = setup();
    startLogoScene(s.root, s.back, s.front, s.mark);
    expect(queue.length).toBe(0);
    expect(s.mark.style.transform).toBe('');
    expect(s.b.calls.clearRect).toBeGreaterThan(0);
  });

  it('si el usuario activa o quita "reducir movimiento" a media sesión, se adapta', () => {
    const s = setup();
    startLogoScene(s.root, s.back, s.front, s.mark);
    pump(3);
    expect(s.mark.style.transform).not.toBe('');
    reduced = true;
    mqListener!();
    expect(queue.length).toBe(0);
    expect(s.mark.style.transform).toBe('');
    reduced = false;
    mqListener = mqListener ?? (() => {});
  });

  it('al desmontar para el bucle, suelta los observadores y deja la marca sin transformar', () => {
    const s = setup();
    const stop = startLogoScene(s.root, s.back, s.front, s.mark);
    pump(2);
    stop();
    expect(queue.length).toBe(0);
    expect(ioDisconnected).toBe(true);
    expect(roDisconnected).toBe(true);
    expect(s.mark.style.transform).toBe('');
  });

  it('sin canvas 2D (o sin ancho todavía) no falla ni deja nada corriendo', () => {
    const s = setup();
    s.back.getContext = (() => null) as never;
    const stop = startLogoScene(s.root, s.back, s.front, s.mark);
    expect(queue.length).toBe(0);
    expect(() => stop()).not.toThrow();

    const z = setup(0);
    startLogoScene(z.root, z.back, z.front, z.mark);
    expect(queue.length).toBe(0);
    expect(z.mark.style.transform).toBe('');
  });
});
