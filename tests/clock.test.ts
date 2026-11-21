import { describe, expect, it } from 'vitest';
import { chase, makeEllipse, scrollProgress, visibleFraction } from '@/view/clock';

describe('scrollProgress', () => {
  const vh = 800;
  const h = 440;

  it('es 0 cuando la figura apenas asoma por abajo y antes', () => {
    expect(scrollProgress(vh * 0.95, h, vh)).toBe(0);
    expect(scrollProgress(vh * 1.4, h, vh)).toBe(0);
  });

  it('es 1 cuando el centro de la figura llega al 58 % de la pantalla y se queda en 1 después', () => {
    const top = vh * 0.58 - h / 2;
    expect(scrollProgress(top, h, vh)).toBeCloseTo(1, 10);
    expect(scrollProgress(top - 300, h, vh)).toBe(1);
    expect(scrollProgress(-2000, h, vh)).toBe(1);
  });

  it('crece de forma lineal y monótona con el scroll', () => {
    let prev = -1;
    for (let top = vh; top >= 0; top -= 20) {
      const p = scrollProgress(top, h, vh);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
    const a = scrollProgress(600, h, vh), b = scrollProgress(500, h, vh), c = scrollProgress(400, h, vh);
    expect(b - a).toBeCloseTo(c - b, 10);
  });

  it('al completarse la figura entera está en pantalla (no cortada por el borde)', () => {
    const top = vh * 0.58 - h / 2;
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + h).toBeLessThanOrEqual(vh);
    expect(visibleFraction(top, h, vh)).toBe(1);
  });

  it('no divide por cero con figuras más altas que la pantalla', () => {
    const p = scrollProgress(100, 5000, 600);
    expect(Number.isFinite(p)).toBe(true);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });
});

describe('visibleFraction', () => {
  it('mide cuánto de la figura está dentro de la ventana', () => {
    expect(visibleFraction(0, 400, 800)).toBe(1);
    expect(visibleFraction(600, 400, 800)).toBeCloseTo(0.5, 10);
    expect(visibleFraction(-200, 400, 800)).toBeCloseTo(0.5, 10);
    expect(visibleFraction(900, 400, 800)).toBe(0);
    expect(visibleFraction(-500, 400, 800)).toBe(0);
    expect(visibleFraction(0, 0, 800)).toBe(0);
  });
});

describe('chase', () => {
  it('nunca pasa del objetivo ni avanza más que vmax por segundo', () => {
    let v = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 400; i++) {
      const next = chase(v, 1, dt, 0.85);
      expect(next - v).toBeLessThanOrEqual(0.85 * dt + 1e-12);
      expect(next).toBeLessThanOrEqual(1);
      v = next;
    }
    expect(v).toBe(1);
  });

  it('una llegada de golpe (ancla) da la vuelta completa en un tiempo visible, no salta', () => {
    let v = 0;
    let frames = 0;
    while (v < 1 && frames < 1000) { v = chase(v, 1, 1 / 60, 0.85); frames++; }
    expect(frames / 60).toBeGreaterThan(1);
    expect(frames / 60).toBeLessThan(3);
  });

  it('puede retroceder, y con un salto de tiempo enorme no se pasa', () => {
    expect(chase(0.8, 0.2, 1 / 60, 0.85)).toBeLessThan(0.8);
    expect(chase(0, 1, 5, 0.85)).toBeLessThanOrEqual(1);
    expect(chase(0.9995, 1, 1 / 60, 0.85)).toBe(1);
  });
});

describe('makeEllipse', () => {
  const a = 170;
  const b = 178;
  const e = makeEllipse(a, b);

  it('parte de las 12 y avanza en sentido horario por los cuatro cuartos', () => {
    const at = (p: number) => e.at(p);
    expect(at(0).x).toBeCloseTo(0, 6);
    expect(at(0).y).toBeCloseTo(-b, 6);
    expect(at(0.25).x).toBeCloseTo(a, 1);
    expect(at(0.25).y).toBeCloseTo(0, 1);
    expect(at(0.5).y).toBeCloseTo(b, 1);
    expect(at(0.75).x).toBeCloseTo(-a, 1);
    expect(at(1).y).toBeCloseTo(-b, 6);
  });

  it('el perímetro coincide con la aproximación de Ramanujan', () => {
    const h = ((a - b) / (a + b)) ** 2;
    const ramanujan = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    expect(e.perimeter).toBeCloseTo(ramanujan, 1);
  });

  it('recorre el perímetro a ritmo uniforme (misma distancia por el mismo paso), aunque no sea un círculo', () => {
    const wide = makeEllipse(200, 80);
    const step = 1 / 200;
    const chords: number[] = [];
    for (let i = 0; i < 200; i++) {
      const p = wide.at(i * step), q = wide.at((i + 1) * step);
      chords.push(Math.hypot(q.x - p.x, q.y - p.y));
    }
    const mean = chords.reduce((s, c) => s + c, 0) / chords.length;
    for (const c of chords) expect(Math.abs(c - mean) / mean).toBeLessThan(0.02);
  });

  it('fuera de rango se queda en los extremos', () => {
    expect(e.at(-1)).toEqual(e.at(0));
    expect(e.at(7).y).toBeCloseTo(e.at(1).y, 6);
  });
});
