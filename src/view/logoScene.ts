/* VISTA — Escena 3D del logo del inicio: globo, aros y arcos dibujados en dos <canvas> (sin WebGL ni librerías).
 *
 * Por qué canvas y no capas CSS: un trazo SVG es una hoja sin grosor; girado de canto queda en un pelo, y apilar
 * hojas para darle cuerpo deja líneas dobles. Un tubo real, en cambio, mide lo mismo en pantalla desde cualquier
 * ángulo, así que aquí cada aro es geometría 3D que se proyecta con perspectiva y se sombrea como un cilindro.
 *
 * Profundidad: la marca ML (un SVG que se inclina por CSS) hace de plano. Lo que está detrás de ese plano se dibuja
 * en el canvas de atrás y lo que está delante en el de adelante, así los aros pasan por detrás y por delante de la
 * marca. Dentro de cada canvas, las piezas se ordenan de lejos a cerca (algoritmo del pintor).
 *
 * Convenciones: las mismas que CSS (x a la derecha, y hacia abajo, z hacia el espectador; los giros siguen
 * rotate3d()), para que el plano de la marca calculado aquí coincida con el que pinta el navegador.
 * Las medidas están en unidades del viewBox del logo (228 de ancho, origen en el centro de la capa).
 *
 * Este módulo no toca el DOM salvo `startLogoScene`. Con "reducir movimiento" se dibuja un solo cuadro en reposo. */

export type V3 = readonly [number, number, number];
export type M3 = readonly [number, number, number, number, number, number, number, number, number];
export type RGB = readonly [number, number, number];
type Ctx = CanvasRenderingContext2D;

const TAU = Math.PI * 2;
const rad = (d: number) => (d * Math.PI) / 180;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Ancho del viewBox del logo, en unidades. */
const VB = 228;
/** Perspectiva en px: la misma que `perspective` de .logo3d en el CSS (la usa la marca). */
const PERSPECTIVE_PX = 900;
/** Margen extra del canvas a cada lado, como fracción de la capa: los aros cercanos crecen por la perspectiva. */
export const CANVAS_PAD = 0.15;

// ---------------------------------------------------------------- álgebra mínima

export const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Rotación de `a` radianes alrededor de `axis` (fórmula de Rodrigues; igual que `rotate: x y z angle` de CSS). */
export function rotAxis(axis: V3, a: number): M3 {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const x = axis[0] / l, y = axis[1] / l, z = axis[2] / l;
  const c = Math.cos(a), s = Math.sin(a), k = 1 - c;
  return [
    c + x * x * k, x * y * k - z * s, x * z * k + y * s,
    y * x * k + z * s, c + y * y * k, y * z * k - x * s,
    z * x * k - y * s, z * y * k + x * s, c + z * z * k,
  ];
}

/** a · b (aplica primero b). */
export function mul(a: M3, b: M3): M3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) r.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]);
  }
  return r as unknown as M3;
}

export function apply(m: M3, v: V3): V3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

const AX_X: V3 = [1, 0, 0];
const AX_Y: V3 = [0, 1, 0];
const AX_Z: V3 = [0, 0, 1];

// ---------------------------------------------------------------- pose en el tiempo

/** Giros de la marca: grados, grados y px (los mismos que antes tenía el keyframe mark-float de 7 s). */
export interface MarkPose { a: number; b: number; ty: number }
/** `comet` (0..1): cuánto de estela fugaz tienen los arcos de colores. 0 = el dibujo de marca (arcos parejos con un punto en cada extremo). */
export interface Pose { ring: M3; dots: M3; arcA: M3; arcB: M3; globe: M3; mark: MarkPose; comet: number }

/** Eje del globo: inclinado 20° de lado y 18° hacia el espectador. */
const GLOBE_TILT = mul(rotAxis(AX_Z, rad(-20)), rotAxis(AX_X, rad(-18)));
/** Ejes (en el plano de la pantalla) sobre los que gira cada aro. Distintos, para que se crucen. */
const RING_AXIS: V3 = [0.259, -0.966, 0];
const DOTS_AXIS: V3 = [0.966, 0.259, 0];
const ARC_A_AXIS: V3 = [0.883, -0.469, 0];
const ARC_B_AXIS: V3 = [0.848, 0.53, 0];

/** Pose plana (2D): la del dibujo de marca. Aros y arcos de frente, globo solo con su inclinación, marca sin girar. */
const FLAT: Pose = { ring: I3, dots: I3, arcA: I3, arcB: I3, globe: GLOBE_TILT, mark: { a: 0, b: 0, ty: 0 }, comet: 0 };

/**
 * Cada pieza entra al movimiento en su momento y tarda lo suyo en llegar a su ritmo completo: [retardo, rampa] en
 * segundos desde que empieza la animación. Escalonado, para que la transición de 2D a 3D se aprecie pieza por pieza
 * (primero gira el globo, luego se despliegan los arcos, se inclina la marca, se voltea el anillo y al final las perlas)
 * en vez de ocurrir todo de golpe.
 */
export const STAGES = {
  globe: { delay: 0, ramp: 3 },
  arcs: { delay: 0.5, ramp: 3.6 },
  mark: { delay: 1, ramp: 3.6 },
  ring: { delay: 1.4, ramp: 3 },
  dots: { delay: 2.2, ramp: 3 },
} as const;

/** Segundos hasta que todas las piezas están a su ritmo completo. */
export const TRANSITION_S = Math.max(...Object.values(STAGES).map((st) => st.delay + st.ramp));

/**
 * Reloj de una pieza, `tau` segundos después de empezar a animar. Vale 0 hasta su retardo y su velocidad sube de 0 a 1
 * durante `ramp`: los giros arrancan acelerando en vez de saltar a velocidad completa. Después avanza un segundo por segundo.
 */
export function animClock(tau: number, ramp: number): number {
  if (tau <= 0) return 0;
  return tau < ramp ? (tau * tau) / (2 * ramp) : tau - ramp / 2;
}

/** Mezcla suavizada 0 → 1 durante `ramp`: cuánto de la inclinación de los planos y del vaivén de la marca está activo. */
export function animBlend(tau: number, ramp: number): number {
  const x = clamp01(tau / ramp);
  return x * x * (3 - 2 * x);
}

/**
 * Orientación de todo `tau` segundos después de empezar a animar. En `tau = 0` es exactamente la pose plana (el logo 2D)
 * y durante `TRANSITION_S` pasa suavemente, pieza por pieza, al movimiento completo (3D). Con `reduced` se queda siempre
 * en la pose plana.
 */
export function poseAt(tau: number, reduced: boolean): Pose {
  if (reduced || tau <= 0) return FLAT;
  const clock = (st: { delay: number; ramp: number }) => animClock(tau - st.delay, st.ramp);
  const blend = (st: { delay: number; ramp: number }) => animBlend(tau - st.delay, st.ramp);
  const sa = clock(STAGES.arcs), ka = blend(STAGES.arcs);
  const sm = clock(STAGES.mark), km = blend(STAGES.mark);
  const sr = clock(STAGES.ring);
  const sd = clock(STAGES.dots);
  const sg = clock(STAGES.globe);
  // Órbita: el plano se inclina oscilando entre dos ángulos (eje en pantalla) y el arco gira dentro de su plano.
  // `ka` lo saca del plano de la pantalla poco a poco: de 0 (plano) al ángulo de la órbita.
  const orbit = (axis: V3, mid: number, amp: number, delay: number, period: number, spin: number): M3 =>
    mul(rotAxis(axis, rad(ka * (mid - amp * Math.cos((TAU * (sa + delay)) / period)))), rotAxis(AX_Z, spin));
  const c = Math.cos((TAU * sm) / 7);
  return {
    // Anillo plateado: vuelta completa sobre un diámetro casi vertical + giro lento en su plano.
    ring: mul(rotAxis(RING_AXIS, (TAU * sr) / 22), rotAxis(AX_Z, (TAU * sr) / 28)),
    // Círculo de perlas: vuelta completa sobre un diámetro casi horizontal, en sentido contrario.
    dots: rotAxis(DOTS_AXIS, -(TAU * sd) / 30),
    arcA: orbit(ARC_A_AXIS, 56, 12, 3, 22, (TAU * sa) / 18),
    arcB: orbit(ARC_B_AXIS, 66, 10, 7, 28, -(TAU * sa) / 23),
    globe: mul(GLOBE_TILT, rotAxis(AX_Y, (TAU * sg) / 32)),
    mark: { a: -14 * c * km, b: 4 * c * km, ty: -3 * (1 - c) * km },
    // La estela crece con el despliegue de los arcos: en 2D no hay, a pleno movimiento es completa.
    comet: ka,
  };
}

/** Valor de `transform` de la marca para esa pose (lo escribe `startLogoScene` en el estilo del elemento). */
export const markTransform = (m: MarkPose) => `rotateY(${m.a.toFixed(3)}deg) rotateX(${m.b.toFixed(3)}deg) translateY(${m.ty.toFixed(3)}px)`;

// ---------------------------------------------------------------- plano de la marca

export interface Plane { n: V3; o: V3 }

/** Plano que pinta el navegador para la marca: normal y un punto, en unidades. `u` = px por unidad. */
export function markPlane(m: MarkPose, u: number): Plane {
  const r = mul(rotAxis(AX_Y, rad(m.a)), rotAxis(AX_X, rad(m.b)));
  return { n: apply(r, AX_Z), o: apply(r, [0, m.ty / u, 0]) };
}

/**
 * ¿El punto `v` (unidades, ya en el mundo) queda delante de la marca, desde el espectador?
 * Se compara con la profundidad del plano en el mismo píxel: se deshace la perspectiva sobre ese rayo.
 */
export function isFront(plane: Plane, D: number, v: V3, bias = 0.5): boolean {
  const f = D / (D - v[2]);
  const dot = plane.n[0] * v[0] * f + plane.n[1] * v[1] * f;
  const den = plane.n[2] - dot / D;
  if (Math.abs(den) < 1e-6) return v[2] > 0;
  const zp = (plane.n[0] * plane.o[0] + plane.n[1] * plane.o[1] + plane.n[2] * plane.o[2] - dot) / den;
  return v[2] > zp + bias;
}

// ---------------------------------------------------------------- color

const mixc = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const shade = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const BG: RGB = [12, 15, 30];
const WHITE: RGB = [255, 255, 255];
const NIGHT: RGB = [8, 10, 24];

/** Luz arriba a la izquierda y hacia el espectador. */
const LIGHT: V3 = (() => { const l = Math.hypot(-0.45, -0.55, 0.7); return [-0.45 / l, -0.55 / l, 0.7 / l] as const; })();
/** Misma luz proyectada a la pantalla, para desplazar el brillo hacia ese lado del tubo. */
const LIGHT_2D = (() => { const l = Math.hypot(-0.55, -0.83); return [-0.55 / l, -0.83 / l] as const; })();
/** Profundidad máxima que alcanza una pieza, en unidades (para atenuar lo lejano). */
const ZMAX = 110;

const lambert = (n: V3): number => {
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return clamp01(0.5 + 0.5 * ((n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / l));
};
const depthT = (z: number) => clamp01(0.5 + z / (2 * ZMAX));

const SILVER: (lam: number, zn: number) => RGB = (lam, zn) =>
  mixc(BG, mixc([62, 72, 92], [246, 249, 253], clamp01(0.1 + 0.95 * lam)), 0.55 + 0.45 * zn);

const RAMP: [number, RGB][] = [[0, [255, 62, 165]], [0.45, [138, 60, 255]], [1, [0, 224, 255]]];
function ramp(g: number): RGB {
  const x = clamp01(g);
  for (let i = 1; i < RAMP.length; i++) {
    if (x <= RAMP[i][0]) return mixc(RAMP[i - 1][1], RAMP[i][1], (x - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]));
  }
  return RAMP[RAMP.length - 1][1];
}

// ---------------------------------------------------------------- piezas

interface Frame { c: number; u: number; D: number; plane: Plane; /** Resplandores: se dibujan antes que todas las piezas, ver drawScene. */ glows: Item[] }
interface Item { z: number; front: boolean; draw: (ctx: Ctx) => void }

/** Pasadas de resplandor (aditivas) de un tubo: [múltiplo del ancho, opacidad]. */
const GLOW: [number, number][] = [[5, 0.07], [3, 0.12], [1.8, 0.2]];
/** Puntos por tramo: cada tramo se ordena en profundidad por separado. */
const CHUNK = 5;

function trace(ctx: Ctx, X: Float64Array, Y: Float64Array, a: number, b: number) {
  ctx.beginPath();
  ctx.moveTo(X[a], Y[a]);
  for (let i = a + 1; i <= b; i++) ctx.lineTo(X[i], Y[i]);
}

function gradient(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c0: RGB, c1: RGB, k: (c: RGB) => RGB, alpha = 1, alpha1 = alpha) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, css(k(c0), alpha));
  g.addColorStop(1, css(k(c1), alpha1));
  return g;
}

/**
 * Resplandor de un tramo: trazos anchos que se suman (lighter). Con extremos planos los tramos contiguos se solapan o dejan
 * huecos en cada codo y el halo sale a baldosas; con extremos redondos cubren cada punto de forma continua, pero entonces
 * un punto lo cubren varios tramos a la vez (unos 1 + ancho/largo) y la suma lo sobreexpone: se reparte la opacidad
 * entre ellos. `al0`/`al1` son la opacidad en los extremos (la estela se desvanece) y `wGlow` el ancho base.
 */
function glowChunk(ctx: Ctx, X: Float64Array, Y: Float64Array, a: number, b: number, wGlow: number, c0: RGB, c1: RGB, al0: number, al1: number) {
  if (al0 < 0.01 && al1 < 0.01) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const mid = mixc(c0, c1, 0.5);
  const al = (al0 + al1) / 2;
  let len = 0;
  for (let i = a + 1; i <= b; i++) len += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  for (const [k, g] of GLOW) {
    const gw = wGlow * k;
    ctx.strokeStyle = css(mid, (g * al) / (1 + gw / Math.max(len, 1)));
    ctx.lineWidth = gw;
    trace(ctx, X, Y, a, b);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Un tramo de tubo, sombreado como cilindro: borde oscuro, cuerpo con el color y un brillo fino desplazado hacia la luz.
 * Los extremos son planos (butt) y el color se interpola entre los dos extremos del tramo, así no hay costuras;
 * los tapones redondos del tubo se dibujan aparte. `al0`/`al1` son la opacidad en cada extremo (1 = opaco): sirven
 * para desvanecer la cola de un cometa; el borde oscuro se desvanece más rápido que el color para que la cola quede
 * como luz y no como un trazo con contorno.
 */
function strokeChunk(ctx: Ctx, X: Float64Array, Y: Float64Array, a: number, b: number, w: number, c0: RGB, c1: RGB, al0 = 1, al1 = 1) {
  if (al0 < 0.01 && al1 < 0.01) return;
  const n = X.length;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  trace(ctx, X, Y, a, b);
  ctx.lineWidth = w;
  ctx.strokeStyle = gradient(ctx, X[a], Y[a], X[b], Y[b], c0, c1, (c) => mixc(c, NIGHT, 0.6), al0 * al0, al1 * al1);
  ctx.stroke();
  ctx.lineWidth = w * 0.66;
  ctx.strokeStyle = gradient(ctx, X[a], Y[a], X[b], Y[b], c0, c1, (c) => c, al0, al1);
  ctx.stroke();
  // Brillo: sigue la línea del tubo pero corrido hacia la luz; cuanto más de lado respecto a la luz, más corrido.
  ctx.beginPath();
  for (let i = a; i <= b; i++) {
    const ia = Math.max(i - 1, 0), ib = Math.min(i + 1, n - 1);
    const tx = X[ib] - X[ia], ty = Y[ib] - Y[ia];
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l, ny = tx / l;
    const off = (nx * LIGHT_2D[0] + ny * LIGHT_2D[1]) * 0.2 * w;
    if (i === a) ctx.moveTo(X[i] + nx * off, Y[i] + ny * off); else ctx.lineTo(X[i] + nx * off, Y[i] + ny * off);
  }
  ctx.lineWidth = w * 0.24;
  ctx.strokeStyle = gradient(ctx, X[a], Y[a], X[b], Y[b], c0, c1, (c) => mixc(c, WHITE, 0.62), 0.9 * al0, 0.9 * al1);
  ctx.stroke();
}

/** Esfera sombreada (tapones de los tubos, extremos de los arcos, perlas). */
function sphere(ctx: Ctx, x: number, y: number, r: number, base: RGB) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.38, r * 0.08, x, y, r);
  g.addColorStop(0, css(mixc(base, WHITE, 0.78)));
  g.addColorStop(0.5, css(base));
  g.addColorStop(1, css(mixc(base, NIGHT, 0.55)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/**
 * Perfil de la estela de un cometa. `t` es la distancia a la cabeza (0 = cabeza, 1 = punta de la cola) y `amount` cuánta
 * estela hay (0 = ninguna: el tubo parejo de siempre; 1 = completa). El ancho se afina de forma pareja hacia la cola...
 */
export const cometWidth = (t: number, amount: number) => 1 - amount * 0.82 * Math.pow(clamp01(t), 0.85);
/** ...y la opacidad cae rápido cerca de la punta (como una estela fugaz): la cola termina en nada, sin corte. */
export const cometAlpha = (t: number, amount: number) => 1 - amount * (1 - Math.pow(1 - clamp01(t), 1.9));

interface TubeStyle {
  /** Radio del tubo en unidades. */
  r: number;
  /** Color del tubo según el avance a lo largo (0..1), la luz recibida (0..1) y la profundidad (0..1). */
  color: (s: number, lam: number, zn: number) => RGB;
  glow?: boolean;
  /** Esferas en los extremos (radio en unidades): tapones de un tubo abierto. */
  cap?: number;
  /**
   * Estela de cometa: `head` es el extremo por el que avanza (0 = primer punto, 1 = último) y el otro es la cola, que
   * se afina y se desvanece (`cometWidth`, `cometAlpha`). La cabeza crece un poco y el tapón de la cola se encoge a nada.
   */
  comet?: { head: 0 | 1; amount: number };
  /** Puntos por tramo del núcleo (por defecto `CHUNK`). */
  chunk?: number;
}

/** Proyecta un punto del mundo a píxeles del canvas. */
const px = (fr: Frame, p: V3): [number, number, number] => {
  const f = fr.D / (fr.D - p[2]);
  return [fr.c + p[0] * f * fr.u, fr.c + p[1] * f * fr.u, f];
};

function addTube(items: Item[], fr: Frame, pts: V3[], norms: V3[], st: TubeStyle) {
  const n = pts.length;
  const X = new Float64Array(n), Y = new Float64Array(n), F = new Float64Array(n);
  const col: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y, f] = px(fr, pts[i]);
    X[i] = x; Y[i] = y; F[i] = f;
    col.push(st.color(i / (n - 1), lambert(norms[i]), depthT(pts[i][2])));
  }
  const cm = st.comet;
  const amount = cm ? cm.amount : 0;
  const headIdx = cm ? (cm.head === 1 ? n - 1 : 0) : -1;
  /** Distancia a la cabeza (0..1) del punto i. */
  const tail = (i: number) => (cm ? Math.abs(i - headIdx) / (n - 1) : 0);
  /** Medidas de la estela en el tramo a..b (ancho del núcleo, ancho del resplandor y opacidad en cada extremo). */
  const profile = (a: number, b: number) => {
    let mf = 0;
    for (let i = a; i <= b; i++) mf += F[i];
    const wf = cometWidth((tail(a) + tail(b)) / 2, amount);
    const base = 2 * st.r * fr.u * (mf / (b - a + 1));
    // El resplandor se afina menos que el núcleo: en la cola queda un halo ancho y difuso alrededor de un hilo fino.
    return { w: base * wf, wGlow: base * (0.5 + 0.5 * wf), al0: cometAlpha(tail(a), amount), al1: cometAlpha(tail(b), amount) };
  };
  const meanZ = (a: number, b: number): V3 => {
    let mx = 0, my = 0, mz = 0;
    for (let i = a; i <= b; i++) { mx += pts[i][0]; my += pts[i][1]; mz += pts[i][2]; }
    const k = b - a + 1;
    return [mx / k, my / k, mz / k];
  };
  // Núcleo: tramos de varios puntos. Cada stroke() es independiente y donde se juntan dos bordes suavizados queda una
  // costura tenue, así que cuantos menos tramos mejor; el degradado de color y de opacidad corre dentro de cada uno.
  const step = (st.chunk ?? CHUNK) - 1;
  for (let a = 0; a < n - 1; a += step) {
    const b = Math.min(a + step, n - 1);
    const mid = meanZ(a, b);
    const { w, al0, al1 } = profile(a, b);
    items.push({ z: mid[2], front: isFront(fr.plane, fr.D, mid), draw: (ctx) => strokeChunk(ctx, X, Y, a, b, w, col[a], col[b], al0, al1) });
  }
  // Resplandor: tramos cortos (la estela se afina y se desvanece con más finura) y aparte del núcleo: es luz que se suma,
  // y dibujada junto a cada tramo caería encima del núcleo del anterior. Los extremos redondos no dejan costuras.
  if (st.glow) {
    for (let a = 0; a < n - 1; a++) {
      const b = a + 1;
      const mid = meanZ(a, b);
      const { wGlow, al0, al1 } = profile(a, b);
      fr.glows.push({ z: mid[2], front: isFront(fr.plane, fr.D, mid), draw: (ctx) => glowChunk(ctx, X, Y, a, b, wGlow, col[a], col[b], al0, al1) });
    }
  }
  if (st.cap) {
    for (const i of [0, n - 1]) {
      const r = st.cap * fr.u * F[i] * (cm ? (i === headIdx ? 1 + 0.25 * amount : 1 - amount) : 1);
      if (r < 0.4) continue;
      const c = col[i];
      items.push({ z: pts[i][2], front: isFront(fr.plane, fr.D, pts[i]), draw: (ctx) => {
        if (st.glow) {
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(X[i], Y[i], 0, X[i], Y[i], r * 2.6);
          g.addColorStop(0, css(c, 0.5));
          g.addColorStop(1, css(c, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(X[i], Y[i], r * 2.6, 0, TAU);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
        }
        sphere(ctx, X[i], Y[i], r, st.glow ? shade(c, 1.15) : c);
      } });
    }
  }
}

/** Puntos de un arco de circunferencia en su plano local (radio `R`, ángulos como en SVG: y hacia abajo) ya girados por `m`. */
function arcPoints(m: M3, R: number, a0: number, a1: number, n: number): { p: V3[]; nr: V3[] } {
  const p: V3[] = [], nr: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    const dir = apply(m, [Math.cos(a), Math.sin(a), 0]);
    nr.push(dir);
    p.push([dir[0] * R, dir[1] * R, dir[2] * R]);
  }
  return { p, nr };
}

const angleOf = (x: number, y: number) => Math.atan2(y - 50, x - 62);

// Geometría del dibujo de marca (viewBox -52 -64 228 228, centro en (62, 50)).
const RING_R = 96;
const RING_A0 = angleOf(135.54, 111.71);
const RING_A1 = angleOf(155.54, 71.6) + TAU;
const ARC_R = 103.5;
const ARC_A = [angleOf(-27.63, 101.75), angleOf(47.6, -52.49) + TAU] as const;
const ARC_B = [angleOf(133.9, 124.45), angleOf(83.52, 151.24)] as const;
const DOTS_R = 88.5;
const DOTS_N = 96;
const GLOBE_R = 84;
/** Cuánto se alarga la cola de los arcos con la estela completa, como fracción de su largo original. */
const TAIL_EXTRA = 0.7;

// ---------------------------------------------------------------- globo

const BUCKETS = 8;
interface LineGroup { rgb: RGB; w: number; glow: boolean; seg: number[][] }
const newGroup = (rgb: RGB, w: number, glow = false): LineGroup => ({ rgb, w, glow, seg: Array.from({ length: BUCKETS }, () => []) });

function drawGlobe(ctx: Ctx, fr: Frame, m: M3) {
  const { c, u } = fr;
  const R = GLOBE_R * u;
  // Cuerpo: luz arriba a la izquierda y un limbo oscuro abajo a la derecha, para que lea como esfera y no como disco.
  const fx = c - 0.32 * R, fy = c - 0.44 * R;
  const body = ctx.createRadialGradient(fx, fy, 0, fx, fy, 1.95 * R);
  body.addColorStop(0, 'rgba(185,200,255,.24)');
  body.addColorStop(0.5, 'rgba(80,100,240,.10)');
  body.addColorStop(0.84, 'rgba(30,40,170,.16)');
  body.addColorStop(1, 'rgba(20,30,120,0)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const limb = ctx.createRadialGradient(c - 0.18 * R, c - 0.22 * R, R * 0.55, c - 0.18 * R, c - 0.22 * R, R * 1.3);
  limb.addColorStop(0, 'rgba(10,15,70,0)');
  limb.addColorStop(1, 'rgba(10,15,70,.45)');
  ctx.fillStyle = limb;
  ctx.fillRect(c - R, c - R, 2 * R, 2 * R);
  ctx.restore();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(143,157,255,.34)';
  ctx.beginPath();
  ctx.arc(c, c, R, 0, TAU);
  ctx.stroke();

  // Malla: 6 meridianos y 5 paralelos. Cada segmento se atenúa según mire al espectador o esté en la cara oculta.
  const base = newGroup([143, 157, 255], 1.2);
  const prime = newGroup([127, 242, 255], 1.6, true);
  const equator = newGroup([255, 143, 203], 1.4);
  const N = 72;
  const addLine = (g: LineGroup, local: (a: number) => V3) => {
    let prev = apply(m, local(0));
    for (let i = 1; i <= N; i++) {
      const cur = apply(m, local((i / N) * TAU));
      const za = ((prev[2] + cur[2]) / 2) / GLOBE_R;
      const t = Math.pow(clamp01((za + 1) / 2), 1.4);
      const [x0, y0] = px(fr, prev), [x1, y1] = px(fr, cur);
      g.seg[Math.round(t * (BUCKETS - 1))].push(x0, y0, x1, y1);
      prev = cur;
    }
  };
  for (let k = 0; k < 6; k++) {
    const ry = rotAxis(AX_Y, rad(k * 30));
    addLine(k === 0 ? prime : base, (a) => apply(ry, [Math.cos(a) * GLOBE_R, Math.sin(a) * GLOBE_R, 0]));
  }
  for (const lat of [0, 35, -35, 65, -65]) {
    const cy = Math.cos(rad(lat)) * GLOBE_R, sy = -Math.sin(rad(lat)) * GLOBE_R;
    addLine(lat === 0 ? equator : base, (a) => [Math.cos(a) * cy, sy, Math.sin(a) * cy]);
  }
  ctx.lineCap = 'butt';
  for (const g of [base, equator, prime]) {
    for (let b = 0; b < BUCKETS; b++) {
      const s = g.seg[b];
      if (!s.length) continue;
      const alpha = 0.07 + 0.6 * (b / (BUCKETS - 1));
      ctx.beginPath();
      for (let i = 0; i < s.length; i += 4) { ctx.moveTo(s[i], s[i + 1]); ctx.lineTo(s[i + 2], s[i + 3]); }
      if (g.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = g.w * 4;
        ctx.strokeStyle = css(g.rgb, alpha * 0.22);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.lineWidth = g.w;
      ctx.strokeStyle = css(g.rgb, Math.min(1, alpha * (g.glow ? 1.3 : 1)));
      ctx.stroke();
    }
  }

  // Puntos sobre la superficie (espiral de Fibonacci): dan la referencia de que el globo gira.
  const COUNT = 80;
  ctx.fillStyle = css([175, 215, 255]);
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (2 * (i + 0.5)) / COUNT;
    const rr = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    const p = apply(m, [Math.cos(th) * rr * GLOBE_R, y * GLOBE_R, Math.sin(th) * rr * GLOBE_R]);
    if (p[2] < -0.1 * GLOBE_R) continue;
    const [x, yy, f] = px(fr, p);
    const k = clamp01(p[2] / GLOBE_R);
    ctx.globalAlpha = 0.18 + 0.7 * k;
    ctx.beginPath();
    ctx.arc(x, yy, (0.7 + 0.8 * k) * 1.1 * f, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- escena

/**
 * Dibuja un cuadro. `back` y `front` son los contextos de los canvas de detrás y de delante de la marca, ya escalados
 * a px CSS (sin transformación extra). `layer` es el lado de la capa del logo en px CSS; los canvas miden
 * `layer * (1 + 2 * CANVAS_PAD)` y su centro es el centro de la capa. `t` son los segundos desde que empezó la
 * animación (0 o menos = logo plano).
 */
export function drawScene(back: Ctx, front: Ctx, layer: number, t: number, reduced: boolean): Pose {
  const u = layer / VB;
  const D = PERSPECTIVE_PX / u;
  const pose = poseAt(t, reduced);
  const size = layer * (1 + 2 * CANVAS_PAD);
  const fr: Frame = { c: size / 2, u, D, plane: markPlane(pose.mark, u), glows: [] };
  back.clearRect(0, 0, size, size);
  front.clearRect(0, 0, size, size);

  const items: Item[] = [];

  const ring = arcPoints(pose.ring, RING_R, RING_A0, RING_A1, 150);
  addTube(items, fr, ring.p, ring.nr, { r: 1.75, color: (_s, lam, zn) => SILVER(lam, zn), cap: 1.75, chunk: 9 });

  // Arcos de colores como cometas. Giran en el sentido en que crece (A) o decrece (B) su ángulo, así que la cabeza es el
  // extremo de ese lado y la cola es el otro, que además se alarga hacia atrás (`TAIL_EXTRA`) a medida que crece la estela.
  const comet = pose.comet;
  const eA = comet * TAIL_EXTRA, eB = comet * TAIL_EXTRA;
  /** Color del arco en el punto de avance `s` (0..1 sobre el arco ya alargado); `u` lo lleva al dibujo original. */
  const arcColor = (g0: number, g1: number, e: number, tailFirst: boolean) => (s: number, lam: number, zn: number): RGB => {
    const u = tailFirst ? s * (1 + e) - e : s * (1 + e);
    const base = ramp(g0 + (g1 - g0) * u);
    return mixc(BG, mixc(shade(base, 0.62), shade(base, 1.12), clamp01(0.2 + 0.9 * lam)), 0.6 + 0.4 * zn);
  };
  const spanA = ARC_A[1] - ARC_A[0], spanB = ARC_B[1] - ARC_B[0];
  const a = arcPoints(pose.arcA, ARC_R, ARC_A[0] - eA * spanA, ARC_A[1], 72);
  addTube(items, fr, a.p, a.nr, { r: 1.4, color: arcColor(0.4, 0.17, eA, true), glow: true, cap: 2.9, comet: { head: 1, amount: comet } });
  const b = arcPoints(pose.arcB, ARC_R, ARC_B[0], ARC_B[1] + eB * spanB, 28);
  addTube(items, fr, b.p, b.nr, { r: 1.4, color: arcColor(0.89, 0.83, eB, false), glow: true, cap: 2.9, comet: { head: 0, amount: comet } });

  // Perlas del círculo punteado: una esfera por perla, ordenadas junto con el resto.
  for (let i = 0; i < DOTS_N; i++) {
    const ang = (i / DOTS_N) * TAU;
    const dir = apply(pose.dots, [Math.cos(ang), Math.sin(ang), 0]);
    const p: V3 = [dir[0] * DOTS_R, dir[1] * DOTS_R, dir[2] * DOTS_R];
    const [x, y, f] = px(fr, p);
    const r = 1.25 * u * f;
    const col = mixc(BG, mixc([96, 110, 136], [228, 237, 250], lambert(dir)), 0.5 + 0.5 * depthT(p[2]));
    items.push({ z: p[2], front: isFront(fr.plane, D, p), draw: (ctx) => sphere(ctx, x, y, r, col) });
  }

  drawGlobe(back, fr, pose.globe);
  // Primero todos los resplandores (son luz que se suma, van debajo de los tubos) y encima los tubos, de lejos a cerca.
  for (const g of fr.glows) g.draw(g.front ? front : back);
  items.sort((p, q) => p.z - q.z);
  for (const it of items) it.draw(it.front ? front : back);
  return pose;
}

// ---------------------------------------------------------------- ejecución en el navegador

/** Evento que lanza el banner de carga cuando se retira (ver components/Boot.tsx). */
export const READY_EVENT = 'ml:ready';
/**
 * Línea de tiempo del logo, desde que se retira el banner (`ml:ready`):
 *   0 s      empieza a irse el banner (0,56 s) y entra el texto del inicio. El logo sigue OCULTO.
 *   1 s      el logo aparece de la nada, plano (2D): se le pone `data-shown` y entra con la transición de .hero__logo
 *   2,2 s    el logo ya está del todo a la vista
 *   3,4 s    empieza la transición lenta al 3D (`STAGES`), tras ~1,2 s de logo plano a la vista
 * `APPEAR_MS` tiene que coincidir con la duración de esa transición en globals.css.
 */
const REVEAL_DELAY_MS = 1000;
/** Si el logo se monta con el banner ya retirado (p. ej. al volver del relevamiento) casi no hay nada que esperar. */
const REVEAL_RETURN_MS = 100;
const APPEAR_MS = 1200;
const HOLD_MS = 1200;

/** ¿Ya se retiró el banner de carga (o no hay)? Mientras `<html data-boot="loading">`, el logo se queda plano. */
const isReady = () => document.documentElement.dataset.boot !== 'loading';

/**
 * Monta la escena sobre los dos canvas y mueve la marca. Devuelve la función que lo desmonta.
 *
 * El logo está oculto (estado estático del CSS, desde el primer pintado) hasta que le toca aparecer: entonces se le pone
 * `data-shown` al contenedor y entra plano (2D, la pose de marca). Pasado un rato a la vista, pasa al movimiento 3D de
 * forma lenta y escalonada (`STAGES`, `TRANSITION_S` en total). Se pausa cuando el logo sale de pantalla y, con
 * "reducir movimiento", aparece al instante y se queda en un solo cuadro plano.
 */
export function startLogoScene(root: HTMLElement, back: HTMLCanvasElement, front: HTMLCanvasElement, mark: HTMLElement | SVGElement): () => void {
  const wrap = root.parentElement;
  let shown = false;
  const show = () => {
    if (shown) return;
    shown = true;
    wrap?.setAttribute('data-shown', '');
  };
  const bctx = back.getContext('2d');
  const fctx = front.getContext('2d');
  if (!bctx || !fctx) { show(); return () => {}; }

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const waitedForBoot = !isReady();
  let layer = 0;
  let raf = 0;
  let onScreen = true;
  /** Instantes (ms) en que el logo aparece y en que empieza a animarse; -1 = todavía no hay fecha. Pueden ser futuros. */
  let revealAt = -1;
  let begunAt = -1;
  let lastNow = 0;

  const render = (now: number) => {
    lastNow = now;
    if (revealAt >= 0 && now >= revealAt) show();
    if (!layer) return;
    const flat = mq.matches || begunAt < 0;
    const tau = flat ? 0 : Math.max(0, (now - begunAt) / 1000);
    const pose = drawScene(bctx, fctx, layer, tau, mq.matches);
    mark.style.transform = flat || tau <= 0 ? '' : markTransform(pose.mark);
  };
  const frame = (now: number) => {
    raf = 0;
    render(now);
    if (onScreen && !mq.matches) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (mq.matches) {
      cancelAnimationFrame(raf);
      raf = 0;
      revealAt = begunAt = -1;
      show();
      render(performance.now());
      return;
    }
    if (revealAt < 0 && isReady()) {
      revealAt = performance.now() + (waitedForBoot ? REVEAL_DELAY_MS : REVEAL_RETURN_MS);
      begunAt = revealAt + APPEAR_MS + HOLD_MS;
    }
    if (revealAt >= 0 && onScreen && !raf) raf = requestAnimationFrame(frame);
  };
  const fit = () => {
    const w = root.clientWidth;
    if (!w) return;
    layer = w;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const side = Math.round(w * (1 + 2 * CANVAS_PAD) * dpr);
    for (const [cv, cx] of [[back, bctx], [front, fctx]] as const) {
      cv.width = side;
      cv.height = side;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    render(lastNow || performance.now());
    kick();
  };

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
  ro?.observe(root);
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; kick(); })
    : null;
  io?.observe(root);
  mq.addEventListener('change', kick);
  window.addEventListener(READY_EVENT, kick);
  fit();
  kick();

  return () => {
    cancelAnimationFrame(raf);
    ro?.disconnect();
    io?.disconnect();
    mq.removeEventListener('change', kick);
    window.removeEventListener(READY_EVENT, kick);
    mark.style.transform = '';
    wrap?.removeAttribute('data-shown');
  };
}
