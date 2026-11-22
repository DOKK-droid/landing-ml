// @vitest-environment jsdom
/* El barrido del logo: ML APARECE con un barrido que empieza por la estela y sigue sus trazos hasta la punta de la L, se mantiene a la vista
 * un rato y se BORRA con otro barrido igual, y vuelve a empezar (intermitente). Se prueba el recorrido (geometría), la cronología, el marcado
 * (máscaras y copias de luz, apagadas) y el motor que escribe la visibilidad y la luz en el DOM. */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CORE_W, DECAY, EASE_POW, EDGE, FRONT_START, GLOW_GROW, IN_AT, IN_DONE, IN_MS, LEAD, MASK_GROW, OUT_AT, OUT_DONE, OUT_MS, PATH_LENGTH, PEAK, PERIOD_MS, SEGMENTS, SETTLE_T, SHAPES, TONE_COLOR,
  TRAVEL, frontAt, lightAt, litOpacity, profile, startSweep, stopArc, stopCount, stopOffset, visOpacity, visibleAt,
} from '@/view/logoSweep';
import { BASE_Y, CORNER_X, DIAG_LEN, FLOW_OVER, H2, LEG, TRAIL, onDiag, trailDashes, trailDiagPiece, trailFlowPath, trailFootPiece, trailMaskDiag, trailMaskFoot } from '@/view/logoTrail';
import { Logo } from '@/view/components/Logo';
import { MIN_FIRST_MS } from '@/view/components/Boot';

type Pt = readonly [number, number];
const sweep = () => renderToStaticMarkup(createElement(Logo, { variant: 'mark', sweep: 'hidden' }));
const plain = () => renderToStaticMarkup(createElement(Logo, { variant: 'mark' }));
const seg = (id: string) => SEGMENTS.find((s) => s.id === id)!;
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const poly = (points: string): Pt[] => points.split(' ').map((p) => p.split(',').map(Number) as unknown as Pt);
/** ¿Está el punto dentro del polígono convexo (en cualquiera de los dos sentidos)? */
const inside = (p: Pt, pts: Pt[]) => {
  const s = pts.map((a, i) => cross(sub(pts[(i + 1) % pts.length], a), sub(p, a)));
  return s.every((v) => v >= -1e-9) || s.every((v) => v <= 1e-9);
};
const mid = (s: { a: Pt; b: Pt }): Pt => [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
/** Cuándo (ms del periodo) el frente de aparición está en la longitud de arco `arc`. */
const tFront = (arc: number) => IN_AT + IN_MS * ((arc - FRONT_START) / (TRAVEL - FRONT_START)) ** (1 / EASE_POW);
/** Cobertura: fracción del recorrido que se ve a los `t` ms. */
const coverage = (t: number, once = false) => { let sum = 0, n = 0; for (let arc = 0; arc <= PATH_LENGTH; arc += 2) { sum += visibleAt(arc, t, once); n++; } return sum / n; };
/** El primer instante (ms, del periodo) en que `pred` se cumple. */
const firstT = (pred: (t: number) => boolean, from = 0) => { for (let t = from; t < PERIOD_MS; t += 5) if (pred(t)) return t; return Infinity; };

describe('el recorrido: la estela primero y luego los trazos del logo hasta la L', () => {
  it('son siete tramos, en orden: dos de la estela, la pata, las dos diagonales de la M, el palo y el pie de la L', () => {
    expect(SEGMENTS.map((s) => s.id)).toEqual(['trail-diag', 'trail-foot', 'leg', 'diag-left', 'diag-right', 'stem', 'foot']);
    expect(SEGMENTS.map((s) => s.tone)).toEqual(['trail', 'trail', 'm', 'm', 'm', 'l', 'l']);
  });

  it('EMPIEZA por la estela: en la punta de su diagonal de sombra (abajo), sube a la esquina y corre por el pie hasta la pata', () => {
    const [d, f] = [seg('trail-diag'), seg('trail-foot')];
    expect(SEGMENTS[0]).toBe(d);
    expect(d.s0).toBe(0);
    expect(d.a).toEqual(onDiag(DIAG_LEN, 0));
    expect(d.a[1], 'la punta está bajo el renglón').toBeGreaterThan(130);
    expect(d.b).toEqual(onDiag(0, 0));
    expect(Math.abs(cross(sub(d.b, d.a), H2)) / Math.hypot(...sub(d.b, d.a)), 'va por la diagonal de sombra').toBeLessThan(1e-9);
    expect(f.a).toEqual([CORNER_X, BASE_Y]);
    expect(f.b).toEqual([LEG, BASE_Y]);
  });

  it('SIGUE los trazos del logo: cada eje es paralelo y queda dentro de la forma que barre', () => {
    const shape = (id: keyof typeof SHAPES) => poly(SHAPES[id]);
    const unit = (s: { a: Pt; b: Pt }): Pt => { const d = sub(s.b, s.a), l = Math.hypot(...d); return [d[0] / l, d[1] / l]; };
    const edges = (id: keyof typeof SHAPES) => { const p = shape(id); return p.map((a, i) => sub(p[(i + 1) % p.length], a)); };
    for (const id of ['leg', 'diag-left', 'diag-right', 'stem', 'foot'] as const) {
      expect(inside(mid(seg(id)), shape(id)), `${id}: el centro del eje está dentro de la forma`).toBe(true);
      const u = unit(seg(id));
      expect(edges(id).some((e) => Math.abs(cross(u, e)) / Math.hypot(...e) < 0.01), `${id}: el eje es paralelo a un lado de la forma`).toBe(true);
    }
    expect(seg('leg').a[0]).toBe(LEG / 2);
    expect(seg('stem').a[0]).toBe(91.5);
    expect(seg('diag-left').b).toEqual(seg('diag-right').a); // el valle de la M
    expect(seg('foot').b).toEqual([146, BASE_Y]); // la punta de la L
  });

  it('desde la pata el barrido va de izquierda a derecha: la x del eje nunca retrocede (de la pata al palo y al pie de la L)', () => {
    const xs = SEGMENTS.slice(2).flatMap((s) => [s.a[0], s.b[0]]);
    for (let i = 1; i < xs.length; i++) expect(xs[i], `punto ${i}`).toBeGreaterThanOrEqual(xs[i - 1]);
    expect(xs.at(-1)).toBe(146);
  });

  it('el recorrido es continuo: cada tramo empieza donde acaba el anterior (salvo cruzar media pata)', () => {
    for (let i = 1; i < SEGMENTS.length; i++) {
      const [p, q] = [SEGMENTS[i - 1], SEGMENTS[i]];
      const gap = q.s0 - (p.s0 + p.len);
      expect(gap, `entre ${p.id} y ${q.id}`).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(LEG / 2 + 1e-9);
    }
    expect(PATH_LENGTH).toBeCloseTo(seg('foot').s0 + seg('foot').len, 9);
    expect(PATH_LENGTH).toBeGreaterThan(450);
    expect(PATH_LENGTH).toBeLessThan(600);
  });

  it('el color de la luz: lila en la estela y en la M, celeste claro en la L', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(TONE_COLOR.trail.slice(i, i + 2), 16));
    expect(b, 'lila: el azul domina').toBeGreaterThan(g);
    expect(r).toBeGreaterThan(g);
    const [lr, , lb] = [1, 3, 5].map((i) => parseInt(TONE_COLOR.l.slice(i, i + 2), 16));
    expect(lb, 'celeste').toBeGreaterThan(lr);
    for (const tone of ['trail', 'm', 'l'] as const) { expect(PEAK[tone]).toBeGreaterThan(0.5); expect(PEAK[tone]).toBeLessThanOrEqual(1); }
  });
});

describe('la cronología: aparece y se borra con un barrido que arranca antes de que termine el primero', () => {
  it('con el periodo en 0 y al cerrarse el bucle el logo está oculto del todo, y sin luz: el bucle no tiene saltos', () => {
    for (const t of [0, PERIOD_MS - 1, OUT_DONE + 10, IN_AT - 1]) {
      for (let arc = 0; arc <= PATH_LENGTH; arc += 5) {
        expect(visibleAt(arc, t), `t = ${t}, arco ${arc}`).toBe(0);
        expect(lightAt(arc, t), `luz: t = ${t}, arco ${arc}`).toBe(0);
      }
    }
    expect(PERIOD_MS - OUT_DONE, 'un respiro corto: todo apagado un instante').toBeGreaterThanOrEqual(150);
    expect(PERIOD_MS - OUT_DONE + IN_AT, 'pero no una espera').toBeLessThan(700);
  });

  it('APARECE con un barrido: los tramos se ven en el orden del recorrido, empezando por la estela y acabando en la punta de la L', () => {
    const shownAt = SEGMENTS.map((s) => firstT((t) => visibleAt(s.s0 + s.len / 2, t) > 0.5));
    expect(shownAt.every((t) => Number.isFinite(t))).toBe(true);
    for (let i = 1; i < shownAt.length; i++) expect(shownAt[i], `${SEGMENTS[i].id} después de ${SEGMENTS[i - 1].id}`).toBeGreaterThan(shownAt[i - 1]);
    expect(shownAt[0], 'la estela es lo primero en verse').toBeLessThan(IN_AT + 350);
    expect(shownAt.at(-1)!, 'y la punta de la L, lo último, antes de que acabe la aparición').toBeLessThanOrEqual(IN_DONE);
  });

  it('SE BORRA con otro barrido, en el mismo orden: la estela se apaga primero y la punta de la L, lo último', () => {
    const goneAt = SEGMENTS.map((s) => firstT((t) => visibleAt(s.s0 + s.len / 2, t) < 0.5, tFront(s.s0 + s.len / 2)));
    expect(goneAt.every((t) => Number.isFinite(t))).toBe(true);
    for (let i = 1; i < goneAt.length; i++) expect(goneAt[i], `${SEGMENTS[i].id} después de ${SEGMENTS[i - 1].id}`).toBeGreaterThan(goneAt[i - 1]);
    expect(goneAt.at(-1)!).toBeLessThanOrEqual(OUT_DONE);
  });

  it('el borrado ARRANCA ANTES de que termine la aparición: cuando el frente de aparición llega a la punta de la L ya se ha llevado la punta de la estela', () => {
    expect(OUT_AT, 'arranca antes').toBeLessThan(IN_DONE);
    expect(OUT_AT, 'pero con la aparición ya bien avanzada: no se pisan desde el primer instante').toBeGreaterThan(IN_AT + IN_MS / 2);
    expect(visibleAt(0, IN_DONE), 'la punta de la estela ya se borró').toBe(0);
    expect(visibleAt(PATH_LENGTH, IN_DONE), 'y la punta de la L acaba de aparecer del todo').toBe(1);
    // en ese instante hay una ventana visible que se desliza por el logo: ni el principio ni (aún) el final están fuera
    let lit = false;
    for (let t = OUT_AT; t <= IN_DONE; t += 10) if (visibleAt(0, t) < 0.2 && visibleAt(PATH_LENGTH / 2, t) > 0.8) lit = true;
    expect(lit, 'una ventana visible con el principio ya borrado').toBe(true);
  });

  it('no hay un rato quieto con el logo entero (el diseño es continuo), pero hay un instante en que se ve casi todo', () => {
    let peak = 0, entire = false;
    for (let t = 0; t < PERIOD_MS; t += 5) {
      const c = coverage(t);
      peak = Math.max(peak, c);
      if (c > 0.999) entire = true;
    }
    expect(entire, 'nunca entero a la vez: el borrado ya empezó').toBe(false);
    expect(peak, 'pero casi entero en el ápice').toBeGreaterThan(0.85);
    expect(peak).toBeLessThan(0.999);
    // el ápice es justo cuando acaba de aparecer
    const apex = firstT((t) => coverage(t) >= peak - 1e-9);
    expect(Math.abs(apex - IN_DONE)).toBeLessThanOrEqual(150);
  });

  it('los frentes ACELERAN (empiezan suaves y salen rápidos) y el borrado es más lento que la aparición: entra con decisión, se deshace con calma', () => {
    expect(EASE_POW).toBeGreaterThan(1.2);
    for (const [t0, ms] of [[IN_AT, IN_MS], [OUT_AT, OUT_MS]] as const) {
      const step = (u: number) => frontAt(t0 + (u + 0.1) * ms, t0, ms) - frontAt(t0 + u * ms, t0, ms);
      expect(step(0.7), `t0 = ${t0}: más rápido al final que al principio`).toBeGreaterThan(step(0.1) * 2);
      expect(frontAt(t0, t0, ms)).toBe(FRONT_START);
      expect(frontAt(t0 + ms, t0, ms)).toBeCloseTo(TRAVEL, 9);
      let prev = -Infinity;
      for (let t = t0; t <= t0 + ms * 1.5; t += 10) { const f = frontAt(t, t0, ms); expect(f).toBeGreaterThanOrEqual(prev); prev = f; } // nunca retrocede, y sigue de largo
    }
    expect(OUT_MS).toBeGreaterThan(IN_MS);
    expect(OUT_MS / IN_MS, 'la diferencia se nota pero no es exagerada').toBeLessThan(1.6);
  });

  it('antes de arrancar el frente está fuera del logo (ni borde ni luz): el barrido no se anuncia', () => {
    expect(FRONT_START).toBeLessThanOrEqual(-(LEAD + EDGE));
    for (const t of [0, IN_AT - 1, IN_AT]) for (let arc = 0; arc <= 30; arc += 3) { expect(visibleAt(arc, t)).toBe(0); expect(lightAt(arc, t)).toBe(0); }
  });

  it('al aparecer lo ya barrido se ve y lo que falta no (visibilidad no creciente a lo largo del recorrido); al final del borrado, al revés', () => {
    for (let t = IN_AT; t <= OUT_AT; t += 25) {
      let prev = 1;
      for (let arc = 0; arc <= PATH_LENGTH; arc += 4) { const v = visibleAt(arc, t); expect(v, `aparece: t = ${t}, arco ${arc}`).toBeLessThanOrEqual(prev + 1e-12); prev = v; }
    }
    for (let t = IN_DONE; t <= OUT_DONE; t += 25) {
      let prev = 0;
      for (let arc = 0; arc <= PATH_LENGTH; arc += 4) { const v = visibleAt(arc, t); expect(v, `se borra: t = ${t}, arco ${arc}`).toBeGreaterThanOrEqual(prev - 1e-12); prev = v; }
    }
    // y el borde tiene algo de caída (no es un corte): hay valores intermedios
    expect([...Array(130)].map((_, k) => visibleAt(k * 4, IN_AT + 300)).some((v) => v > 0.1 && v < 0.9)).toBe(true);
  });

  it('la luz del frente: 1 en él (por el lado ya visible), sube suave justo antes, se apaga detrás; viaja con los dos barridos', () => {
    expect(profile(-LEAD - 1)).toBe(0);
    expect(profile(0)).toBeCloseTo(1, 9);
    let prev = 0;
    for (let d = -LEAD; d <= 0; d += 0.5) { expect(profile(d)).toBeGreaterThanOrEqual(prev); prev = profile(d); }
    prev = 1;
    for (let d = 0; d < DECAY * 8; d += 1) { expect(profile(d)).toBeLessThanOrEqual(prev + 1e-12); prev = profile(d); }
    expect(profile(DECAY * 8)).toBe(0);
    expect(CORE_W, 'un núcleo vivo y una cola suave').toBeGreaterThan(0.3);
    // aparición: la luz está justo detrás del frente; borrado: justo delante de él
    const tIn = IN_AT + 400, fIn = frontAt(tIn, IN_AT, IN_MS);
    expect(lightAt(fIn - 1, tIn)).toBeGreaterThan(0.9);
    expect(lightAt(fIn + EDGE * 3, tIn), 'más adelante todavía no hay luz').toBe(0);
    const tOut = OUT_AT + 500, fOut = frontAt(tOut, OUT_AT, OUT_MS);
    expect(lightAt(fOut + 1, tOut)).toBeGreaterThan(0.9);
    expect(lightAt(fOut - EDGE * 3, tOut), 'lo ya borrado no tiene luz').toBe(0);
    for (let t = 0; t < PERIOD_MS; t += 25) for (let arc = 0; arc <= PATH_LENGTH; arc += 10) expect(lightAt(arc, t)).toBeLessThanOrEqual(1);
  });

  it('la luz es suave: entre dos paradas contiguas (a 4 unidades) nunca cambia a saltos, y la del borrado no se enciende de golpe al entrar', () => {
    let worst = 0;
    for (let t = 0; t < PERIOD_MS; t += 10) for (let arc = 0; arc + 4 <= PATH_LENGTH; arc += 4) worst = Math.max(worst, Math.abs(lightAt(arc + 4, t) - lightAt(arc, t)));
    expect(worst, 'un degradado de paradas cada 4 unidades no se ve a trozos').toBeLessThan(0.65);
    expect(lightAt(5, OUT_AT - 1), 'el borrado aún no ha entrado: sin su luz').toBeLessThan(0.05);
    expect(lightAt(5, OUT_AT + 50), 'y al entrar sube con el frente, no de golpe').toBeLessThan(0.2);
  });

  it('con `once` (la última aparición del inicio, o el logo entero con "reducir movimiento") solo hay aparición: ni borrado ni su luz; y acaba entero y sin luz', () => {
    for (const t of [OUT_AT + 100, IN_DONE, OUT_DONE, PERIOD_MS - 1]) {
      for (let arc = 0; arc <= PATH_LENGTH; arc += 20) expect(visibleAt(arc, t, true), `t = ${t}, arco ${arc}`).toBeGreaterThanOrEqual(visibleAt(arc, t));
    }
    for (let arc = 0; arc <= PATH_LENGTH; arc += 5) {
      expect(visibleAt(arc, SETTLE_T, true), `arco ${arc}`).toBe(1);
      expect(lightAt(arc, SETTLE_T, true), `luz: arco ${arc}`).toBe(0);
    }
    expect(SETTLE_T, 'tras la aparición, con la luz ya apagada').toBeGreaterThan(IN_DONE);
    // y la luz de la aparición se apaga sola al irse el frente (no queda un resplandor fijo en la punta de la L)
    let last = 1;
    for (let t = IN_DONE; t <= SETTLE_T; t += 10) { const l = lightAt(PATH_LENGTH, t, true); expect(l).toBeLessThanOrEqual(last + 1e-9); last = l; }
    expect(last).toBe(0);
  });

  it('el banner no se retira en la primera carga hasta que el logo completó UN ciclo entero (aparecer y borrarse)', () => {
    expect(MIN_FIRST_MS).toBeGreaterThanOrEqual(OUT_DONE);
    expect(MIN_FIRST_MS - OUT_DONE, 'sin pasarse').toBeLessThan(300);
  });

  it('las paradas de cada degradado: suficientes para que el borde no se vea a trozos, de 0 a 1 y dentro de su tramo', () => {
    for (const s of SEGMENTS) {
      const n = stopCount(s);
      expect(n, s.id).toBeGreaterThanOrEqual(12);
      expect(stopOffset(s, 0)).toBe(0);
      expect(stopOffset(s, n - 1)).toBe(1);
      expect(stopArc(s, 0)).toBeCloseTo(s.s0, 9);
      expect(stopArc(s, n - 1)).toBeCloseTo(s.s0 + s.len, 9);
      expect(s.len / (n - 1), `${s.id}: una parada cada ≤ 5 unidades`).toBeLessThanOrEqual(5);
    }
    expect(visOpacity(seg('leg'), 3, SETTLE_T, true)).toBe(1);
    expect(litOpacity(seg('leg'), 3, SETTLE_T, true)).toBe(0);
  });
});

describe('el marcado: máscaras y copias de luz, apagadas', () => {
  it('sin pedirlo (encabezado, pie, inicio) el dibujo es el de siempre: ni máscaras ni copias', () => {
    for (const svg of [plain(), renderToStaticMarkup(createElement(Logo, { variant: 'hero' })), renderToStaticMarkup(createElement(Logo, { variant: 'mark', flow: true }))]) {
      for (const word of ['<mask', 'logo__lit', 'logo__vis', 'data-sweep', ' mask=']) expect(svg).not.toContain(word);
    }
  });

  it('dos degradados por tramo, en su orden, a lo largo de su eje y con todas las paradas en 0: `vis` blanco (la máscara) y `lit` del color de su tono', () => {
    const svg = sweep();
    const grads = [...svg.matchAll(/<linearGradient id="(vis|lit)-[a-z-]+-[^"]+" data-sweep="(vis|lit):([a-z-]+)" gradientUnits="userSpaceOnUse" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)">([\s\S]*?)<\/linearGradient>/g)];
    expect(grads.map((m) => `${m[2]}:${m[3]}`)).toEqual(SEGMENTS.flatMap((s) => [`vis:${s.id}`, `lit:${s.id}`]));
    for (const m of grads) {
      const s = seg(m[3]);
      [+m[4], +m[5], +m[6], +m[7]].forEach((v, k) => expect(Math.abs(v - [s.a[0], s.a[1], s.b[0], s.b[1]][k]), `${s.id}: eje`).toBeLessThan(0.006));
      const stops = [...m[8].matchAll(/<stop offset="([^"]+)" stop-color="(#[0-9a-f]{3,6})" stop-opacity="([^"]+)"/g)];
      expect(stops, `${m[2]}:${s.id}`).toHaveLength(stopCount(s));
      for (const st of stops) {
        expect(st[2]).toBe(m[2] === 'vis' ? '#fff' : TONE_COLOR[s.tone]);
        expect(st[3], `${m[2]}:${s.id}: nace en 0`).toBe('0');
      }
    }
  });

  it('cuatro máscaras: una para la M y la L (sus cinco formas, casi pegadas), otra para la estela (una banda en el pie y otra en la diagonal) y una por resplandor', () => {
    const svg = sweep();
    const mask = (name: string) => new RegExp(`<mask id="${name}-[^"]+" maskUnits="userSpaceOnUse"[^>]*>([\\s\\S]*?)</mask>`).exec(svg)![1];
    const shapes = (m: string) => [...m.matchAll(/<polygon class="logo__vis" points="([^"]+)" fill="url\(#vis-([a-z-]+)-[^"]+\)" stroke="url\(#vis-([a-z-]+)-[^"]+\)" stroke-width="([^"]+)" stroke-linejoin="round"/g)].map((x) => ({ points: x[1], fill: x[2], stroke: x[3], w: +x[4] }));
    const mainShapes = shapes(mask('vmshape'));
    expect(mainShapes.map((x) => x.fill)).toEqual(['leg', 'diag-left', 'diag-right', 'stem', 'foot']);
    for (const x of mainShapes) { expect(x.points).toBe(SHAPES[x.fill as keyof typeof SHAPES]); expect(x.stroke).toBe(x.fill); expect(x.w).toBe(MASK_GROW * 2); }
    expect(MASK_GROW, 'pegada a la forma: si se agranda, un tramo filtra su visibilidad al vecino').toBeLessThanOrEqual(3);
    const trail = shapes(mask('vmtrail'));
    expect(trail.map((x) => x.fill)).toEqual(['trail-foot', 'trail-diag']);
    expect([trail[0].points, trail[1].points]).toEqual([trailMaskFoot(), trailMaskDiag()]);
    for (const x of trail) expect(x.w).toBe(0);
    expect(shapes(mask('vmglow')).map((x) => x.fill)).toEqual(['stem', 'foot']);
    expect(shapes(mask('vmglowt')).map((x) => x.fill)).toEqual(['trail-foot', 'trail-diag']);
    for (const x of [...shapes(mask('vmglow')), ...shapes(mask('vmglowt'))]) expect(x.w).toBe(GLOW_GROW * 2);
    expect(GLOW_GROW, 'los resplandores se salen de su forma lo que alcanza su desenfoque').toBeGreaterThanOrEqual(8);
  });

  it('las bandas de la máscara cubren TODA la estela: cada pieza de cada línea, su polvo y su destello caen dentro de la banda del pie o de la de la diagonal', () => {
    const [foot, diag] = [poly(trailMaskFoot()), poly(trailMaskDiag())];
    const covered = (p: Pt) => inside(p, foot) || inside(p, diag);
    TRAIL.forEach((l, i) => {
      for (const pts of [trailFootPiece(l), trailDiagPiece(l)]) for (const p of poly(pts)) expect(covered(p), `línea ${i}: vértice (${p})`).toBe(true);
      for (const d of trailDashes(l)) for (const p of [[d.x1, d.y1], [d.x2, d.y2]] as Pt[]) expect(covered(p), `línea ${i}: polvo (${p})`).toBe(true);
      for (const [x, y] of [...trailFlowPath(l).matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]] as Pt)) expect(covered([x, y]), `línea ${i}: destello (${x}, ${y})`).toBe(true);
    });
    expect(FLOW_OVER).toBeGreaterThan(0);
  });

  it('cada trozo del dibujo va en el grupo de SU máscara, en el orden de siempre: resplandor de la L, pata, fondo de la estela, su resplandor, sus líneas, y por encima la M y la L', () => {
    const svg = sweep();
    const at = (re: RegExp) => svg.search(re);
    const lglow = at(/<g mask="url\(#vmglow-[^"]+\)"><polygon points="83,42 100,12.1 100,83 146,83 146,100 83,100"/);
    const leg = at(/<g mask="url\(#vmshape-[^"]+\)"><polygon points="0,0 17,29.9 17,100 0,100" fill="url\(#g1-/);
    const band = at(/<g mask="url\(#vmtrail-[^"]+\)"><polygon class="logo__trail-foot"/);
    const tglow = at(/<g mask="url\(#vmglowt-[^"]+\)"><polygon class="logo__trail-glow"/);
    const layers = at(/<g mask="url\(#vmtrail-[^"]+\)"><g class="logo__trail-layer"/);
    const ml = at(/<g mask="url\(#vmshape-[^"]+\)"><polygon points="50,58 83,0 100,0 50,87.9"/);
    const order = [lglow, leg, band, tglow, layers, ml];
    expect(order.every((i) => i > 0), JSON.stringify(order)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    // cada máscara se aplica a quien debe: la del dibujo a la M y a la L, la de la estela a sus líneas
    expect(svg.match(/<g mask="url\(#vmshape-/g)).toHaveLength(2);
    expect(svg.match(/<g mask="url\(#vmtrail-/g)).toHaveLength(2);
    for (const shape of Object.values(SHAPES)) expect(svg).toContain(`points="${shape}"`);
  });

  it('cada forma lleva encima su copia de luz (el mismo polígono que el dibujo) y cada línea de la estela la de sus dos piezas, dentro de su capa', () => {
    const svg = sweep();
    for (const [id, points] of Object.entries(SHAPES)) {
      expect(svg, id).toContain(`<polygon class="logo__lit" data-shape="${id}" points="${points}" fill="url(#lit-${id}-`);
      expect(plain(), id).toContain(`points="${points}"`); // el polígono del dibujo existe tal cual (la copia no se inventa otra forma)
    }
    const layers = svg.split('<g class="logo__trail-layer"').slice(1).map((c) => c.slice(0, c.indexOf('</g>')));
    expect(layers).toHaveLength(TRAIL.length);
    for (const l of layers) expect(l.match(/class="logo__lit"/g)).toHaveLength(2);
    expect(svg.indexOf('data-shape="leg"')).toBeGreaterThan(svg.indexOf('points="83,100 100,83 146,83 146,100" fill="url(#gf-'));
  });

  it('todas las referencias url(#…) existen, no hay estilos en línea (la CSP no los admite) y dos logos no comparten ids', () => {
    const svg = sweep();
    const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(m[1]), `falta #${m[1]}`).toBe(true);
    expect(svg).not.toMatch(/\sstyle="/);
    const both = renderToStaticMarkup(createElement('div', null, createElement(Logo, { variant: 'mark', sweep: 'hidden' }), createElement(Logo, { variant: 'mark', sweep: 'hidden' })));
    const all = [...both.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('el motor (startSweep)', () => {
  let frames: FrameRequestCallback[] = [];
  let cancelled = 0;
  let reduced = false;
  let container: HTMLElement;
  const T0 = 5000;
  const run = (t: number) => { const f = frames; frames = []; f.forEach((cb) => cb(T0 + t)); };
  // en dos pasos: jsdom no resuelve bien un selector con descendiente sobre elementos SVG de nombre con mayúsculas
  const stopsOf = (kind: 'vis' | 'lit', id: string) => Array.from(container.querySelector(`linearGradient[data-sweep="${kind}:${id}"]`)!.querySelectorAll('stop'), (s) => Number(s.getAttribute('stop-opacity')));

  beforeEach(() => {
    frames = []; cancelled = 0; reduced = false;
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduced-motion') ? reduced : false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => { frames.push(cb); return frames.length; }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = (() => { cancelled++; }) as typeof window.cancelAnimationFrame;
    vi.spyOn(performance, 'now').mockReturnValue(T0);
    container = document.createElement('div');
    container.innerHTML = sweep();
    document.body.appendChild(container);
  });
  afterEach(() => { container.remove(); vi.restoreAllMocks(); });

  it('nace con el logo oculto (todo en 0) y lo va mostrando con el barrido, cuadro a cuadro: la estela primero, la L al final', () => {
    for (const s of SEGMENTS) { expect(Math.max(...stopsOf('vis', s.id)), s.id).toBe(0); expect(Math.max(...stopsOf('lit', s.id))).toBe(0); }
    const stop = startSweep(container);
    expect(frames).toHaveLength(1);
    run(tFront(40 + EDGE)); // el frente va por la diagonal de sombra de la estela (a 40 unidades, con el borde ya pasado)
    expect(Math.max(...stopsOf('vis', 'trail-diag')), 'la estela se ve').toBe(1);
    expect(Math.max(...stopsOf('lit', 'trail-diag')), 'con la luz del frente').toBeGreaterThan(0.3);
    for (const id of ['trail-foot', 'leg', 'diag-left', 'diag-right', 'stem', 'foot']) expect(Math.max(...stopsOf('vis', id)), `${id} aún oculto`).toBe(0);
    expect(frames, 'pide el siguiente').toHaveLength(1);
    run(tFront(seg('stem').s0 + 40 + EDGE)); // por el palo de la L
    expect(Math.min(...stopsOf('vis', 'leg')), 'la pata ya se ve entera').toBe(1);
    expect(Math.max(...stopsOf('vis', 'stem'))).toBe(1);
    expect(Math.max(...stopsOf('vis', 'foot')), 'el pie de la L aún no').toBe(0);
    stop();
  });

  it('el borrado empieza ANTES de que termine la aparición: al acabar de aparecer la L ya no está la punta de la estela', () => {
    startSweep(container);
    run(IN_DONE);
    expect(Math.min(...stopsOf('vis', 'trail-diag')), 'la punta de la estela ya se borró').toBe(0);
    expect(Math.max(...stopsOf('vis', 'trail-diag')), 'y el resto de la diagonal aún se ve').toBeGreaterThan(0);
    expect(Math.min(...stopsOf('vis', 'leg')), 'la pata, entera').toBe(1);
    expect(Math.min(...stopsOf('vis', 'foot')), 'y la punta de la L acaba de aparecer del todo').toBe(1);
  });

  it('se borra empezando otra vez por la estela y acaba con la punta de la L', () => {
    startSweep(container);
    run(OUT_AT + OUT_MS * 0.6); // el frente de borrado ya pasó la estela
    expect(Math.max(...stopsOf('vis', 'trail-diag')), 'la estela ya se borró').toBe(0);
    expect(Math.min(...stopsOf('vis', 'foot')), 'y la punta de la L sigue entera').toBe(1);
    expect(Math.max(...stopsOf('lit', 'trail-diag'))).toBe(0);
  });

  it('en el respiro vuelve a quedar todo oculto, no escribe nada más, y el bucle empieza otra vez en el periodo siguiente', () => {
    startSweep(container);
    run(IN_DONE);
    run(OUT_DONE + 30);
    for (const s of SEGMENTS) expect(Math.max(...stopsOf('vis', s.id)), s.id).toBe(0);
    for (const s of SEGMENTS) expect(Math.max(...stopsOf('lit', s.id)), `luz ${s.id}`).toBe(0);
    const spy = vi.spyOn(Element.prototype, 'setAttribute');
    run(PERIOD_MS - 80);
    expect(spy, 'en reposo no escribe').not.toHaveBeenCalled();
    run(PERIOD_MS + tFront(40 + EDGE)); // el siguiente periodo
    expect(Math.max(...stopsOf('vis', 'trail-diag'))).toBe(1);
  });

  it('solo escribe las paradas que cambian', () => {
    startSweep(container);
    run(tFront(40 + EDGE));
    const spy = vi.spyOn(Element.prototype, 'setAttribute');
    run(tFront(40 + EDGE)); // el mismo instante: nada cambió
    expect(spy).not.toHaveBeenCalled();
  });

  it('al detenerlo cancela el cuadro pedido y un cuadro que llega después no escribe ni pide otro', () => {
    const stop = startSweep(container);
    expect(cancelled).toBe(0);
    stop();
    expect(cancelled).toBe(1);
    run(tFront(40 + EDGE));
    expect(frames).toHaveLength(0);
    for (const s of SEGMENTS) expect(Math.max(...stopsOf('vis', s.id)), s.id).toBe(0);
  });

  it('con "reducir movimiento" no hay barrido: deja el logo ENTERO a la vista, sin luz y quieto (no pide cuadros)', () => {
    reduced = true;
    startSweep(container)();
    expect(frames).toHaveLength(0);
    for (const s of SEGMENTS) { expect(Math.min(...stopsOf('vis', s.id)), `${s.id}: se ve`).toBe(1); expect(Math.max(...stopsOf('lit', s.id)), `${s.id}: sin luz`).toBe(0); }
  });

  it('un logo sin barrido no falla ni pide cuadros', () => {
    const empty = document.createElement('div');
    empty.innerHTML = plain();
    startSweep(empty)();
    expect(frames).toHaveLength(0);
  });
});
