// @vitest-environment jsdom
/* La parte de la escena del logo que toca el navegador: tamaño de los canvas, bucle de cuadros, pausa fuera de pantalla,
 * "reducir movimiento" y limpieza. Los canvas y los observadores son falsos: se prueba la lógica, no el dibujo
 * (el dibujo lo cubre logo-scene.test.ts y, a ojo, un render a PNG). */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEAT_MS, FINAL_DELAY_MS, STAGES, SWEEP_CYCLES_AFTER_BOOT, flatMs, startLogoScene, sweepEndMs, sweepTime } from '@/view/logoScene';
import { EASE_POW, EDGE, FRONT_START, IN_AT, IN_DONE, IN_MS, OUT_AT, OUT_DONE, OUT_MS, PATH_LENGTH, PERIOD_MS, SETTLE_T, TRAVEL, visibleAt } from '@/view/logoSweep';
import { Logo } from '@/view/components/Logo';

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

  it('línea de tiempo tras retirarse el banner: oculto → aparece plano al segundo → sigue plano (con el barrido) → pasa a 3D', () => {
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
    jump(300); // 1,1 s: aparece, y plano
    expect(s.wrap.hasAttribute('data-shown')).toBe(true);
    expect(s.mark.style.transform).toBe('');
    // sigue plano mientras el logo hace el barrido (un ciclo entero y la última aparición): el 3D empieza `flatMs` después de aparecer
    const flat = flatMs(SWEEP_CYCLES_AFTER_BOOT);
    jump(1000 + flat - 1100 - 200); // 200 ms antes de que empiece el 3D
    expect(s.mark.style.transform).toBe('');
    jump(700); // 500 ms después de empezar
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

describe('profundidad de la estela (paralaje)', () => {
  const SVG = 'http://www.w3.org/2000/svg';
  /** Una marca con dos capas de la estela: una delante del plano (z > 0) y otra detrás (z < 0). */
  const withLayers = () => {
    const s = setup();
    const near = document.createElementNS(SVG, 'g'), far = document.createElementNS(SVG, 'g');
    near.setAttribute('data-z', '10');
    far.setAttribute('data-z', '-10');
    s.mark.append(near, far);
    return { s, near, far };
  };
  const shift = (el: Element) => {
    const m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(el.getAttribute('transform') ?? '');
    return m ? { dx: Number(m[1]), dy: Number(m[2]) } : null;
  };

  it('en reposo (plano) las capas no se mueven', () => {
    const { s, near, far } = withLayers();
    start(s);
    pump(3);
    expect(near.hasAttribute('transform')).toBe(false);
    expect(far.hasAttribute('transform')).toBe(false);
  });

  it('al inclinarse la marca, lo que está delante y lo que está detrás se desplazan hacia lados opuestos', () => {
    const { s, near, far } = withLayers();
    start(s);
    pump(1);
    jump(10000); // pasada la espera de arranque y las rampas
    // la marca oscila: se recorre un periodo y se comprueba en varios instantes
    let checked = 0;
    for (let i = 0; i < 28; i++) {
      jump(250);
      const n = shift(near), f = shift(far);
      if (n && f) {
        expect(Math.sign(n.dx)).toBe(-Math.sign(f.dx)); // lados opuestos
        expect(Math.abs(n.dx)).toBeCloseTo(Math.abs(f.dx), 0); // misma magnitud (misma |z|)
        expect(Math.abs(n.dx)).toBeLessThan(4); // y moderado: unas pocas unidades del dibujo
        expect(n.dy).toBe(0); // solo horizontal: el vertical abriría rendijas entre las líneas justo donde se unen a la pata
        expect(f.dy).toBe(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('el desplazamiento llega gradual, como la inclinación de la marca: no salta al empezar el 3D', () => {
    const { s, near } = withLayers();
    start(s);
    pump(1);
    jump(2500 + 200); // espera de arranque + 0,2 s de animación
    const early = shift(near);
    expect(early === null || Math.abs(early.dx) < 0.8).toBe(true);
  });

  it('solo toca el DOM cuando el desplazamiento cambia un paso (no repinta el SVG en cada cuadro)', () => {
    const { s, near } = withLayers();
    const spy = vi.spyOn(near, 'setAttribute');
    start(s);
    pump(1);
    jump(10000);
    spy.mockClear();
    pump(60); // un segundo a 60 cuadros
    expect(spy.mock.calls.filter(([name]) => name === 'transform').length).toBeLessThan(25);
  });

  it('con "reducir movimiento" no se mueven, y si se activa a media sesión vuelven a su sitio', () => {
    const { s, near, far } = withLayers();
    start(s);
    pump(1);
    jump(10000);
    jump(1000);
    expect(near.hasAttribute('transform') || far.hasAttribute('transform')).toBe(true);
    reduced = true;
    mqListener!();
    expect(near.hasAttribute('transform')).toBe(false);
    expect(far.hasAttribute('transform')).toBe(false);
  });

  it('al desmontar quedan sin desplazamiento', () => {
    const { s, near, far } = withLayers();
    const stop = start(s);
    pump(1);
    jump(10000);
    jump(1000);
    stop();
    expect(near.hasAttribute('transform')).toBe(false);
    expect(far.hasAttribute('transform')).toBe(false);
  });
});

describe('el barrido del logo del inicio (plano, hasta que empieza el 3D)', () => {
  /** El logo del inicio de verdad (su marcado, con el barrido nacido a la vista), montado en un DOM simulado. */
  function setupHero() {
    const holder = document.createElement('div');
    holder.innerHTML = renderToStaticMarkup(createElement(Logo, { variant: 'hero', sweep: 'visible' }));
    document.body.append(holder);
    const root = holder.querySelector<HTMLElement>('.logo3d')!;
    Object.defineProperty(root, 'clientWidth', { value: 300, configurable: true });
    const [back, front] = Array.from(holder.querySelectorAll('canvas'));
    const b = fakeCtx(), f = fakeCtx();
    back.getContext = (() => b.ctx) as never;
    front.getContext = (() => f.ctx) as never;
    const mark = holder.querySelector<SVGSVGElement>('.logo3d__mark')!;
    const wrap = root.parentElement!;
    const gradients = () => Array.from(holder.querySelectorAll('linearGradient[data-sweep]'));
    /** Opacidades de las paradas de la máscara (`vis`) de un tramo, o de todos. */
    const vis = (id?: string) => gradients()
      .filter((g) => (g.getAttribute('data-sweep') ?? '').startsWith(id ? `vis:${id}` : 'vis:'))
      .flatMap((g) => Array.from(g.querySelectorAll('stop'), (st) => Number(st.getAttribute('stop-opacity'))));
    const lit = () => gradients().filter((g) => (g.getAttribute('data-sweep') ?? '').startsWith('lit:')).flatMap((g) => Array.from(g.querySelectorAll('stop'), (st) => Number(st.getAttribute('stop-opacity'))));
    const masks = () => holder.querySelectorAll('[mask]').length;
    return { holder, root, back, front, mark, wrap, vis, lit, masks };
  }
  type Hero = ReturnType<typeof setupHero>;
  const startHero = (h: Hero) => { const stop = startLogoScene(h.root, h.back, h.front, h.mark); stops.push(stop); return stop; };
  afterEach(() => { document.body.innerHTML = ''; });
  /** Cuándo (ms del periodo) el frente de aparición está en la longitud de arco `arc` (más el borde, para que ya se vea del todo). */
  const tFront = (arc: number) => IN_AT + IN_MS * ((arc + EDGE - FRONT_START) / (TRAVEL - FRONT_START)) ** (1 / EASE_POW);

  /** Con el banner puesto y retirado: devuelve cuánto hay que avanzar para estar a `ms` de que el logo aparezca (a 1 s de retirarse el banner). */
  const afterBoot = () => {
    document.documentElement.dataset.boot = 'loading';
    const h = setupHero();
    const stop = startHero(h);
    document.documentElement.dataset.boot = 'ready';
    window.dispatchEvent(new Event('ml:ready'));
    const revealAt = clock + 1000;
    return { h, stop, goto: (ms: number) => jump(revealAt + ms - clock) };
  };

  it('el marcado del inicio nace con el logo ENTERO a la vista (si el script no llega, se ve igual) y con las máscaras puestas', () => {
    const h = setupHero();
    expect(h.vis().length).toBeGreaterThan(50);
    expect(h.vis().every((v) => v === 1)).toBe(true);
    expect(h.lit().every((v) => v === 0)).toBe(true);
    expect(h.masks()).toBeGreaterThan(3);
    // los degradados (en el SVG del halo) y las máscaras (en el de la marca) están en el mismo contenedor: la escena los encuentra desde `root`
    expect(h.root.querySelector('.logo3d__halo linearGradient[data-sweep]')).not.toBeNull();
  });

  it('ni el barrido ni su luz tocan el logo antes de que le toque aparecer; en el primer cuadro de la aparición ya está oculto (sin destello)', () => {
    const { h, goto } = afterBoot();
    expect(h.vis().every((v) => v === 1)).toBe(true);
    goto(-100); // aún no le toca
    expect(h.wrap.hasAttribute('data-shown')).toBe(false);
    expect(h.vis().every((v) => v === 1)).toBe(true);
    goto(20); // le toca: se oculta ANTES de mostrarse, en el mismo cuadro
    expect(h.wrap.hasAttribute('data-shown')).toBe(true);
    expect(h.vis().every((v) => v === 0)).toBe(true);
  });

  it('hace DOS bucles en 2D (aparece con un barrido y se borra con otro que arranca antes de que el primero termine), cada uno empezando por la estela', () => {
    expect(SWEEP_CYCLES_AFTER_BOOT).toBe(2);
    const { h, goto } = afterBoot();
    goto(tFront(40)); // el frente va por la estela
    expect(Math.max(...h.vis('trail-diag'))).toBe(1);
    expect(Math.max(...h.vis('foot')), 'la L aún no').toBe(0);
    goto(IN_DONE); // acaba de aparecer la L… y el borrado ya se llevó la punta de la estela
    expect(Math.min(...h.vis('foot'))).toBe(1);
    expect(Math.min(...h.vis('trail-diag')), 'la punta de la estela ya se borró').toBe(0);
    goto(OUT_AT + OUT_MS * 0.6); // el frente de borrado ya pasó la estela
    expect(Math.max(...h.vis('trail-diag'))).toBe(0);
    expect(Math.min(...h.vis('foot'))).toBe(1);
    goto(OUT_DONE + 50); // borrado del todo
    expect(h.vis().every((v) => v === 0)).toBe(true);
    goto(PERIOD_MS + tFront(40)); // el segundo bucle, igual
    expect(Math.max(...h.vis('trail-diag'))).toBe(1);
    expect(Math.max(...h.vis('foot'))).toBe(0);
    goto(PERIOD_MS + IN_DONE);
    expect(Math.min(...h.vis('foot')), 'el segundo bucle también llega a la L').toBe(1);
    expect(Math.min(...h.vis('trail-diag'))).toBe(0);
    goto(PERIOD_MS + OUT_DONE - 60);
    expect(h.vis().some((v) => v > 0) && h.vis().some((v) => v === 0), 'y se borra con su barrido').toBe(true);
    expect(h.lit().some((v) => v > 0), 'con la luz del frente').toBe(true);
    expect(h.mark.style.transform, 'todo el rato plano').toBe('');
  });

  it('tras borrarse por segunda vez empieza el 3D con la marca OCULTA: el globo y los arcos se mueven sin el logo', () => {
    const { h, goto } = afterBoot();
    const begin = flatMs(SWEEP_CYCLES_AFTER_BOOT);
    expect(begin, 'justo después del último borrado').toBe(PERIOD_MS + OUT_DONE + BEAT_MS);
    goto(PERIOD_MS + OUT_DONE + 20); // ya borrado, aún plano
    expect(h.vis().every((v) => v === 0)).toBe(true);
    expect(h.mark.style.transform).toBe('');
    goto(begin + 400); // el 3D ya empezó…
    expect(h.mark.style.transform, '…la escena se mueve').not.toBe('');
    expect(h.vis().every((v) => v === 0), '…y la marca sigue oculta').toBe(true);
    expect(h.masks(), 'con sus máscaras puestas, esperando la última aparición').toBeGreaterThan(3);
  });

  it('el logo APARECE una última vez, ya en 3D, cuando la marca empieza a inclinarse; esa aparición no se borra, y después queda entero y sin máscaras para siempre', () => {
    const { h, goto } = afterBoot();
    const begin = flatMs(SWEEP_CYCLES_AFTER_BOOT);
    expect(FINAL_DELAY_MS, 'cuando empieza a inclinarse la marca').toBe(STAGES.mark.delay * 1000);
    const front = begin + FINAL_DELAY_MS - IN_AT; // el reloj de la última aparición: su frente sale IN_AT después
    goto(front + IN_AT - 80);
    expect(h.vis().every((v) => v === 0), 'aún oculto justo antes').toBe(true);
    goto(front + tFront(40)); // el frente va por la estela
    expect(Math.max(...h.vis('trail-diag')), 'aparece por la estela').toBe(1);
    expect(Math.max(...h.vis('foot')), 'y la L todavía no').toBe(0);
    expect(h.mark.style.transform, 'ya en 3D').not.toBe('');
    goto(front + IN_DONE + 40);
    expect(h.vis().every((v) => v === 1), 'entero: esta aparición no se borra').toBe(true);
    goto(front + OUT_AT + OUT_MS * 0.6); // donde en un bucle ya se habría borrado la estela
    expect(h.vis().every((v) => v === 1)).toBe(true);
    expect(sweepEndMs(SWEEP_CYCLES_AFTER_BOOT), 'el barrido no termina antes de salir su frente').toBeGreaterThan(front);
    goto(sweepEndMs(SWEEP_CYCLES_AFTER_BOOT) + 100);
    expect(h.masks(), 'sin máscaras').toBe(0);
    expect(h.vis().every((v) => v === 1)).toBe(true);
    expect(h.lit().every((v) => v === 0)).toBe(true);
    // y ya no se vuelve a escribir nada en el logo
    const spy = vi.spyOn(Element.prototype, 'setAttribute');
    for (let i = 0; i < 30; i++) goto(sweepEndMs(SWEEP_CYCLES_AFTER_BOOT) + 300 + i * 100);
    expect(spy.mock.calls.filter(([n]) => n === 'stop-opacity' || n === 'mask')).toHaveLength(0);
  });

  it('la cronología cierra: el reloj del barrido está borrado entre el último borrado y la última aparición, y el logo está entero cuando se sueltan las máscaras', () => {
    const c = SWEEP_CYCLES_AFTER_BOOT;
    const begin = flatMs(c);
    const hidden = (e: number) => { const sw = sweepTime(e, c); for (let arc = 0; arc <= PATH_LENGTH; arc += 5) expect(visibleAt(arc, sw.t, sw.once), `e = ${e}, arco ${arc}`).toBe(0); };
    for (const e of [PERIOD_MS + OUT_DONE + 5, begin - 1, begin, begin + 400, begin + FINAL_DELAY_MS - IN_AT - 5]) hidden(e);
    const end = sweepTime(sweepEndMs(c) - 1, c);
    for (let arc = 0; arc <= PATH_LENGTH; arc += 5) expect(visibleAt(arc, end.t, end.once), `arco ${arc}`).toBe(1);
    expect(end.once, 'la última aparición no se borra').toBe(true);
    expect(sweepTime(sweepEndMs(c) + 5000, c)).toEqual({ t: SETTLE_T, once: true });
    expect(BEAT_MS, 'un instante, no una espera').toBeLessThan(300);
    expect(begin, 'la fase plana, más corta que con el barrido anterior').toBeLessThan(4500);
    expect(flatMs(0), 'sin bucles: la de siempre (aparecer y mantenerse)').toBe(2400);
    expect(sweepEndMs(0), 'y se sueltan las máscaras al empezar el 3D').toBe(2400);
  });

  it('con el banner ya retirado (volver al inicio) aparece UNA vez y se queda entero hasta el 3D: no se borra', () => {
    const h = setupHero();
    startHero(h); // sin data-boot: no hay banner que esperar (aparece a los 100 ms)
    const revealAt = clock + 100;
    const goto = (ms: number) => jump(revealAt + ms - clock);
    goto(tFront(40));
    expect(Math.max(...h.vis('foot')), 'aún barriendo').toBe(0);
    goto(OUT_AT + OUT_MS * 0.6); // donde en un bucle ya se habría borrado la estela
    expect(Math.min(...h.vis('trail-diag')), 'no se borra').toBeGreaterThan(0);
    goto(IN_DONE + 200);
    expect(h.vis().every((v) => v === 1)).toBe(true);
    goto(2300);
    expect(h.vis().every((v) => v === 1)).toBe(true);
    expect(h.mark.style.transform).toBe('');
    goto(2400 + 500); // el 3D, a la hora de siempre
    expect(h.mark.style.transform).not.toBe('');
    expect(h.masks()).toBe(0);
  });

  it('con "reducir movimiento" no hay barrido: el logo entero, sin máscaras, quieto y sin pedir cuadros', () => {
    reduced = true;
    const h = setupHero();
    startHero(h);
    expect(queue.length).toBe(0);
    expect(h.wrap.hasAttribute('data-shown')).toBe(true);
    expect(h.vis().every((v) => v === 1)).toBe(true);
    expect(h.masks()).toBe(0);
  });

  it('si se activa "reducir movimiento" en pleno barrido, el logo queda entero a la vista', () => {
    const { h, goto } = afterBoot();
    goto(OUT_AT + 300);
    expect(h.vis().some((v) => v < 1)).toBe(true); // a medio borrar
    reduced = true;
    mqListener!();
    expect(h.vis().every((v) => v === 1)).toBe(true);
    expect(h.masks()).toBe(0);
  });

  it('se pausa fuera de pantalla y al volver sigue en su sitio del barrido (la hora es la del reloj, no la de los cuadros)', () => {
    const { h, goto } = afterBoot();
    const away = tFront(40);
    goto(away); // a medio aparecer
    expect(h.vis().some((v) => v < 1)).toBe(true);
    io!([{ isIntersecting: false }]);
    pump(1); // el cuadro que ya estaba pedido llega y no pide otro
    expect(queue.length).toBe(0);
    clock += PERIOD_MS + OUT_DONE + 20 - away - 20; // pasa un buen rato fuera de pantalla: al volver ya tocaría estar en el respiro del segundo bucle
    io!([{ isIntersecting: true }]);
    pump(1);
    expect(h.vis().every((v) => v === 0)).toBe(true);
  });

  it('al desmontar deja el logo entero y con sus máscaras (si se vuelve a montar, parte de cero), y el contenedor sin data-shown', () => {
    const { h, stop, goto } = afterBoot();
    goto(OUT_AT + 300);
    stop();
    expect(h.vis().every((v) => v === 1)).toBe(true);
    expect(h.masks()).toBeGreaterThan(3);
    expect(h.wrap.hasAttribute('data-shown')).toBe(false);
  });
});
