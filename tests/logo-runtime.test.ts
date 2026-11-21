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

/** Un solo cuadro, `ms` después del anterior: para recorrer segundos de animación sin dibujar cientos de cuadros. */
const jump = (ms: number) => {
  clock += ms;
  const run = queue;
  queue = [];
  for (const f of run) f.cb(clock);
};

const pump = (frames: number) => {
  for (let i = 0; i < frames; i++) {
    clock += 1000 / 60;
    const run = queue;
    queue = [];
    for (const f of run) f.cb(clock);
  }
};

const stops: (() => void)[] = [];
type Scene = { root: HTMLElement; back: HTMLCanvasElement; front: HTMLCanvasElement; mark: HTMLElement };
/** Monta la escena y se acuerda de desmontarla al terminar la prueba. */
const start = (s: Scene) => {
  const stop = startLogoScene(s.root, s.back, s.front, s.mark);
  stops.push(stop);
  return stop;
};

function setup(width = 300) {
  // El contenedor exterior (.hero__logo) es el que lleva `data-shown` cuando el logo aparece.
  const wrap = document.createElement('div');
  const root = document.createElement('div');
  wrap.append(root);
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  const back = document.createElement('canvas');
  const front = document.createElement('canvas');
  const mark = document.createElement('div');
  const b = fakeCtx(), f = fakeCtx();
  back.getContext = (() => b.ctx) as never;
  front.getContext = (() => f.ctx) as never;
  return { wrap, root, back, front, mark, b, f };
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
afterEach(() => {
  // Cada escena escucha `ml:ready` en window: se desmontan todas para que una prueba no dispare las de las anteriores.
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.boot;
});

describe('startLogoScene', () => {
  it('dimensiona los canvas con margen y densidad de pantalla, y dibuja un primer cuadro plano (2D)', () => {
    const s = setup(300);
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    start(s);
    // 300 px de capa + 15 % de margen a cada lado, a 2x
    expect(s.back.width).toBe(Math.round(300 * 1.3 * 2));
    expect(s.front.height).toBe(Math.round(300 * 1.3 * 2));
    expect(s.b.calls.setTransform.at(-1)).toEqual([2, 0, 0, 2, 0, 0]);
    expect(s.b.calls.clearRect).toBeGreaterThan(0);
    // el primer cuadro es el logo plano: la marca todavía no se inclina
    expect(s.mark.style.transform).toBe('');
  });

  it('limita la densidad a 2x aunque la pantalla sea mayor', () => {
    const s = setup(200);
    Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
    start(s);
    expect(s.back.width).toBe(Math.round(200 * 1.3 * 2));
  });

  it('anima: pasada la pausa de arranque cada cuadro mueve la marca y pide el siguiente', () => {
    const s = setup();
    start(s);
    pump(1);
    expect(s.mark.style.transform).toBe(''); // la espera de arranque (2,5 s): sigue plano
    jump(10000); // pasada la espera y las rampas
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) { pump(1); seen.add(s.mark.style.transform); }
    expect(seen.size).toBeGreaterThan(15);
    expect(queue.length).toBe(1);
  });

  it('se detiene fuera de pantalla y sigue al volver', () => {
    const s = setup();
    start(s);
    pump(2);
    io!([{ isIntersecting: false }]);
    pump(2);
    expect(queue.length).toBe(0);
    io!([{ isIntersecting: true }]);
    expect(queue.length).toBe(1);
    pump(1);
    expect(queue.length).toBe(1);
  });

  it('mientras el banner de carga está puesto el logo sigue oculto y sin pedir cuadros', () => {
    document.documentElement.dataset.boot = 'loading';
    const s = setup();
    start(s);
    expect(s.b.calls.clearRect).toBeGreaterThan(0); // dibujó el logo plano en su canvas, pero no se muestra
    pump(120);
    expect(queue.length).toBe(0);
    expect(s.wrap.hasAttribute('data-shown')).toBe(false);
    expect(s.mark.style.transform).toBe('');
  });

  it('línea de tiempo tras retirarse el banner: oculto → aparece plano al segundo → sigue plano → pasa a 3D', () => {
    document.documentElement.dataset.boot = 'loading';
    const s = setup();
    const stop = start(s);
    document.documentElement.dataset.boot = 'ready';
    window.dispatchEvent(new Event('ml:ready'));
    expect(queue.length).toBe(1);

    jump(500); // 0,5 s: el banner se está yendo; el logo aún no está
    expect(s.wrap.hasAttribute('data-shown')).toBe(false);
    jump(300); // 0,8 s
    expect(s.wrap.hasAttribute('data-shown')).toBe(false);
    jump(300); // 1,1 s: aparece, de la nada, y plano
    expect(s.wrap.hasAttribute('data-shown')).toBe(true);
    expect(s.mark.style.transform).toBe('');
    jump(1900); // 3,0 s: ya se ve entero y sigue plano
    expect(s.mark.style.transform).toBe('');
    jump(700); // 3,7 s: empezó la transición al 3D (a los 3,4 s)
    expect(s.mark.style.transform).not.toBe('');

    stop();
    expect(s.wrap.hasAttribute('data-shown')).toBe(false);
    queue = [];
    window.dispatchEvent(new Event('ml:ready'));
    expect(queue.length).toBe(0);
  });

  it('si el logo se monta con el banner ya retirado (volver del relevamiento) aparece casi al instante', () => {
    const s = setup(); // sin data-boot: no hay banner que esperar
    start(s);
    expect(s.wrap.hasAttribute('data-shown')).toBe(false);
    jump(150);
    expect(s.wrap.hasAttribute('data-shown')).toBe(true);
  });

  it('la transición es gradual: a los pocos cuadros de empezar la marca casi no se inclina y después sí', () => {
    const s = setup();
    start(s);
    const angle = () => Math.abs(Number(/rotateY\((-?[\d.]+)deg\)/.exec(s.mark.style.transform)?.[1] ?? 0));
    jump(2500 + 200); // espera de arranque + 0,2 s de animación
    const early = angle();
    // una vez pasada la rampa la marca oscila entre ±14°: no hay un salto de 0 a 14° en el primer cuadro
    expect(early).toBeLessThan(6);
    jump(10000);
    let max = 0;
    for (let i = 0; i < 28; i++) { jump(250); max = Math.max(max, angle()); } // un periodo completo (7 s)
    expect(max).toBeGreaterThan(13);
  });

  it('con "reducir movimiento" dibuja un solo cuadro en reposo y no pide cuadros', () => {
    reduced = true;
    const s = setup();
    start(s);
    expect(queue.length).toBe(0);
    expect(s.mark.style.transform).toBe('');
    expect(s.b.calls.clearRect).toBeGreaterThan(0);
    expect(s.wrap.hasAttribute('data-shown')).toBe(true); // aparece al instante, sin esperar ni animar
  });

  it('con "reducir movimiento" aparece al instante aunque el banner de carga siga puesto', () => {
    reduced = true;
    document.documentElement.dataset.boot = 'loading';
    const s = setup();
    start(s);
    expect(s.wrap.hasAttribute('data-shown')).toBe(true);
    expect(queue.length).toBe(0);
  });

  it('si el usuario activa o quita "reducir movimiento" a media sesión, se adapta', () => {
    const s = setup();
    start(s);
    pump(1);
    jump(10000);
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
    const stop = start(s);
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
    const stop = start(s);
    expect(queue.length).toBe(0);
    expect(s.wrap.hasAttribute('data-shown')).toBe(true); // sin canvas el logo (solo la marca) se muestra igual
    expect(() => stop()).not.toThrow();

    const z = setup(0);
    start(z);
    expect(z.mark.style.transform).toBe('');
    jump(150); // sin ancho todavía no hay nada que dibujar, pero el logo igual se muestra a su hora
    expect(z.wrap.hasAttribute('data-shown')).toBe(true);
  });
});
