/* ============================================================
 * Estela de la marca: geometría pura. La primera pata de la M hace de palo de OTRA L, sombra de la que forman la última pata
 * y su pie. El pie de esa L ES la propia pata prolongada: al salir de ella es del mismo color, igual de opaco y del alto del pie
 * real (y 83–100); desde ahí se afina en vetas que pasan al violeta del logotipo.
 *
 * Al final del pie la estela GIRA con un corte seco (una esquina viva, sin curva) y sigue por una DIAGONAL de sombra paralela a la
 * segunda diagonal de la M, pero hacia ABAJO: la de la M sube; esta baja, cruza el renglón de la base (y = 100) y sobresale del
 * lienzo hacia el vacío, apagándose y acabando en punta, como una estela. Pie y diagonal forman la panza baja de una B, sombra de
 * la diagonal de la M, y junto con la parte de arriba de la M dan LB. El tamaño del logo no cambia: lo que se sale del lienzo se ve
 * porque el SVG deja el desbordamiento visible (`.logo__svg` en globals.css).
 *
 * ES UNA SOMBRA: oscura, sin brillos blancos; el violeta del logotipo se oscurece a lo largo de la diagonal hacia un violeta profundo.
 * Y el lila entra en la pata: sobre su parte de abajo hay un velo violeta (`LEG_TINT`) que se mezcla con ella, y las líneas arrancan
 * con ese mismo color, así la unión no se ve.
 *
 * UN SOLO DEGRADADO. El color y la opacidad empiezan en la pata (ya teñida, a plena opacidad) y siguen sin cortes por el pie y por la
 * diagonal: pata → violeta del logotipo → meseta en la esquina → violeta profundo y apagado suave hasta la punta. Un degradado lineal
 * no dobla, así que cada línea se parte en dos piezas por la bisectriz de la esquina, cada una con su vector (horizontal el pie, a lo
 * largo de la diagonal la otra); como a ambos lados del corte el valor es el mismo (la meseta), no se nota la unión.
 *
 * Profundidad: cada línea vive a su propia distancia `z` del plano de la marca (z > 0 hacia el espectador). La marca se inclina
 * con CSS, pero todo lo que dibuja está en su plano; `trailParallax` da el desplazamiento que tendría cada línea si de verdad
 * estuviera a esa distancia, y la escena aplica el horizontal a cada cuadro: las líneas se deslizan unas sobre otras.
 *
 * Sin React ni DOM: la dibuja Logo.tsx y la prueba logo-mark.test.ts.
 * ============================================================ */

export type Pt = readonly [number, number];
export interface Stop { offset: number; color: string; opacity: number }
export interface Gradient { x1: number; y1: number; x2: number; y2: number; stops: Stop[] }

export const LEG = 17; // borde derecho de la primera pata de la M
export const START = 11; // dónde arranca cada línea, dentro de la pata (allí es del color de la pata: no se nota)

/** Altura del pie de la L (y 83–100): la del pie de la estela sobre la base. */
export const FOOT_TOP = 83;
export const FOOT_BOTTOM = 100;
export const BASE_Y = (FOOT_TOP + FOOT_BOTTOM) / 2;
export const HALF = (FOOT_BOTTOM - FOOT_TOP) / 2;

/** Redondeo para el marcado: sin ceros de más. */
export const f = (n: number) => String(+n.toFixed(2));
/** Suavizado (0 → 0 y 1 → 1, con pendiente nula en los extremos): nada arranca ni frena de golpe. */
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const pts = (list: readonly Pt[]) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

const rgbOf = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));
export const mixHex = (a: string, b: string, k: number) => {
  const [x, y] = [rgbOf(a), rgbOf(b)];
  return `#${x.map((c, i) => Math.round(c + (y[i] - c) * k).toString(16).padStart(2, '0')).join('')}`;
};

// ---------------------------------------------------------------- colores

/** El violeta del logotipo: el del medio de los arcos de la escena (`logoScene.VIOLET`, [138, 60, 255]) y `--violet` del CSS. */
export const VIOLET = '#8a3cff';
/** El violeta del logotipo oscurecido a la mitad: lo que queda de la sombra al final de la diagonal. */
export const VIOLET_DEEP = '#451e80';

/**
 * Degradado de la pata (de arriba abajo): lo usa el dibujo y el arranque de la estela, para que el color coincida. Es cromo: claro
 * arriba, un horizonte oscuro bien marcado hacia el 50 % y un reflejo más claro abajo.
 */
export const LEG_STOPS: readonly (readonly [number, string])[] = [
  [0, '#f8fafd'], [0.14, '#dfe5ee'], [0.38, '#97a4b8'], [0.5, '#3a4458'], [0.56, '#6c7890'], [0.78, '#b9c4d4'], [1, '#8693a8'],
];

/** Color de la pata a una altura y (0–100): interpola LEG_STOPS. */
export function legTone(y: number): string {
  const t = clamp01(y / 100);
  let i = 0;
  while (i < LEG_STOPS.length - 2 && t > LEG_STOPS[i + 1][0]) i++;
  const [t0, c0] = LEG_STOPS[i], [t1, c1] = LEG_STOPS[i + 1];
  return mixHex(c0, c1, (t - t0) / (t1 - t0));
}

/** Cuánto del violeta del logotipo se mezcla con la pata en el arranque de la estela (la pata se tiñe y las líneas salen de ese color). */
export const JUNCTION_TINT = 0.5;
/** Color de la pata ya teñida a una altura y: el de arranque de cada línea. */
export const tintedLeg = (y: number) => mixHex(legTone(y), VIOLET, JUNCTION_TINT);

/**
 * Velo violeta sobre la parte de abajo de la pata (radial, centrado donde sale el pie): el degradado de la estela entra en la pata y se
 * mezcla con ella. Es una meseta de JUNCTION_TINT junto a la unión (así las líneas, que arrancan de ese color, no se distinguen) y se
 * apaga hacia arriba y hacia la izquierda. Solo cubre la pata: se dibuja con su propia forma.
 */
export const LEG_TINT: { cx: number; cy: number; r: number; stops: Stop[] } = {
  cx: LEG, cy: BASE_Y, r: 56,
  stops: [
    { offset: 0, color: VIOLET, opacity: JUNCTION_TINT }, { offset: 0.14, color: VIOLET, opacity: JUNCTION_TINT },
    { offset: 0.5, color: VIOLET, opacity: 0.2 }, { offset: 1, color: VIOLET, opacity: 0 },
  ],
};

// ---------------------------------------------------------------- el eje: recto sobre la base → esquina viva → recto hacia abajo

/** Segunda diagonal de la M: pasa por (50, 87.9) y (100, 0); `d` sube hacia la derecha. La sombra tiene su inclinación, pero BAJA. */
export const DIAG = (() => {
  const l = Math.hypot(50, 87.9);
  return { p: [50, 87.9] as Pt, d: [50 / l, -87.9 / l] as Pt };
})();
/** Cuánto se corre en x (hacia la izquierda, al bajar) por cada unidad de y: la pendiente de la diagonal. */
export const SLOPE = DIAG.d[0] / -DIAG.d[1];

/** Rumbo de la diagonal de sombra (baja hacia la izquierda) y normales a la derecha del avance en la base (N1) y en la diagonal (N2). */
export const H2: Pt = [-DIAG.d[0], -DIAG.d[1]];
const N1: Pt = [0, 1];
const N2: Pt = [-H2[1], H2[0]];
/** Vector que lleva del vértice del eje al de la esquina de una línea desplazada `o`: la esquina viva (inglete) de dos rectas paralelas al eje. */
const MIT: Pt = (() => {
  const k = 1 + N1[0] * N2[0] + N1[1] * N2[1];
  return [(N1[0] + N2[0]) / k, (N1[1] + N2[1]) / k];
})();

/** Dónde está la esquina del eje (x sobre la base) y a cuánto largo del arranque queda. */
export const CORNER_X = 61;
export const A1 = CORNER_X - START;

/** Esquina viva de una línea desplazada `o` (positivo = hacia abajo): sobre la bisectriz que pasa por el vértice del eje. */
export const mitre = (o: number): Pt => [CORNER_X + o * MIT[0], BASE_Y + o * MIT[1]];
/** Punto de la base, a `sigma` del arranque y desplazado `o`. */
export const onFoot = (sigma: number, o = 0): Pt => [START + sigma, BASE_Y + o];
/** Punto de la diagonal de sombra, a `t` del vértice del eje (a lo largo de la diagonal) y desplazado `o`. */
export const onDiag = (t: number, o = 0): Pt => [CORNER_X + o * N2[0] + t * H2[0], BASE_Y + o * N2[1] + t * H2[1]];

/** Dónde dejan de ser macizas las líneas (x = 21) y dónde ya tienen su grosor final (x = 46). */
export const SOLID_S = 10;
export const NARROW_S = 35;
/** Hasta aquí el pie conserva el violeta pleno en la diagonal; desde ahí se apaga. Y dónde acaba el degradado de la pata al violeta sobre la base. */
export const PLATEAU_T = 16;
export const VIOLET_S = 24;
/** Opacidad de la meseta (la misma a los dos lados de la esquina): una sombra, no un neón. */
export const PLATEAU = 0.85;

export interface TrailLine {
  /** Centro de la franja de la línea en el borde de la pata (y). */
  y: number;
  /** Alto de su franja en el borde de la pata: las franjas, una sobre otra, cubren todo el pie. */
  pitch: number;
  /** Grosor final, ya afinada (menor que `pitch`: la diferencia son las rendijas). */
  h: number;
  /** Largo de la parte que baja por la diagonal, desde el vértice del eje: acaba en punta allí. */
  len2: number;
  /** Distancia al plano de la marca. */
  z: number;
  /** Trazos con que se disuelve después de su punta. */
  dashes: number;
}

/** Franjas del pie, de arriba abajo: suman exactamente su alto (17). `RATIO` es cuánto de su franja conserva al afinarse. */
const PITCH = [1.7, 2.1, 1.6, 2.3, 1.8, 2.2, 1.6, 2.0, 1.7];
const RATIO = [0.55, 0.75, 0.5, 0.8, 0.55, 0.75, 0.5, 0.7, 0.55];
/** Hasta dónde baja cada una: acaban escalonadas, en punta, entre 40 y 62 del vértice (y ≈ 126–145: bajo el renglón). */
const LEN2 = [58, 44, 52, 62, 48, 56, 40, 60, 50];
/** z alterna delante y detrás del plano. */
const DEPTH = [-4, 8, -9, 12, -6, 11, -8, 6, -3];
const DASHES = [3, 2, 1, 3, 2, 3, 1, 2, 3];

export const TRAIL: readonly TrailLine[] = (() => {
  let top = FOOT_TOP;
  return PITCH.map((pitch, i) => {
    const line: TrailLine = { y: +(top + pitch / 2).toFixed(2), pitch, h: +(pitch * RATIO[i]).toFixed(2), len2: LEN2[i], z: DEPTH[i], dashes: DASHES[i] };
    top += pitch;
    return line;
  });
})();

const offsetOf = (l: TrailLine) => l.y - BASE_Y;

/** Mitad del grosor de una línea sobre la base, a `sigma` del arranque: su franja entera mientras es maciza, su grosor final al afinarse. */
export function halfThickness(l: TrailLine, sigma: number): number {
  const t = clamp01((sigma - SOLID_S) / (NARROW_S - SOLID_S));
  return (l.pitch / 2) * (1 - t) + (l.h / 2) * t;
}

/** Hasta dónde mantiene su grosor sobre la diagonal y desde ahí se afila hasta la punta. */
const taperFrom = (l: TrailLine) => l.len2 * 0.45;
/** Mitad del grosor sobre la diagonal a `t` del vértice: el final, afilándose hasta casi nada en la punta. */
export function halfThickness2(l: TrailLine, t: number): number {
  const u = clamp01((t - taperFrom(l)) / (l.len2 - taperFrom(l)));
  return (l.h / 2) * (1 - 0.85 * smooth(u));
}

// ---------------------------------------------------------------- las dos piezas de cada línea

/**
 * Pieza de la base de una línea: su franja completa desde dentro de la pata hasta SOLID_S (maciza, como la pata), luego se afina
 * hasta su grosor final en NARROW_S y sigue así hasta la esquina viva, donde se corta por la bisectriz.
 */
export function trailFootPiece(l: TrailLine): string {
  const o = offsetOf(l), top = o - halfThickness(l, NARROW_S), bottom = o + halfThickness(l, NARROW_S);
  return pts([
    onFoot(0, o - l.pitch / 2), onFoot(SOLID_S, o - l.pitch / 2), onFoot(NARROW_S, top), mitre(top),
    mitre(bottom), onFoot(NARROW_S, bottom), onFoot(SOLID_S, o + l.pitch / 2), onFoot(0, o + l.pitch / 2),
  ]);
}

/** Pieza que baja por la diagonal: desde la bisectriz de la esquina hasta una punta, afilándose. */
export function trailDiagPiece(l: TrailLine): string {
  const o = offsetOf(l), h = l.h / 2;
  const t0 = taperFrom(l), mid = (t0 + l.len2) / 2;
  return pts([
    mitre(o - h), onDiag(t0, o - halfThickness2(l, t0)), onDiag(mid, o - halfThickness2(l, mid)), onDiag(l.len2, o),
    onDiag(mid, o + halfThickness2(l, mid)), onDiag(t0, o + halfThickness2(l, t0)), mitre(o + h),
  ]);
}

export interface Dash { x1: number; y1: number; x2: number; y2: number; w: number; o: number }
/** Dónde caen los trazos del polvo (distancia a la punta de la línea: desde, hasta, opacidad): cada vez más cortos y más tenues. */
const DUST: readonly (readonly [number, number, number])[] = [[2, 5.5, 0.7], [7.5, 9, 0.4], [11, 12.2, 0.26]];
/** Trazos con que se disuelve cada línea después de su punta: cada vez más cortos y tenues, siguiendo la diagonal. */
export function trailDashes(l: TrailLine): Dash[] {
  const spans = l.dashes === 1 ? [[2, 5, 0.6]] : DUST.slice(0, l.dashes);
  const o = offsetOf(l);
  return spans.map(([a, b, op]) => {
    const [x1, y1] = onDiag(l.len2 + a, o), [x2, y2] = onDiag(l.len2 + b, o);
    return { x1, y1, x2, y2, w: Math.max(0.5, l.h * 0.4), o: op };
  });
}

// ---------------------------------------------------------------- el destello que corre por cada línea

/** Dónde arranca el destello (el borde de la pata: sale de ella) y cuánto pasa de la punta de la línea (el polvo en que se disuelve). */
export const FLOW_X0 = LEG;
export const FLOW_OVER = 9;

/**
 * Eje de una línea, de la pata a más allá de su punta: recto por la base, esquina viva (la misma de la línea) y recto por la diagonal.
 * Por aquí corre el destello de la estela (`logo__flow`, en el banner de carga): un trazo corto y claro que va y viene por cada línea.
 */
export function trailFlowPath(l: TrailLine): string {
  const o = offsetOf(l);
  return ['M', onFoot(FLOW_X0 - START, o), 'L', mitre(o), 'L', onDiag(l.len2 + FLOW_OVER, o)]
    .map((part) => (typeof part === 'string' ? part : `${f(part[0])} ${f(part[1])}`)).join('');
}

// ---------------------------------------------------------------- UN solo degradado, partido en dos vectores

/**
 * Valor del degradado único de una línea en la posición `p` a lo largo de la estela (p < A1: sobre la base, a `p` del arranque;
 * p ≥ A1: sobre la diagonal, a `p − A1` del vértice del eje):
 *  1. hasta SOLID_S + 2 es la pata ya teñida a esa altura, a plena opacidad (sin costura);
 *  2. de ahí pasa al violeta del logotipo hasta VIOLET_S con una curva suave;
 *  3. meseta de violeta (opacidad PLATEAU) hasta la esquina y PLATEAU_T más allá: aquí cae la unión de las dos piezas, y por eso
 *     el valor es el mismo a ambos lados del corte;
 *  4. el violeta se oscurece hacia VIOLET_DEEP y se apaga con la misma curva hasta no ser nada en la punta (`len2`).
 */
export function trailColorAt(l: TrailLine, p: number): { color: string; opacity: number } {
  const leg = tintedLeg(l.y);
  const full = SOLID_S + 2;
  if (p <= full) return { color: leg, opacity: 1 };
  if (p <= VIOLET_S) {
    const k = smooth((p - full) / (VIOLET_S - full));
    return { color: mixHex(leg, VIOLET, k), opacity: +(1 - (1 - PLATEAU) * k).toFixed(3) };
  }
  const t = p - A1;
  if (t <= PLATEAU_T) return { color: VIOLET, opacity: PLATEAU };
  const u = clamp01((t - PLATEAU_T) / (l.len2 - PLATEAU_T));
  return { color: mixHex(VIOLET, VIOLET_DEEP, smooth(clamp01(u * 1.15))), opacity: +(PLATEAU * (1 - smooth(u))).toFixed(3) };
}

/** Degradado de la pieza de la base de una línea: horizontal, de la pata a la esquina. */
export function footGradient(l: TrailLine): Gradient {
  const full = SOLID_S + 2, n = 6;
  const ps = [0, full, ...Array.from({ length: n }, (_, i) => full + ((VIOLET_S - full) * (i + 1)) / n), A1];
  const [x1, y1] = onFoot(0, offsetOf(l)), [x2, y2] = onFoot(A1, offsetOf(l));
  return { x1, y1, x2, y2, stops: ps.map((p) => ({ offset: +(p / A1).toFixed(4), ...trailColorAt(l, p) })) };
}

/**
 * Degradado de la pieza que baja: a lo largo de la diagonal, desde el vértice del eje. Es el mismo para todas las líneas (a partir de
 * la esquina todas son violeta), así que se comparte. Para los puntos que quedan antes del vértice (el lado de afuera de la esquina)
 * el degradado se extiende con su primer valor: la meseta.
 */
export const DIAG_LEN = Math.max(...LEN2);
export function diagGradient(): Gradient {
  const [x1, y1] = onDiag(0), [x2, y2] = onDiag(DIAG_LEN);
  const n = 6, ref = TRAIL[0];
  const ts = [0, PLATEAU_T, ...Array.from({ length: n }, (_, i) => PLATEAU_T + ((DIAG_LEN - PLATEAU_T) * (i + 1)) / n)];
  const lineFor = { ...ref, len2: DIAG_LEN };
  return { x1, y1, x2, y2, stops: ts.map((t) => ({ offset: +(t / DIAG_LEN).toFixed(4), ...trailColorAt(lineFor, A1 + t) })) };
}

// ---------------------------------------------------------------- fondo translúcido y resplandor (siguen la esquina y la diagonal)

/** Largo de la diagonal que cubren el fondo translúcido y el resplandor. */
export const BAND_T = 62;
export const GLOW_T = 50;
export const FOOT_X0 = 15; // el fondo empieza apenas dentro de la pata, donde no se ve
export const GLOW_X0 = 32; // el resplandor empieza lejos de la pata

/** Contorno de una banda de semiancho `half` que corre por la base desde `x0`, gira en la esquina viva y baja `len` por la diagonal. */
function ribbon(x0: number, half: number, len: number): string {
  return pts([[x0, BASE_Y - half], mitre(-half), onDiag(len, -half), onDiag(len, half), mitre(half), [x0, BASE_Y + half]]);
}
/** El pie de la L sombra, de fondo: una banda translúcida con los bordes nítidos del pie real, que gira y baja con la estela. */
export const trailFoot = () => ribbon(FOOT_X0, HALF, BAND_T);
/** Resplandor violeta difuso detrás de las líneas. */
export const trailGlow = () => ribbon(GLOW_X0, HALF - 1, GLOW_T);

/**
 * Las dos bandas con que la máscara del barrido cubre la estela entera (las rendijas entre las líneas y el polvo también se ven): una sobre el
 * pie, de la pata a un poco más allá de la esquina más lejana de las líneas, y otra sobre la diagonal, desde antes del vértice del eje hasta
 * más allá del polvo más lejano (FLOW_OVER de la punta de la línea más larga, y el trazo del polvo).
 */
export const trailMaskFoot = () => pts([[START, FOOT_TOP - 1], [CORNER_X + 15, FOOT_TOP - 1], [CORNER_X + 15, FOOT_BOTTOM + 1], [START, FOOT_BOTTOM + 1]]);
export const trailMaskDiag = () => pts([onDiag(-16, -HALF - 1), onDiag(DIAG_LEN + 14, -HALF - 1), onDiag(DIAG_LEN + 14, HALF + 1), onDiag(-16, HALF + 1)]);

/** Degradado de la banda de fondo y del resplandor: meseta hasta la esquina y se apaga, oscureciéndose, a lo largo de la diagonal. */
export function bandGradient(opacity: number, len: number): Gradient {
  const [x1, y1] = onDiag(0), [x2, y2] = onDiag(len);
  const hold = PLATEAU_T * 0.6;
  const ts = [0, hold, ...[0.35, 0.55, 0.75, 1].map((k) => hold + (len - hold) * k)];
  const stops = ts.map((t, i) => {
    const u = i < 2 ? 0 : clamp01((t - hold) / (len - hold));
    return { offset: +(t / len).toFixed(4), color: mixHex(VIOLET, VIOLET_DEEP, u), opacity: +(opacity * (1 - smooth(u))).toFixed(3) };
  });
  return { x1, y1, x2, y2, stops };
}

/**
 * Cuánto se desplaza en pantalla, dentro del plano de la marca, algo que está a distancia `z` del plano (en unidades del dibujo)
 * cuando la marca se inclina con `rotateY(a) rotateX(b)` (grados, como la CSS). Exacto salvo la perspectiva:
 * un punto (0, 0, z) pasa a (z·cos b·sin a, −z·sin b); un desplazamiento en el plano (dx, dy) pasa a
 * (dx·cos a + dy·sin a·sin b, dy·cos b). Se despeja (dx, dy) para que ambos coincidan.
 */
export function trailParallax(m: { a: number; b: number }, z: number): { dx: number; dy: number } {
  const a = (m.a * Math.PI) / 180, b = (m.b * Math.PI) / 180;
  return { dx: (z * Math.tan(a)) / Math.cos(b), dy: -z * Math.tan(b) };
}
