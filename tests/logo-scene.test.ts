import { describe, expect, it } from 'vitest';
import { I3, apply, drawScene, isFront, markPlane, markTransform, mul, poseAt, rotAxis, type V3 } from '@/view/logoScene';

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

describe('pose', () => {
  it('con movimiento reducido todo queda en la posición de marca', () => {
    const p = poseAt(123.4, true);
    expect(p.ring).toEqual(I3);
    expect(p.dots).toEqual(I3);
    expect(p.arcA).toEqual(I3);
    expect(p.arcB).toEqual(I3);
    expect(p.mark).toEqual({ a: 0, b: 0, ty: 0 });
  });

  it('en t=0 el anillo está de frente y la marca arranca en su extremo (−14°, 4°, 0 px)', () => {
    const p = poseAt(0, false);
    for (let i = 0; i < 9; i++) expect(p.ring[i]).toBeCloseTo(I3[i], 9);
    expect(p.mark.a).toBeCloseTo(-14, 9);
    expect(p.mark.b).toBeCloseTo(4, 9);
    expect(p.mark.ty).toBeCloseTo(0, 9);
  });

  it('la marca oscila entre sus extremos con el periodo de 7 s', () => {
    expect(poseAt(3.5, false).mark.a).toBeCloseTo(14, 9);
    expect(poseAt(3.5, false).mark.ty).toBeCloseTo(-6, 9);
    expect(poseAt(7, false).mark.a).toBeCloseTo(-14, 9);
  });

  it('el anillo da la vuelta completa en 22 s sobre su eje (queda de canto a los 5,5 s)', () => {
    const edge = poseAt(5.5, false).ring;
    // la normal del anillo (z local) pasa a ser perpendicular a la mirada
    const n = apply(edge, [0, 0, 1]);
    expect(Math.abs(n[2])).toBeLessThan(0.02);
    // con el giro lento en su plano, la normal sigue sin depender de él
    const full = apply(poseAt(22, false).ring, [0, 0, 1]);
    near(full, [0, 0, 1], 6);
  });

  it('markTransform da el mismo orden de giros que el CSS', () => {
    expect(markTransform({ a: -14, b: 4, ty: -3 })).toBe('rotateY(-14.000deg) rotateX(4.000deg) translateY(-3.000px)');
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
    const pose = drawScene(ctx, ctx, 240, 3.5, false);
    expect(pose.mark.a).toBeCloseTo(14, 9);
  });
});
