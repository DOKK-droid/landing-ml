import { describe, expect, it } from 'vitest';
import { I3, STAGES, TRANSITION_S, animBlend, animClock, apply, cometAlpha, cometWidth, drawScene, isFront, markPlane, markTransform, mul, poseAt, rotAxis, type V3 } from '@/view/logoScene';

const deg = (d: number) => (d * Math.PI) / 180;
const near = (v: V3, w: V3, digits = 6) => v.forEach((x, i) => expect(x).toBeCloseTo(w[i], digits));

describe('álgebra con las convenciones de CSS', () => {
  it('rotar sobre X, Y y Z coincide con rotateX / rotateY / rotateZ', () => {
    // rotateX(a): y' = y cos − z sin ; z' = y sin + z cos
    near(apply(rotAxis([1, 0, 0], deg(90)), [0, 1, 0]), [0, 0, 1]);
    // rotateY(a): x' = x cos + z sin ; z' = −x sin + z cos
    near(apply(rotAxis([0, 1, 0], deg(90)), [1, 0, 0]), [0, 0, -1]);
    // rotate(a) (Z): en pantalla, con y hacia abajo, el giro positivo es horario: derecha → abajo
    near(apply(rotAxis([0, 0, 1], deg(90)), [1, 0, 0]), [0, 1, 0]);
  });

  it('el eje se normaliza (como rotate3d) y mul aplica primero el de la derecha', () => {
    near(apply(rotAxis([0, 5, 0], deg(90)), [1, 0, 0]), [0, 0, -1]);
    const m = mul(rotAxis([0, 0, 1], deg(90)), rotAxis([1, 0, 0], deg(90)));
    // primero X (y → z), luego Z (z queda igual)
    near(apply(m, [0, 1, 0]), [0, 0, 1]);
  });

  it('la identidad no cambia nada', () => near(apply(I3, [3, -4, 5]), [3, -4, 5]));
});

/** Segundos desde que empieza la animación para que el reloj de una pieza (sin su rampa de arranque) marque `s`. */
const at = (stage: keyof typeof STAGES, s: number) => s + STAGES[stage].delay + STAGES[stage].ramp / 2;
const tiltOf = (m: ReturnType<typeof poseAt>['arcA']) => Math.acos(Math.min(1, apply(m, [0, 0, 1])[2]));

describe('pose', () => {
  it('con movimiento reducido todo queda en la posición de marca', () => {
    const p = poseAt(123.4, true);
    expect(p.ring).toEqual(I3);
    expect(p.dots).toEqual(I3);
    expect(p.arcA).toEqual(I3);
    expect(p.arcB).toEqual(I3);
    expect(p.mark).toEqual({ a: 0, b: 0, ty: 0 });
  });

  it('al empezar a animar (tau = 0) es exactamente el logo plano', () => {
    expect(poseAt(0, false)).toEqual(poseAt(50, true));
    expect(poseAt(-1, false)).toEqual(poseAt(50, true));
  });

  it('la marca oscila entre sus extremos con el periodo de 7 s una vez pasada su rampa', () => {
    expect(poseAt(at('mark', 3.5), false).mark.a).toBeCloseTo(14, 9);
    expect(poseAt(at('mark', 3.5), false).mark.ty).toBeCloseTo(-6, 9);
    expect(poseAt(at('mark', 7), false).mark.a).toBeCloseTo(-14, 9);
  });

  it('el anillo da la vuelta completa en 22 s sobre su eje (queda de canto a los 5,5 s)', () => {
    const n = apply(poseAt(at('ring', 5.5), false).ring, [0, 0, 1]);
    expect(Math.abs(n[2])).toBeLessThan(0.02);
    near(apply(poseAt(at('ring', 22), false).ring, [0, 0, 1]), [0, 0, 1], 6);
  });

  it('markTransform da el mismo orden de giros que el CSS', () => {
    expect(markTransform({ a: -14, b: 4, ty: -3 })).toBe('rotateY(-14.000deg) rotateX(4.000deg) translateY(-3.000px)');
  });
});

describe('transición del logo 2D al 3D', () => {
  it('es lenta (varios segundos) y escalonada: cada pieza arranca en su momento, el globo primero y las perlas al final', () => {
    expect(TRANSITION_S).toBeGreaterThanOrEqual(4);
    expect(TRANSITION_S).toBeLessThanOrEqual(8);
    const order = (Object.keys(STAGES) as (keyof typeof STAGES)[]).sort((x, y) => STAGES[x].delay - STAGES[y].delay);
    expect(order).toEqual(['globe', 'arcs', 'mark', 'ring', 'dots']);
    for (const k of order) expect(STAGES[k].delay + STAGES[k].ramp).toBeLessThanOrEqual(TRANSITION_S);
  });

  it('cada pieza se queda quieta hasta su turno: al principio solo se mueve el globo', () => {
    const early = poseAt(STAGES.arcs.delay * 0.9, false);
    expect(early.arcA).toEqual(I3);
    expect(early.ring).toEqual(I3);
    expect(early.dots).toEqual(I3);
    for (const v of Object.values(early.mark)) expect(Math.abs(v)).toBe(0); // (-0 y +0 valen lo mismo: la marca no se movió)
    expect(early.globe).not.toEqual(poseAt(0, true).globe);
    const mid = poseAt(STAGES.dots.delay * 0.9, false); // justo antes del turno de las perlas
    expect(mid.dots).toEqual(I3); // las perlas aún no
    expect(mid.ring).not.toEqual(I3);
    expect(tiltOf(mid.arcA)).toBeGreaterThan(0);
  });

  it('el reloj de una pieza arranca en 0, nunca retrocede y tras su rampa avanza un segundo por segundo', () => {
    const ramp = 3;
    expect(animClock(0, ramp)).toBe(0);
    expect(animClock(-3, ramp)).toBe(0);
    let prev = 0;
    for (let t = 0; t <= 10; t += 0.05) {
      const c = animClock(t, ramp);
      expect(c).toBeGreaterThanOrEqual(prev);
      expect(c - prev).toBeLessThanOrEqual(0.05 + 1e-9);
      prev = c;
    }
    expect(animClock(ramp + 4, ramp) - animClock(ramp + 3, ramp)).toBeCloseTo(1, 9);
  });

  it('la velocidad de giro empieza en cero (no hay arranque brusco) y es continua al terminar la rampa', () => {
    const ramp = 3.6;
    const v = (t: number) => (animClock(t + 1e-4, ramp) - animClock(t, ramp)) / 1e-4;
    expect(v(0)).toBeLessThan(0.01);
    expect(v(ramp - 0.01)).toBeCloseTo(1, 1);
    expect(v(ramp + 0.01)).toBeCloseTo(1, 3);
  });

  it('la mezcla va de 0 a 1 de forma suave', () => {
    const ramp = 3.6;
    expect(animBlend(0, ramp)).toBe(0);
    expect(animBlend(ramp, ramp)).toBe(1);
    expect(animBlend(ramp * 5, ramp)).toBe(1);
    let prev = 0;
    for (let t = 0; t <= ramp; t += ramp / 50) {
      const b = animBlend(t, ramp);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it('los arcos y la marca salen del plano de la pantalla poco a poco, sin saltos', () => {
    let prev = 0;
    let maxStep = 0;
    for (let t = 0; t <= TRANSITION_S; t += 0.05) {
      const p = poseAt(t, false);
      const a = tiltOf(p.arcA);
      maxStep = Math.max(maxStep, Math.abs(a - prev));
      prev = a;
      expect(Math.abs(p.mark.a)).toBeLessThanOrEqual(14);
    }
    expect(tiltOf(poseAt(STAGES.arcs.delay + 0.05, false).arcA)).toBeLessThan(deg(2));
    expect(tiltOf(poseAt(TRANSITION_S + 3, false).arcA)).toBeGreaterThan(deg(30));
    expect(maxStep).toBeLessThan(deg(6));
  });

  it('el primer cuadro animado se dibuja igual que el plano, y al terminar ya hay piezas delante de la marca', () => {
    const flat = fakeCtx(), flatFront = fakeCtx();
    drawScene(flat.ctx, flatFront.ctx, 300, 0, false);
    const ref = fakeCtx(), refFront = fakeCtx();
    drawScene(ref.ctx, refFront.ctx, 300, 99, true);
    expect(flat.count).toEqual(ref.count);
    expect(flatFront.count.stroke + flatFront.count.fill).toBe(0);
    let front = 0;
    for (let t = TRANSITION_S; t < TRANSITION_S + 30; t += 0.5) {
      const b = fakeCtx(), f = fakeCtx();
      drawScene(b.ctx, f.ctx, 300, t, false);
      front += f.count.stroke + f.count.fill;
    }
    expect(front).toBeGreaterThan(0);
  });
});

describe('estela fugaz de los arcos de colores', () => {
  it('en el logo plano no hay estela: los arcos son los parejos del dibujo de marca', () => {
    expect(poseAt(0, false).comet).toBe(0);
    expect(poseAt(99, true).comet).toBe(0);
    for (const t of [0, 0.3, 1.5, 3]) for (const v of [0, 0.5, 1]) {
      expect(cometWidth(v, poseAt(t, false).comet)).toBeGreaterThan(0.99 - poseAt(t, false).comet);
    }
    for (const t of [0, 0.2, 1]) expect(cometAlpha(0.7, 0)).toBe(1);
    expect(cometWidth(1, 0)).toBe(1);
  });

  it('la estela crece de 0 a 1 a medida que se despliegan los arcos, sin saltos', () => {
    let prev = 0;
    for (let t = 0; t <= TRANSITION_S + 1; t += 0.05) {
      const c = poseAt(t, false).comet;
      expect(c).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(c - prev).toBeLessThan(0.05);
      prev = c;
    }
    expect(poseAt(STAGES.arcs.delay + 0.2, false).comet).toBeLessThan(0.05);
    expect(poseAt(TRANSITION_S + 5, false).comet).toBe(1);
  });

  it('con estela completa: la cabeza es plena, la cola se afina y se desvanece hasta nada, y siempre de forma monótona', () => {
    expect(cometWidth(0, 1)).toBe(1);
    expect(cometAlpha(0, 1)).toBe(1);
    expect(cometAlpha(1, 1)).toBeCloseTo(0, 9);
    expect(cometWidth(1, 1)).toBeLessThan(0.25);
    expect(cometWidth(1, 1)).toBeGreaterThan(0.1); // queda un hilo, no desaparece de golpe
    let w = 2, a = 2;
    for (let t = 0; t <= 1; t += 0.02) {
      expect(cometWidth(t, 1)).toBeLessThanOrEqual(w);
      expect(cometAlpha(t, 1)).toBeLessThanOrEqual(a);
      w = cometWidth(t, 1);
      a = cometAlpha(t, 1);
    }
  });

  it('la opacidad cae más rápido que el ancho cerca de la punta (estela fugaz) y una estela a medias queda entre ambos extremos', () => {
    expect(cometAlpha(0.9, 1)).toBeLessThan(cometWidth(0.9, 1));
    const half = cometAlpha(1, 0.5);
    expect(half).toBeGreaterThan(cometAlpha(1, 1));
    expect(half).toBeLessThan(cometAlpha(1, 0));
  });

  it('dibuja con estela sin errores en cualquier instante y no gasta trazos en la punta invisible de la cola', () => {
    const flat = fakeCtx(), flatFront = fakeCtx();
    drawScene(flat.ctx, flatFront.ctx, 300, 0, false);
    const full = fakeCtx(), fullFront = fakeCtx();
    drawScene(full.ctx, fullFront.ctx, 300, TRANSITION_S + 2, false);
    const flatStrokes = flat.count.stroke + flatFront.count.stroke;
    const fullStrokes = full.count.stroke + fullFront.count.stroke;
    expect(flatStrokes).toBeGreaterThan(100);
    // mismo reparto de tramos, pero los de la punta de la cola (opacidad ~0) se omiten
    expect(fullStrokes).toBeLessThanOrEqual(flatStrokes);
    expect(fullStrokes).toBeGreaterThan(flatStrokes * 0.7);
    for (let t = 0; t < 40; t += 0.7) {
      const b = fakeCtx(), f = fakeCtx();
      expect(() => drawScene(b.ctx, f.ctx, 420, t, false)).not.toThrow();
    }
  });
});

describe('plano de la marca y orden de profundidad', () => {
  const D = 488;
  const u = 420 / 228;

  it('sin giro: lo que tiene z>0 está delante y z<0 detrás', () => {
    const plane = markPlane({ a: 0, b: 0, ty: 0 }, u);
    near(plane.n, [0, 0, 1]);
    expect(isFront(plane, D, [40, -30, 10])).toBe(true);
    expect(isFront(plane, D, [40, -30, -10])).toBe(false);
  });

  it('con la marca girada, la deducción coincide con proyectar de verdad un punto del plano', () => {
    for (const mark of [{ a: -14, b: 4, ty: 0 }, { a: 14, b: -4, ty: -6 }, { a: 9, b: 2, ty: -2.5 }]) {
      const plane = markPlane(mark, u);
      const r = mul(rotAxis([0, 1, 0], deg(mark.a)), rotAxis([1, 0, 0], deg(mark.b)));
      for (const [x, y] of [[-60, -45], [0, 0], [80, 45], [80, -45], [-60, 45]]) {
        // punto de la marca (z=0 en su plano local) ya en el mundo
        const onPlane = apply(r, [x, y + mark.ty / u, 0]);
        const f = D / (D - onPlane[2]);
        // un punto en el mismo rayo de la cámara, un poco más cerca / más lejos que la marca
        const ray = (dz: number): V3 => {
          const z = onPlane[2] + dz;
          const k = (D - z) / (D - onPlane[2]);
          return [onPlane[0] * k, onPlane[1] * k, z];
        };
        expect(f).toBeGreaterThan(0);
        expect(isFront(plane, D, ray(+2))).toBe(true);
        expect(isFront(plane, D, ray(-2))).toBe(false);
      }
    }
  });

  it('con el plano de canto no revienta y decide por z', () => {
    const plane = { n: [1, 0, 0] as V3, o: [0, 0, 0] as V3 };
    expect(typeof isFront(plane, D, [0, 0, 5])).toBe('boolean');
  });
});

/** Contexto 2D falso que solo cuenta lo que se dibuja. */
function fakeCtx() {
  const count = { stroke: 0, fill: 0, arc: 0 };
  const grad = () => ({ addColorStop() {} });
  const ctx = new Proxy({}, {
    get: (_t, k) => {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return grad;
      if (k === 'stroke') return () => { count.stroke++; };
      if (k === 'fill') return () => { count.fill++; };
      if (k === 'arc') return () => { count.arc++; };
      return () => {};
    },
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, count };
}

describe('drawScene', () => {
  it('dibuja sin errores en muchos instantes, en reposo y en movimiento', () => {
    for (const reduced of [true, false]) {
      for (let t = 0; t < 60; t += 1.7) {
        const back = fakeCtx(), front = fakeCtx();
        expect(() => drawScene(back.ctx, front.ctx, 300, t, reduced)).not.toThrow();
        expect(back.count.stroke + back.count.fill).toBeGreaterThan(50);
      }
    }
  });

  it('reparte las piezas entre los canvas de detrás y de delante de la marca al girar', () => {
    let sawFront = false;
    for (let t = 0; t < 30; t += 0.5) {
      const back = fakeCtx(), front = fakeCtx();
      drawScene(back.ctx, front.ctx, 420, t, false);
      if (front.count.stroke + front.count.fill > 0) sawFront = true;
    }
    expect(sawFront).toBe(true);
  });

  it('en reposo todo queda detrás de la marca, como el dibujo original', () => {
    const back = fakeCtx(), front = fakeCtx();
    drawScene(back.ctx, front.ctx, 420, 0, true);
    expect(front.count.stroke + front.count.fill + front.count.arc).toBe(0);
  });

  it('devuelve la pose para mover la marca', () => {
    const { ctx } = fakeCtx();
    const pose = drawScene(ctx, ctx, 240, at('mark', 3.5), false);
    expect(pose.mark.a).toBeCloseTo(14, 9);
  });
});
