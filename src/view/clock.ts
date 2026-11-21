/* VISTA — Matemáticas del "reloj" del diagrama de la sección "Tecnología pensada desde su negocio".
 * Sin DOM, para poder probarlas: el progreso según el scroll, el seguimiento suave de ese progreso y el punto de la
 * elipse por la que avanzan las agujas. */

const TAU = Math.PI * 2;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Dónde queda el borde superior de la figura cuando empieza a entrar (fracción del alto de la pantalla). */
const ENTER_AT = 0.95;
/** Dónde queda el centro de la figura cuando el reloj se completa: lo bastante abajo para verla entera y no cortada. */
const DONE_AT = 0.58;

/**
 * Avance del barrido (0..1) según dónde está la figura: 0 cuando asoma por abajo de la pantalla y 1 cuando su centro
 * llega a `DONE_AT` del alto. Es lineal con el scroll, así que el reloj avanza y retrocede con la rueda.
 * `top` y `height` son los de la figura (getBoundingClientRect) y `vh` el alto de la ventana.
 */
export function scrollProgress(top: number, height: number, vh: number): number {
  const start = vh * ENTER_AT;
  const end = vh * DONE_AT - height / 2;
  return clamp01((start - top) / (start - end));
}

/** Fracción de la figura (0..1) que está dentro de la ventana. */
export function visibleFraction(top: number, height: number, vh: number): number {
  if (height <= 0) return 0;
  return clamp01((Math.min(top + height, vh) - Math.max(top, 0)) / height);
}

/**
 * Acerca `current` a `target` con suavizado, sin pasar de `vmax` por segundo. Así el reloj sigue al scroll con un
 * poco de inercia y, si se llega de golpe (un ancla, recargar con scroll), igual da la vuelta completa en vez de saltar.
 */
export function chase(current: number, target: number, dt: number, vmax: number, rate = 7): number {
  const diff = target - current;
  if (Math.abs(diff) < 0.002) return target;
  const lim = vmax * dt;
  const step = Math.max(-lim, Math.min(lim, diff * Math.min(1, rate * dt)));
  return current + step;
}

export interface Ellipse {
  /** Perímetro de la elipse. */
  perimeter: number;
  /** Punto (relativo al centro) tras recorrer la fracción `p` del perímetro desde las 12 en sentido horario. */
  at: (p: number) => { x: number; y: number };
}

/**
 * Elipse de semiejes `a` (horizontal) y `b` (vertical), recorrida por longitud de arco. En una elipse el ángulo no
 * avanza al mismo ritmo que el perímetro, y el borde del trazo que se va revelando sí lo hace: se usa una tabla de
 * longitudes para que la aguja quede justo en la punta del trazo.
 */
export function makeEllipse(a: number, b: number, n = 720): Ellipse {
  const len = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const t0 = ((i - 1) / n) * TAU;
    const t1 = (i / n) * TAU;
    const tm = (t0 + t1) / 2;
    len[i] = len[i - 1] + Math.hypot(a * Math.cos(tm), b * Math.sin(tm)) * (t1 - t0);
  }
  const total = len[n];
  const param = (p: number) => {
    const goal = clamp01(p) * total;
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (len[mid] <= goal) lo = mid; else hi = mid;
    }
    const f = (goal - len[lo]) / (len[hi] - len[lo] || 1);
    return ((lo + f) / n) * TAU;
  };
  return {
    perimeter: total,
    at: (p) => {
      const t = param(p);
      return { x: a * Math.sin(t), y: -b * Math.cos(t) };
    },
  };
}
