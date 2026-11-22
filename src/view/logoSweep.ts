/* ============================================================
 * Barrido del logo: ML APARECE con un barrido y se BORRA con otro que arranca ANTES de que el primero termine, y vuelve a empezar: así es
 * intermitente y fluido, como la señal de un monitor de signos vitales que va y viene. Los dos barridos siguen los trazos del logo en el mismo
 * orden: arrancan en la estela (en la punta de su diagonal de sombra), suben por ella a la esquina, corren por su pie hasta la pata de la
 * M, suben por la pata, bajan por la primera diagonal, suben por la segunda, caen por el palo de la L y corren por su pie hasta la punta.
 * Al aparecer, lo primero en verse es la estela y lo último la punta de la L; al borrarse, igual: la estela se apaga primero.
 *
 * Cómo se hace: el logo entero (`.logo__ml`) lleva una máscara (Logo.tsx, prop `sweep`) hecha con copias de sus formas, cada una rellena con
 * un degradado a lo largo de su eje; la opacidad de las paradas de ese degradado es lo que se ve del logo en cada punto del recorrido. Y
 * sobre cada forma va otra copia, clara, con la luz del borde del barrido (más viva justo en el frente y que se apaga detrás). Aquí se calcula
 * cuánto se ve y cuánta luz hay en cada punto en cada instante, y `startSweep` lo escribe en las paradas (`stop-opacity`) cuadro a cuadro.
 * Las formas se miden todas con la misma regla (longitud de arco desde la punta de la estela), así el barrido cruza de una a otra sin costuras.
 *
 * Lo mueve `startSweep` en bucle (el banner de carga) o la escena del logo del inicio (view/logoScene.ts, con `createSweep`: aparece, se
 * mantiene y se borra mientras el logo es plano, y al empezar el 3D se sueltan las máscaras).
 *
 * Sin React ni DOM en la geometría y en la cronología (las prueba logo-sweep.test.ts); solo `createSweep` y `startSweep` tocan el DOM.
 * ============================================================ */
import { prefersReducedMotion } from './motion';
import { BASE_Y, CORNER_X, DIAG_LEN, LEG, onDiag, type Pt } from './logoTrail';

export type SegId = 'trail-diag' | 'trail-foot' | 'leg' | 'diag-left' | 'diag-right' | 'stem' | 'foot';
/** El color de la luz del frente de cada parte: lila en la estela y en la M, celeste claro en la L. */
export type Tone = 'trail' | 'm' | 'l';

export interface Segment {
  id: SegId;
  tone: Tone;
  /** Eje del trazo en el sentido en que lo recorre el barrido, del punto `a` al `b`. */
  a: Pt;
  b: Pt;
  /** Longitud de arco, desde la punta de la estela, a la que empieza el tramo, y su largo. */
  s0: number;
  len: number;
}

const dist = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1]);

/** Centros de la primera pata y del palo de la L, valle de la M y punta de la L. */
const LEG_CX = LEG / 2;
const STEM_CX = 91.5;
const VALLEY: Pt = [50, 73];
const L_TIP_X = 146;

/** Los tramos, en el orden del recorrido. Cada uno arranca donde acaba el anterior (el barrido no se salta nada ni vuelve atrás). */
export const SEGMENTS: readonly Segment[] = (() => {
  // [id, tono, a, b, largo que se cruza para pasar del eje anterior a este]
  const spec: [SegId, Tone, Pt, Pt, number][] = [
    ['trail-diag', 'trail', onDiag(DIAG_LEN, 0), onDiag(0, 0), 0], // de la punta de la estela a la esquina
    ['trail-foot', 'trail', [CORNER_X, BASE_Y], [LEG, BASE_Y], 0], // por el pie de la estela, hasta el borde de la pata
    ['leg', 'm', [LEG_CX, BASE_Y], [LEG_CX, 0], LEG_CX], // cruza media pata (8,5) y sube por ella
    ['diag-left', 'm', [LEG_CX, 0], VALLEY, 0], // baja por la primera diagonal de la M, al valle
    ['diag-right', 'm', VALLEY, [STEM_CX, 0], 0], // sube por la segunda, a la cima
    ['stem', 'l', [STEM_CX, 0], [STEM_CX, BASE_Y], 0], // cae por el palo de la L (el hueco de arriba, hasta que empieza, no tiene forma: pasa de largo)
    ['foot', 'l', [STEM_CX, BASE_Y], [L_TIP_X, BASE_Y], 0], // y corre por su pie hasta la punta
  ];
  let s = 0;
  return spec.map(([id, tone, a, b, cross]) => {
    s += cross;
    const seg: Segment = { id, tone, a, b, s0: s, len: dist(a, b) };
    s += seg.len;
    return seg;
  });
})();

/** Largo total del recorrido. */
export const PATH_LENGTH = SEGMENTS.at(-1)!.s0 + SEGMENTS.at(-1)!.len;

/** Los polígonos de las formas de la M y de la L (los mismos del dibujo de Logo.tsx). La estela usa los de sus líneas. */
export const SHAPES: Readonly<Record<'leg' | 'diag-left' | 'diag-right' | 'stem' | 'foot', string>> = {
  leg: '0,0 17,29.9 17,100 0,100',
  'diag-left': '0,0 17,0 50,58 50,87.9',
  'diag-right': '50,58 83,0 100,0 50,87.9',
  stem: '83,42 100,12.1 100,83 83,100',
  foot: '83,100 100,83 146,83 146,100',
};

/**
 * Cuánto se agrandan las copias de las máscaras (a cada lado). La del dibujo va casi pegada a las formas, lo justo para no cortar los filos
 * (`MASK_GROW`): agrandarla de más filtra la visibilidad de un tramo al vecino. Los resplandores, en cambio, se salen de sus formas lo que
 * alcanza su desenfoque (el de la L, 4,2 × ~3) y llevan su propia máscara, más ancha (`GLOW_GROW`), que solo los gobierna a ellos.
 */
export const MASK_GROW = 1.5;
export const GLOW_GROW = 10;

// ---------------------------------------------------------------- el barrido en el tiempo

/**
 * Cronología de un ciclo (ms desde el comienzo del periodo). El barrido de aparición ARRANCA en `IN_AT` y dura `IN_MS`; el de borrado arranca en
 * `OUT_AT`, que cae ANTES de que el de aparición termine (`IN_AT + IN_MS`): cuando el frente de aparición cruza el último tramo, el borrado
 * ya se ha llevado la punta de la estela. No hay un rato quieto con el logo entero: el logo se forma y se deshace en un solo movimiento seguido.
 * Los dos frentes ACELERAN (empiezan suaves y salen rápidos, como un barrido de verdad: `EASE_POW`), y el borrado es algo más lento que la
 * aparición: el logo entra con decisión y se deshace con calma. `PERIOD_MS` deja al final un respiro corto con todo apagado.
 */
export const IN_AT = 100;
export const IN_MS = 800;
export const OUT_AT = 600;
export const OUT_MS = 1000;
export const PERIOD_MS = 1900;
/** Potencia de la aceleración de los frentes: la posición crece con `(t / duración) ** EASE_POW`. */
export const EASE_POW = 1.7;
/** Ancho del borde del barrido: cuánto tarda un punto en pasar de oculto a visible (unidades del dibujo). Un borde con algo de caída, no un corte. */
export const EDGE = 18;
/** Cuánto antes del frente ya sube la luz, y cómo se apaga detrás de él: un núcleo vivo y corto (`CORE`, `CORE_W` de la luz en el frente) y una cola suave. */
export const LEAD = 10;
export const CORE = 22;
export const CORE_W = 0.55;
export const DECAY = 70;
/** Fuerza máxima de la luz del frente (opacidad de la copia clara) en cada tono. */
export const PEAK: Readonly<Record<Tone, number>> = { trail: 0.9, m: 0.8, l: 0.85 };
/** Los colores de la luz: lila en la estela y en la M (sobre el cromo se lee como un baño violeta) y celeste claro en la L. */
export const TONE_COLOR: Readonly<Record<Tone, string>> = { trail: '#d9c2ff', m: '#cdb0ff', l: '#d6fdff' };

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Cuándo termina de aparecer (el frente ya pasó el último tramo) y cuándo termina de borrarse (ms). */
export const IN_DONE = IN_AT + IN_MS;
export const OUT_DONE = OUT_AT + OUT_MS;
/**
 * Recorrido del frente: arranca antes del comienzo (con la luz y el borde aún fuera del logo: `FRONT_START`) y llega hasta `TRAVEL`, desde donde
 * el último punto ya es del todo visible (o del todo borrado). Después sigue de largo: la luz se apaga sola al irse el frente.
 */
export const FRONT_START = -(LEAD + EDGE);
export const TRAVEL = PATH_LENGTH + EDGE;
/** Posición del frente (longitud de arco) de un barrido que arrancó en `t0` y dura `ms`, a los `t` ms del periodo. Antes de arrancar está fuera, antes del comienzo. */
export const frontAt = (t: number, t0: number, ms: number) => FRONT_START + (TRAVEL - FRONT_START) * (t <= t0 ? 0 : ((t - t0) / ms) ** EASE_POW);
const frontIn = (t: number) => frontAt(t, IN_AT, IN_MS);
const frontOut = (t: number) => frontAt(t, OUT_AT, OUT_MS);
/** Un instante con el logo entero a la vista y sin luz, pasada la aparición (`once`): lo que se muestra con "reducir movimiento" y tras la última aparición. */
export const SETTLE_T = IN_DONE + 450;

/**
 * Cuánto se ve el logo (0–1) en el punto del recorrido a longitud de arco `arc`, a los `t` ms del periodo: ya apareció y todavía no se borró.
 * Con `once` solo hay aparición (no hay borrado): la última aparición del inicio y el logo entero con "reducir movimiento".
 */
export function visibleAt(arc: number, t: number, once = false): number {
  const shown = smooth(clamp01((frontIn(t) - arc) / EDGE));
  if (once) return shown;
  const gone = smooth(clamp01((frontOut(t) - arc) / EDGE));
  return shown * (1 - gone);
}

/** La luz del frente a una distancia `d` de él hacia el lado visible (d < 0: del otro lado): sube suave justo antes del frente, es 1 en él y se apaga después. */
export function profile(d: number): number {
  if (d < -LEAD) return 0;
  if (d < 0) return smooth((d + LEAD) / LEAD);
  const v = CORE_W * Math.exp(-d / CORE) + (1 - CORE_W) * Math.exp(-d / DECAY);
  return v < 0.01 ? 0 : v;
}

/**
 * La luz (0–1) en el punto `arc` a los `t` ms: la del frente de aparición (el lado visible es el de atrás: ya apareció) más la del frente de
 * borrado (el lado visible es el de delante: todavía no se borra). Como la cola de ésta cae hacia lo que aún no se ha borrado, hasta que el
 * frente de borrado no está a punto de entrar no hay luz. Con `once` solo la de aparición.
 */
export function lightAt(arc: number, t: number, once = false): number {
  const lit = profile(frontIn(t) - arc);
  if (once) return Math.min(1, lit);
  const out = frontOut(t);
  const gate = smooth(clamp01((out - FRONT_START) / EDGE)); // el frente de borrado entra: la luz sube con él, no de golpe
  return Math.min(1, lit + gate * profile(arc - out));
}

/** Paradas de cada degradado: una cada ~4 unidades (un borde suave no se ve a trozos), al menos 12. */
export const STOP_STEP = 4;
export const stopCount = (seg: Segment) => Math.max(12, Math.ceil(seg.len / STOP_STEP) + 1);
/** Desplazamiento (0–1) de la parada `k` de un tramo y longitud de arco que le corresponde. */
export const stopOffset = (seg: Segment, k: number) => k / (stopCount(seg) - 1);
export const stopArc = (seg: Segment, k: number) => seg.s0 + stopOffset(seg, k) * seg.len;
/** Opacidad de la parada `k` del degradado de la máscara (lo que se ve del logo) y del de la luz, a los `t` ms del periodo. */
export const visOpacity = (seg: Segment, k: number, t: number, once = false) => +visibleAt(stopArc(seg, k), t, once).toFixed(3);
export const litOpacity = (seg: Segment, k: number, t: number, once = false) => +(PEAK[seg.tone] * lightAt(stopArc(seg, k), t, once)).toFixed(3);

// ---------------------------------------------------------------- el DOM

export interface Sweep {
  /** Escribe en el logo lo que se ve y la luz a los `t` ms del periodo (solo las paradas que cambian); con `once`, solo la aparición (sin borrado). */
  write: (t: number, once?: boolean) => void;
  /** Deja el logo entero a la vista y sin luz. */
  rest: () => void;
  /**
   * Lo deja entero a la vista y quita las máscaras: el logo vuelve a ser el dibujo de siempre, sin el coste de las máscaras (lo que hace falta
   * cuando se mueve en 3D). `restore` las vuelve a poner.
   */
  release: () => void;
  restore: () => void;
}

/**
 * Busca en `root` los degradados del barrido (`linearGradient[data-sweep]`: los de la máscara `vis:…` y los de la luz `lit:…`) y devuelve cómo
 * escribirlos, o `null` si el logo no lleva barrido. Escribe el atributo `stop-opacity` (no `style`, que la CSP no admite) y solo en las paradas
 * que cambian; la memoria de lo escrito parte de lo que haya en el marcado (el banner nace oculto, el inicio nace a la vista).
 */
export function createSweep(root: Element): Sweep | null {
  const bySeg = new Map(SEGMENTS.map((s) => [s.id, s]));
  const rigs = Array.from(root.querySelectorAll('linearGradient[data-sweep]'), (g) => {
    const [kind, id] = (g.getAttribute('data-sweep') ?? '').split(':');
    const seg = bySeg.get(id as SegId);
    if (!seg || (kind !== 'vis' && kind !== 'lit')) return null;
    const stops = Array.from(g.querySelectorAll('stop'));
    return { kind, seg, stops, last: stops.map((st) => Number(st.getAttribute('stop-opacity')) || 0) };
  }).filter((r) => r !== null);
  if (!rigs.length) return null;

  const write = (t: number, once = false) => {
    for (const r of rigs) {
      r.stops.forEach((stop, k) => {
        const v = r.kind === 'vis' ? visOpacity(r.seg, k, t, once) : litOpacity(r.seg, k, t, once);
        if (r.last[k] === v) return;
        r.last[k] = v;
        stop.setAttribute('stop-opacity', String(v));
      });
    }
  };
  const masked = Array.from(root.querySelectorAll('[mask]'), (el) => ({ el, value: el.getAttribute('mask')! }));
  return {
    write,
    rest: () => write(SETTLE_T, true),
    release: () => { write(SETTLE_T, true); for (const m of masked) m.el.removeAttribute('mask'); },
    restore: () => { for (const m of masked) m.el.setAttribute('mask', m.value); write(SETTLE_T, true); },
  };
}

/**
 * Anima el barrido en bucle en el logo que hay dentro de `root` (el del banner de carga). En el respiro, con todo apagado, no escribe nada.
 * Con "reducir movimiento" no hay barrido: deja el logo entero a la vista, quieto. Devuelve la función que lo detiene.
 */
export function startSweep(root: Element): () => void {
  const sweep = createSweep(root);
  if (!sweep) return () => {};
  if (prefersReducedMotion()) {
    sweep.rest();
    return () => {};
  }

  const t0 = performance.now();
  let raf = 0;
  let alive = true;
  const frame = (now: number) => {
    raf = 0;
    if (!alive) return; // un cuadro ya pedido que llega después de detenerlo no debe escribir ni pedir otro
    sweep.write((((now - t0) % PERIOD_MS) + PERIOD_MS) % PERIOD_MS);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}
