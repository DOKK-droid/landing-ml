/* La marca ML: la estela. La primera pata de la M hace de palo de OTRA L, sombra de la que forman la última pata y su pie. El pie de
 * esa L ES la propia pata prolongada (macizo y del mismo metal al salir de ella), gira con un corte seco —sin curva— al final y baja
 * por una diagonal de sombra paralela a la segunda diagonal de la M, por debajo del renglón de la base, apagándose en punta.
 * UN solo degradado continuo recorre todo: la pata ya teñida de lila → violeta del logotipo → meseta en la esquina → violeta profundo y se
 * apaga en la diagonal. Es una SOMBRA: oscura, sin brillos blancos. La M es de cromo (horizonte oscuro marcado y reflejos).
 * Se prueba el marcado: forma, esquina viva, continuidad del degradado en el corte, orden de capas, profundidad (paralaje),
 * referencias, ids únicos y que no haya estilos en línea (la CSP no los admite). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VIOLET as SCENE_VIOLET, apply, mul, rotAxis } from '@/view/logoScene';
import {
  A1, BASE_Y, CORNER_X, DIAG, FLOW_OVER, FLOW_X0, FOOT_BOTTOM, FOOT_TOP, H2, JUNCTION_TINT, LEG, LEG_STOPS, LEG_TINT, NARROW_S, PLATEAU, PLATEAU_T, SOLID_S, START, TRAIL,
  VIOLET, VIOLET_DEEP, VIOLET_S, legTone, mitre, onDiag, tintedLeg, trailColorAt, trailFlowPath, trailParallax,
} from '@/view/logoTrail';
import { Logo } from '@/view/components/Logo';

const mark = () => renderToStaticMarkup(createElement(Logo, { variant: 'mark' }));
const hero = () => renderToStaticMarkup(createElement(Logo, { variant: 'hero' }));
const flowing = () => renderToStaticMarkup(createElement(Logo, { variant: 'mark', flow: true }));
const css = readFileSync(join(__dirname, '..', 'src/styles/globals.css'), 'utf8');

type Pt = [number, number];
const polys = (svg: string, cls: string): Pt[][] =>
  [...svg.matchAll(new RegExp(`class="${cls}" points="([^"]+)"`, 'g'))].map((m) => m[1].split(' ').map((p) => p.split(',').map(Number) as Pt));
const dashes = (svg: string) =>
  [...svg.matchAll(/class="logo__trail-spark" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"[^>]*stroke-width="([^"]+)"/g)].map((m) => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], w: +m[5] }));

/** Paradas de un degradado por su nombre (sin el sufijo único de cada instancia): [color RGB, opacidad, desplazamiento]. */
const stops = (svg: string, name: string) => {
  const block = new RegExp(`<linearGradient id="${name}-[^"]+"[^>]*>([\\s\\S]*?)</linearGradient>`).exec(svg)![1];
  return [...block.matchAll(/<stop offset="([^"]+)" stop-color="#([0-9a-f]{6})"(?: stop-opacity="([^"]+)")?/gi)].map((m) => ({
    offset: +m[1],
    rgb: [0, 2, 4].map((i) => parseInt(m[2].slice(i, i + 2), 16)),
    opacity: m[3] === undefined ? 1 : Number(m[3]),
  }));
};

const LEG_EDGE = LEG; // borde derecho de la primera pata de la M
const L_EDGE = 83; // borde izquierdo de la L real
const N = TRAIL.length;
const byY = [...TRAIL].sort((a, b) => a.y - b.y);
const cross = (a: readonly number[], b: readonly number[]) => a[0] * b[1] - a[1] * b[0];
const sub = (a: readonly number[], b: readonly number[]): Pt => [a[0] - b[0], a[1] - b[1]];
/** Luminancia relativa (0–1) de un color [r, g, b] 0–255. */
const lum = (rgb: readonly number[]) => {
  const [r, g, b] = rgb.map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const num = (re: RegExp, text: string) => Number(re.exec(text)![1]);
const hexRgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16));

describe('el pie de la estela: la pata prolongada', () => {
  it('en el borde de la pata las franjas cubren TODO el alto del pie (y 83–100), una sobre otra y sin rendijas', () => {
    expect([FOOT_TOP, FOOT_BOTTOM]).toEqual([83, 100]);
    expect(mark()).toContain('points="83,100 100,83 146,83 146,100"'); // el pie de la L real: la misma altura
    expect(byY[0].y - byY[0].pitch / 2).toBeCloseTo(FOOT_TOP, 6);
    expect(byY.at(-1)!.y + byY.at(-1)!.pitch / 2).toBeCloseTo(FOOT_BOTTOM, 6);
    for (let i = 1; i < N; i++) expect(byY[i].y - byY[i].pitch / 2, `franjas ${i - 1} y ${i}`).toBeCloseTo(byY[i - 1].y + byY[i - 1].pitch / 2, 1);
    for (const [i, poly] of polys(mark(), 'logo__trail').entries()) {
      const start = poly.filter(([x]) => x === START).map(([, y]) => y);
      expect(Math.max(...start) - Math.min(...start), `línea ${i}`).toBeCloseTo(TRAIL[i].pitch, 1);
    }
  });

  it('cada línea nace DENTRO de la pata (allí es de su color y no se nota), es maciza hasta SOLID_S y ya tiene su grosor final en NARROW_S', () => {
    expect(START).toBeLessThan(LEG_EDGE);
    for (const [i, poly] of polys(mark(), 'logo__trail').entries()) {
      const xs = poly.map(([x]) => x);
      expect(xs.filter((x) => x === START), `línea ${i}: borde de arranque`).toHaveLength(2);
      expect(xs).toContain(START + SOLID_S);
      expect(xs).toContain(START + NARROW_S);
      const thin = poly.filter(([x]) => x === START + NARROW_S).map(([, y]) => y);
      expect(Math.max(...thin) - Math.min(...thin), `línea ${i}: grosor final`).toBeCloseTo(TRAIL[i].h, 1);
    }
  });

  it('más allá se afinan y se abren rendijas entre ellas: líneas finas y juntas, no una cuña gruesa', () => {
    for (let i = 1; i < N; i++) {
      const gap = byY[i].y - byY[i].h / 2 - (byY[i - 1].y + byY[i - 1].h / 2);
      expect(gap, `entre las líneas ${i - 1} y ${i}`).toBeGreaterThan(0.3);
      expect(gap).toBeLessThan(1.3);
    }
    for (const l of TRAIL) expect(l.h).toBeLessThan(l.pitch);
    expect(byY.reduce((s, l) => s + l.h, 0) / (FOOT_BOTTOM - FOOT_TOP)).toBeGreaterThan(0.6);
  });
});

describe('la diagonal de sombra: corte seco, hacia abajo, bajo el renglón', () => {
  it('el pie gira en una esquina VIVA (inglete), sin curva: los cortes de las dos piezas están sobre la bisectriz de la esquina', () => {
    const svg = mark();
    const feet = polys(svg, 'logo__trail'), diags = polys(svg, 'logo__trail-diag');
    const bis = sub(mitre(1), mitre(0)); // dirección de la bisectriz (la misma para toda línea)
    for (let i = 0; i < N; i++) {
      const foot = feet[i], diag = diags[i];
      const [a, b] = [foot[3], foot[4]]; // el corte de la pieza de la base: los dos vértices de la esquina
      for (const p of [a, b]) expect(Math.abs(cross(sub(p, [CORNER_X, BASE_Y]), bis)), `línea ${i}: sobre la bisectriz`).toBeLessThan(0.1);
      // la pieza de la diagonal arranca exactamente en el mismo corte: no hay hueco ni solapamiento
      expect(diag[0]).toEqual(a);
      expect(diag.at(-1)).toEqual(b);
      // y las dos tienen pocos vértices: son rectas (una curva necesitaría decenas)
      expect(foot.length).toBeLessThanOrEqual(8);
      expect(diag.length).toBeLessThanOrEqual(8);
    }
    expect(svg).not.toMatch(/ d="[^"]*[ACQSTacqst]/); // y ninguno de los trazos de la estela usa curvas
  });

  it('es paralela a la segunda diagonal de la M, pero BAJA (la de la M sube): los lados de cada pieza llevan su inclinación', () => {
    for (const [i, diag] of polys(mark(), 'logo__trail-diag').entries()) {
      const side = sub(diag[1], diag[0]); // del corte al comienzo del afilado, por arriba
      expect(Math.abs(cross(side, DIAG.d)) / Math.hypot(...side), `línea ${i}: paralela a la diagonal`).toBeLessThan(0.01);
      expect(side[1], `línea ${i}: baja`).toBeGreaterThan(0);
      expect(side[0], `línea ${i}: hacia la izquierda`).toBeLessThan(0);
    }
    expect(H2[1]).toBeGreaterThan(0);
    expect(DIAG.d[1], 'la de la M sube').toBeLessThan(0);
    expect(H2[0] * DIAG.d[1] - H2[1] * DIAG.d[0], 'misma inclinación').toBeCloseTo(0, 9);
  });

  it('cruza el renglón de la base (y = 100) y sobresale del lienzo hacia el vacío; el lienzo no cambia de tamaño', () => {
    const svg = mark();
    const ys = polys(svg, 'logo__trail-diag').flat().map(([, y]) => y);
    expect(Math.max(...ys), 'baja bastante por debajo del renglón').toBeGreaterThan(FOOT_BOTTOM + 30);
    expect(svg).toContain('viewBox="-2 -2 150 104"'); // el lienzo del logo es el de siempre (y 102 abajo)
    expect(hero()).toContain('viewBox="-52 -64 228 228"');
    expect(css).toMatch(/\.logo__svg\s*\{[^}]*overflow:\s*visible/); // y deja ver lo que sobresale
    expect(svg).toMatch(/<svg class="logo__svg[^"]*" viewBox/);
  });

  it('no toca la L real: nada de la estela pasa de x = 78 (la L empieza en 83)', () => {
    const svg = mark();
    for (const cls of ['logo__trail', 'logo__trail-diag', 'logo__trail-foot', 'logo__trail-glow']) {
      for (const poly of polys(svg, cls)) expect(Math.max(...poly.map(([x]) => x)), cls).toBeLessThan(L_EDGE - 5);
    }
    for (const d of dashes(svg)) expect(Math.max(d.x1, d.x2)).toBeLessThan(L_EDGE - 5);
  });

  it('acaba en punta, como una estela: se afila hasta un solo vértice y las puntas quedan escalonadas', () => {
    const diags = polys(mark(), 'logo__trail-diag');
    TRAIL.forEach((l, i) => {
      const tip = diags[i][Math.floor(diags[i].length / 2)]; // el vértice del medio es la punta
      const expected = onDiag(l.len2, l.y - BASE_Y);
      expect(Math.hypot(tip[0] - expected[0], tip[1] - expected[1]), `línea ${i}`).toBeLessThan(0.05);
    });
    expect(new Set(TRAIL.map((l) => l.len2)).size, 'puntas escalonadas').toBeGreaterThanOrEqual(6);
  });

  it('los trazos con que se disuelve cada línea siguen su diagonal, pasada la punta', () => {
    const ds = dashes(mark());
    expect(ds).toHaveLength(TRAIL.reduce((s, l) => s + l.dashes, 0));
    for (const d of ds) {
      const owner = TRAIL.find((l) => {
        const a = onDiag(l.len2, l.y - BASE_Y);
        return Math.abs(cross(sub([d.x1, d.y1], a), H2)) < 0.1 && (d.x1 - a[0]) * H2[0] + (d.y1 - a[1]) * H2[1] > 0;
      });
      expect(owner, `trazo en (${d.x1}, ${d.y1})`).toBeDefined();
    }
  });
});

describe('UN solo degradado, de la pata a la punta', () => {
  it('nace con el color de la pata YA TEÑIDA a esa altura y a plena opacidad (sin costura) y llega al violeta del logotipo', () => {
    const svg = mark();
    TRAIL.forEach((l, i) => {
      const g = stops(svg, `st${i}`);
      const want = hexRgb(tintedLeg(l.y));
      g[0].rgb.forEach((c, n) => expect(Math.abs(c - want[n]), `línea ${i}: color de la pata teñida (canal ${n})`).toBeLessThanOrEqual(1));
      expect(g[0].opacity).toBe(1);
      expect(g[1].opacity).toBe(1);
      expect(g[1].rgb).toEqual(g[0].rgb);
      expect(g.at(-1)!.rgb, `línea ${i}: en la esquina es el violeta`).toEqual([...SCENE_VIOLET]);
      expect(g.at(-1)!.opacity).toBe(PLATEAU);
    });
  });

  it('en el corte las dos piezas valen LO MISMO (color y opacidad): la unión del degradado no se ve', () => {
    const svg = mark();
    const diag = stops(svg, 'sd');
    TRAIL.forEach((l, i) => {
      const foot = stops(svg, `st${i}`).at(-1)!;
      expect(foot.rgb).toEqual(diag[0].rgb);
      expect(foot.opacity).toBe(diag[0].opacity);
      expect(trailColorAt(l, A1 - 1e-6)).toEqual(trailColorAt(l, A1 + 1e-6));
    });
    // y alrededor del corte hay meseta: ±14,6 es lo que corre la esquina de las líneas de los extremos
    for (const l of TRAIL) for (const p of [A1 - 14.6, A1, A1 + PLATEAU_T]) expect(trailColorAt(l, p), `p = ${p}`).toEqual({ color: VIOLET, opacity: PLATEAU });
    expect(A1 - 14.6, 'la meseta ya empezó donde acaba el gris').toBeGreaterThanOrEqual(VIOLET_S);
  });

  it('de la pata al violeta es gradual (varias paradas, siempre en un sentido, sin saltos) y la diagonal se OSCURECE y se apaga suave hasta nada', () => {
    const svg = mark();
    TRAIL.forEach((_, i) => {
      const g = stops(svg, `st${i}`);
      const ramp = g.slice(1);
      expect(ramp.length, `línea ${i}: paradas en la mezcla`).toBeGreaterThanOrEqual(6);
      for (let c = 0; c < 3; c++) {
        const dir = Math.sign(ramp.at(-1)!.rgb[c] - ramp[0].rgb[c]);
        for (let k = 1; k < ramp.length; k++) expect(Math.sign(ramp[k].rgb[c] - ramp[k - 1].rgb[c]) * dir, `línea ${i}, canal ${c}, parada ${k}`).toBeGreaterThanOrEqual(0);
      }
      const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, n) => x - b[n]));
      const total = dist(ramp[0].rgb, ramp.at(-1)!.rgb);
      for (let k = 1; k < ramp.length; k++) expect(dist(ramp[k - 1].rgb, ramp[k].rgb) / total, `línea ${i}, paso ${k}`).toBeLessThanOrEqual(0.4);
      const offs = g.map((s) => s.offset);
      expect(offs[0]).toBe(0);
      expect(offs.at(-1)).toBe(1);
      for (let k = 1; k < offs.length; k++) expect(offs[k]).toBeGreaterThan(offs[k - 1]);
    });
    const sd = stops(svg, 'sd');
    const ops = sd.map((s) => s.opacity);
    expect(ops[0]).toBe(PLATEAU);
    expect(ops.at(-1)).toBe(0);
    for (let k = 1; k < ops.length; k++) {
      expect(ops[k]).toBeLessThanOrEqual(ops[k - 1]); // solo baja
      expect(ops[k - 1] - ops[k], `apagado, paso ${k}`).toBeLessThanOrEqual(0.4);
    }
    expect(sd.length).toBeGreaterThanOrEqual(7);
    // es una sombra: arranca en el violeta del logotipo y se oscurece, sin pasar nunca a un tono más claro
    expect(sd[0].rgb).toEqual([...SCENE_VIOLET]);
    expect(sd.at(-1)!.rgb).toEqual(hexRgb(VIOLET_DEEP));
    for (let k = 1; k < sd.length; k++) expect(lum(sd[k].rgb), `parada ${k}`).toBeLessThanOrEqual(lum(sd[k - 1].rgb) + 1e-9);
  });

  it('el degradado de la pieza que baja corre a lo largo de la diagonal; el de la base, de la pata a la esquina (horizontal)', () => {
    const svg = mark();
    const vec = (name: string) => {
      const m = new RegExp(`<linearGradient id="${name}-[^"]+" gradientUnits="userSpaceOnUse" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"`).exec(svg)!;
      return [+m[3] - +m[1], +m[4] - +m[2]] as Pt;
    };
    const sd = vec('sd');
    expect(Math.abs(cross(sd, DIAG.d)) / Math.hypot(...sd), 'a lo largo de la diagonal').toBeLessThan(0.01);
    expect(sd[1]).toBeGreaterThan(0); // baja
    for (let i = 0; i < N; i++) {
      const st = vec(`st${i}`);
      expect(st[1], `línea ${i}: horizontal`).toBe(0);
      expect(st[0]).toBeCloseTo(A1, 1);
    }
  });

  it('la pata es de CROMO: claro arriba, un horizonte oscuro bien marcado hacia el 50 % y un reflejo más claro abajo; legTone lo interpola', () => {
    expect(stops(mark(), 'g1').map((s) => s.rgb)).toEqual(LEG_STOPS.map(([, c]) => hexRgb(c)));
    expect(legTone(0)).toBe(LEG_STOPS[0][1]);
    expect(legTone(100)).toBe(LEG_STOPS.at(-1)![1]);
    const horizon = LEG_STOPS.reduce((m, st) => (lum(hexRgb(st[1])) < lum(hexRgb(m[1])) ? st : m));
    expect(horizon[0], 'el horizonte está hacia la mitad').toBeGreaterThanOrEqual(0.4);
    expect(horizon[0]).toBeLessThanOrEqual(0.6);
    expect(legTone(horizon[0] * 100)).toBe(horizon[1]);
    expect(lum(hexRgb(LEG_STOPS[0][1])) / lum(hexRgb(horizon[1])), 'contraste de cromo').toBeGreaterThan(6);
    expect(lum(hexRgb(LEG_STOPS.at(-1)![1])), 'y abajo un reflejo más claro que el horizonte').toBeGreaterThan(lum(hexRgb(horizon[1])) * 2);
  });

  it('las diagonales de la M también son de cromo (mismo horizonte oscuro marcado) y la pata lleva un reflejo especular en su borde', () => {
    const svg = mark();
    for (const name of ['g2', 'g3']) {
      const g = stops(svg, name);
      const lums = g.map((st) => lum(st.rgb));
      expect(Math.max(...lums) / Math.min(...lums), `${name}: contraste de cromo`).toBeGreaterThan(6);
      const i = lums.indexOf(Math.min(...lums));
      expect(g[i].offset, `${name}: horizonte hacia la mitad`).toBeGreaterThanOrEqual(0.4);
      expect(g[i].offset).toBeLessThanOrEqual(0.6);
    }
    expect(svg).toContain('class="logo__chrome-edge"');
    expect(svg).toMatch(/<path d="M17 0L50 58L83 0" fill="none" stroke="#fff"/); // el filo claro de las diagonales
  });

  it('el lila ENTRA en la pata: un velo violeta, centrado donde sale el pie, que se mezcla con ella; las líneas arrancan de ese mismo color', () => {
    const svg = mark();
    const leg = 'points="0,0 17,29.9 17,100 0,100"';
    const tint = svg.includes(`<polygon class="logo__leg-tint" ${leg} fill="url(#lt-`);
    expect(tint, 'el velo usa la forma exacta de la pata: no se sale de ella').toBe(true);
    expect(svg.indexOf('class="logo__leg-tint"')).toBeGreaterThan(svg.indexOf(`${leg} fill="url(#g1-`));
    expect(svg.indexOf('class="logo__leg-tint"')).toBeLessThan(svg.indexOf('class="logo__trail-foot"'));
    expect(LEG_TINT.cx).toBe(LEG_EDGE);
    expect(LEG_TINT.cy).toBe(BASE_Y);
    expect(LEG_TINT.r, 'alcance: llega bien arriba en la pata').toBeGreaterThanOrEqual(50);
    // opacidad del velo a una distancia d del centro (interpolando sus paradas)
    const alphaAt = (d: number) => {
      const t = Math.min(1, d / LEG_TINT.r), st = LEG_TINT.stops;
      const i = Math.max(0, st.findIndex((s, k) => k === st.length - 1 || st[k + 1].offset >= t));
      const [a, b] = [st[i], st[Math.min(i + 1, st.length - 1)]];
      return b.offset === a.offset ? a.opacity : a.opacity + (b.opacity - a.opacity) * ((t - a.offset) / (b.offset - a.offset));
    };
    for (const y of [83, 91.5, 100]) expect(alphaAt(Math.hypot(0, y - BASE_Y)), `en la unión (y = ${y})`).toBeGreaterThan(JUNCTION_TINT - 0.05);
    expect(alphaAt(Math.hypot(LEG_EDGE - 8.5, BASE_Y - 55)), 'sube por la pata hasta cerca de la mitad').toBeGreaterThan(0.05);
    expect(alphaAt(LEG_TINT.r)).toBe(0);
    for (const st of LEG_TINT.stops) expect(st.color).toBe(VIOLET);
    // compuesto el velo (JUNCTION_TINT de violeta) sobre la pata da justo el color con que arrancan las líneas
    TRAIL.forEach((l) => {
      const base = hexRgb(legTone(l.y)), v = hexRgb(VIOLET), want = hexRgb(tintedLeg(l.y));
      base.forEach((c, n) => expect(Math.abs(c * (1 - JUNCTION_TINT) + v[n] * JUNCTION_TINT - want[n])).toBeLessThanOrEqual(1));
    });
  });

  it('el lila de la estela es EL del logotipo (el del medio de los arcos de la escena y el --violet del CSS), sin celestes ni otros lilas', () => {
    const hex = (rgb: readonly number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
    expect(VIOLET).toBe(hex(SCENE_VIOLET));
    expect(SCENE_VIOLET).toEqual([138, 60, 255]);
    expect(css).toMatch(new RegExp(`--violet:\\s*${VIOLET};`));
    const svg = mark();
    const trailDefs = [...svg.matchAll(/<linearGradient id="(?:st\d+|sd|bn|gl)-[^"]+"[\s\S]*?<\/linearGradient>/g)].map((m) => m[0]).join('');
    for (const other of ['#19c4f0', '#06a8e6', '#7df3ff', '#d6fcff', '#5f9bbd', '#a98bff', '#9a8fd6', '#f1eaff', '#8a7fc4', '#e2ceff']) expect(trailDefs).not.toContain(other);
    expect(trailDefs).toContain(VIOLET);
    expect(svg).toContain(`stroke="${VIOLET}"`);
  });

  it('es una SOMBRA: no hay brillos blancos (ni hilos claros ni filos) y todo lo de la estela es oscuro y violeta', () => {
    const svg = mark();
    const layers = svg.slice(svg.indexOf('class="logo__trail-foot"'), svg.indexOf('points="50,58 83,0 100,0 50,87.9"'));
    for (const white of ['#fff', '#ffffff', '#e2ceff', '#f1eaff', 'logo__trail-core', 'logo__trail-edge']) expect(layers, white).not.toContain(white);
    const all = [...svg.matchAll(/<linearGradient id="(?:st\d+|sd|bn|gl)-[^"]+"[\s\S]*?<\/linearGradient>/g)].map((m) => m[0]).join('');
    const colors = [...all.matchAll(/stop-color="(#[0-9a-f]{6})"/gi)].map((m) => hexRgb(m[1]));
    for (const c of colors) expect(Math.min(...c), `nada casi blanco: ${c}`).toBeLessThan(150);
    const diagLums = stops(svg, 'sd').map((st) => lum(st.rgb));
    expect(Math.max(...diagLums), 'la diagonal no es más clara que el violeta del logotipo').toBeLessThanOrEqual(lum([...SCENE_VIOLET]) + 1e-9);
  });

  it('el resplandor es violeta, difuso y no ensucia la pata', () => {
    const svg = mark();
    const [glow] = polys(svg, 'logo__trail-glow');
    const filterId = /class="logo__trail-glow"[^>]*filter="url\(#([^)]+)\)"/.exec(svg)![1];
    const sigma = +new RegExp(`<filter id="${filterId}"[^>]*><feGaussianBlur stdDeviation="([^"]+)"`).exec(svg)![1];
    expect(sigma).toBeGreaterThanOrEqual(1.5);
    expect(Math.min(...glow.map(([x]) => x)) - 3 * sigma, 'no llega a la pata').toBeGreaterThan(LEG_EDGE);
    const g = stops(svg, 'gl');
    expect(Math.max(...g.map((s) => s.opacity))).toBeGreaterThan(0.3);
    expect(g.at(-1)!.opacity).toBe(0);
  });
});

describe('capas y profundidad', () => {
  it('las capas: la pata, luego el fondo y el resplandor, luego las líneas, y por encima la M y la L', () => {
    const svg = mark();
    const leg = svg.indexOf('points="0,0 17,29.9 17,100 0,100" fill=');
    const band = svg.indexOf('class="logo__trail-foot"');
    const glow = svg.indexOf('class="logo__trail-glow"');
    const firstLayer = svg.indexOf('class="logo__trail-layer"');
    const lastLayer = svg.lastIndexOf('class="logo__trail-layer"');
    const diagonals = svg.indexOf('points="50,58 83,0 100,0 50,87.9"');
    const stem = svg.indexOf('points="83,42 100,12.1 100,83 83,100"');
    const realFoot = svg.indexOf('points="83,100 100,83 146,83 146,100"');
    expect(leg).toBeLessThan(band);
    expect(band).toBeLessThan(glow);
    expect(glow).toBeLessThan(firstLayer);
    for (const above of [diagonals, stem, realFoot]) expect(above).toBeGreaterThan(lastLayer);
  });

  it('hay una capa por línea, cada una con sus dos piezas; y cada una con su profundidad (delante y detrás del plano)', () => {
    const svg = mark();
    expect(svg.match(/class="logo__trail-layer"/g)).toHaveLength(N);
    for (const cls of ['logo__trail', 'logo__trail-diag']) expect(polys(svg, cls), cls).toHaveLength(N);
    const zs = [...svg.matchAll(/class="logo__trail-layer" data-z="(-?\d+)"/g)].map((m) => +m[1]);
    expect(zs).toEqual(TRAIL.map((l) => l.z));
    expect(zs.some((z) => z > 0) && zs.some((z) => z < 0)).toBe(true);
  });

  it('con el giro máximo (±14°) el arranque de cada línea sigue DENTRO de la pata y su parte maciza sigue cubriendo el borde: la unión nunca se abre', () => {
    for (const l of TRAIL) for (const a of [14, -14]) {
      const { dx } = trailParallax({ a, b: 4 }, l.z);
      expect(START + dx).toBeGreaterThan(0);
      expect(START + dx).toBeLessThan(LEG_EDGE - 1);
      expect(START + SOLID_S + dx).toBeGreaterThan(LEG_EDGE);
    }
  });

  it('el desplazamiento por profundidad es el que daría de verdad una línea a esa distancia (rotateY · rotateX de CSS)', () => {
    const rad = (d: number) => (d * Math.PI) / 180;
    for (const m of [{ a: 14, b: 4 }, { a: -14, b: 4 }, { a: 9, b: -3 }, { a: 0, b: 6 }, { a: -10, b: 0 }]) {
      for (const z of [-12, -4, 6, 13]) {
        const R = mul(rotAxis([0, 1, 0], rad(m.a)), rotAxis([1, 0, 0], rad(m.b)));
        const [sx, sy] = apply(R, [0, 0, z]);
        const { dx, dy } = trailParallax(m, z);
        const [px, py] = apply(R, [dx, dy, 0]);
        expect(px).toBeCloseTo(sx, 6);
        expect(py).toBeCloseTo(sy, 6);
      }
    }
  });

  it('sin giro, o sin profundidad, no hay desplazamiento; con giro lo de delante y lo de detrás se separan hacia lados opuestos', () => {
    expect(Math.abs(trailParallax({ a: 0, b: 0 }, 12).dx)).toBe(0);
    expect(trailParallax({ a: 14, b: 4 }, 0).dx).toBe(0);
    const near = trailParallax({ a: 14, b: 4 }, 10), far = trailParallax({ a: 14, b: 4 }, -10);
    expect(near.dx).toBeGreaterThan(0);
    expect(far.dx).toBeLessThan(0);
    expect(near.dx).toBeCloseTo(-far.dx, 9);
  });

  it('el filo claro de la L real queda entero: la estela no lo toca', () => {
    expect(mark()).toContain('d="M83 100V42M100 83H146"');
  });
});

describe('referencias del dibujo', () => {
  it('toda referencia url(#…) apunta a un id que existe, en la marca y en el logo del hero', () => {
    for (const svg of [mark(), hero()]) {
      const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
      const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(10);
      for (const ref of refs) expect(ids.has(ref), `falta #${ref}`).toBe(true);
    }
  });

  it('dos logos en la misma página no comparten ids (si no, uno pintaría con los degradados del otro)', () => {
    const both = renderToStaticMarkup(createElement('div', null, createElement(Logo, { variant: 'mark' }), createElement(Logo, { variant: 'mark' })));
    const all = [...both.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(all.length).toBeGreaterThan(36);
    expect(new Set(all).size).toBe(all.length);
  });

  it('no quedan restos de las versiones anteriores (reflejo, recorte, neblina, halo gris, chispas redondas, sombra curva o que sube)', () => {
    const svg = mark();
    for (const old of ['logo__trail-rim', 'logo__trail-mist', 'logo__trail-halo', 'logo__shadow', 'clipPath']) expect(svg).not.toContain(old);
    expect(svg).not.toMatch(/<circle class="logo__trail-spark"/);
  });

  it('el hero lleva la misma estela, y no hay estilos en línea (la CSP no los admite)', () => {
    expect(polys(hero(), 'logo__trail')).toHaveLength(N);
    expect(polys(hero(), 'logo__trail-diag')).toHaveLength(N);
    expect(mark()).not.toMatch(/\sstyle="/);
    expect(hero()).not.toMatch(/\sstyle="/);
  });
});

describe('los destellos de la estela (solo en el banner de carga)', () => {
  const rule = (selector: string) => {
    const at = css.indexOf(selector);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  };
  const flowPaths = (svg: string) => [...svg.matchAll(/<path class="(logo__flow(?:-glow)?)" d="([^"]+)" pathLength="1" stroke-width="([^"]+)"/g)].map((m) => ({ cls: m[1], d: m[2], w: +m[3] }));

  it('sin pedirlos (el encabezado, el pie, el inicio) el dibujo es el de siempre: no hay ni rastro de ellos', () => {
    for (const svg of [mark(), hero()]) expect(svg).not.toContain('logo__flow');
    expect(flowing().replace(/<path class="logo__flow(?:-glow)?"[^>]*><\/path>/g, '').replace(/id="([a-z0-9]+)-[^"]+"/g, '')).toBe(mark().replace(/id="([a-z0-9]+)-[^"]+"/g, ''));
  });

  it('cada línea lleva el suyo, y su halo más ancho; los dos recorren el eje de la línea', () => {
    const ps = flowPaths(flowing());
    expect(ps).toHaveLength(N * 2);
    TRAIL.forEach((l, i) => {
      const [glow, core] = [ps[i * 2], ps[i * 2 + 1]];
      expect([glow.cls, core.cls]).toEqual(['logo__flow-glow', 'logo__flow']);
      expect(glow.d).toBe(trailFlowPath(l));
      expect(core.d).toBe(trailFlowPath(l));
      expect(glow.w, `línea ${i}: el halo es más ancho`).toBeGreaterThan(core.w);
      expect(core.w, `línea ${i}: y el destello es del grosor de la línea, no más`).toBeLessThanOrEqual(Math.max(0.7, l.h));
    });
  });

  it('el eje va de la pata a más allá de la punta: recto por la base, esquina viva (la de la línea) y recto por la diagonal de sombra', () => {
    for (const l of TRAIL) {
      const o = l.y - BASE_Y;
      const pts = [...trailFlowPath(l).matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [+m[1], +m[2]] as Pt);
      expect(pts).toHaveLength(3);
      expect(trailFlowPath(l)).toMatch(/^M[\d. -]+L[\d. -]+L[\d. -]+$/); // solo rectas
      expect(pts[0][0], 'sale del borde de la pata').toBe(FLOW_X0);
      expect(FLOW_X0).toBe(LEG);
      expect(pts[0][1]).toBeCloseTo(l.y, 2);
      expect(pts[1][0]).toBeCloseTo(mitre(o)[0], 1);
      expect(pts[1][1]).toBeCloseTo(mitre(o)[1], 1);
      expect(pts[1][1], 'por la base: recto').toBeCloseTo(pts[0][1], 1);
      const tip = onDiag(l.len2 + FLOW_OVER, o);
      expect(pts[2][0]).toBeCloseTo(tip[0], 1);
      expect(pts[2][1]).toBeCloseTo(tip[1], 1);
      expect(Math.abs(cross(sub(pts[2], pts[1]), H2)) / Math.hypot(...sub(pts[2], pts[1])), 'baja por la diagonal de sombra').toBeLessThan(0.01);
      expect(Math.max(...pts.map(([x]) => x)), 'no toca la L real').toBeLessThan(L_EDGE - 5);
    }
    expect(FLOW_OVER, 'pasa de la punta hasta el polvo en que se disuelve').toBeGreaterThanOrEqual(5);
  });

  it('el destello no lleva colores en el marcado (los pone CSS: la CSP no admite estilos en línea) y respeta la sombra: nada blanco', () => {
    const svg = flowing();
    expect(svg).not.toMatch(/\sstyle="/);
    expect(svg).not.toMatch(/<path class="logo__flow[^>]*(stroke="|fill=)/);
    for (const sel of ['.logo__flow {', '.logo__flow-glow {']) {
      const r = rule(sel);
      expect(r, sel).not.toMatch(/#fff\b|#ffffff|white/i);
      const hex = /stroke:\s*#([0-9a-f]{6})/i.exec(r);
      if (hex) expect(Math.min(...hexRgb(`#${hex[1]}`)), sel).toBeLessThan(150);
    }
  });

  it('en reposo no se ven y solo se animan en el banner (.boot): ni el inicio ni la marca suelta los mueven', () => {
    expect(rule('.logo__flow, .logo__flow-glow {')).toMatch(/opacity:\s*0/);
    expect(rule('.logo__flow, .logo__flow-glow {')).toMatch(/stroke-dasharray:\s*var\(--l\)\s+4/);
    expect(rule('.boot .logo__flow, .boot .logo__flow-glow {')).toMatch(/animation:[^;]*flow-move[^;]*flow-fade/);
    expect(css.match(/animation:[^;]*flow-move/g)).toHaveLength(1);
    expect(css.match(/animation:\s*dust/g)).toHaveLength(1);
    expect(css).toMatch(/\.boot \.logo__trail-spark\s*\{\s*animation:\s*dust/);
  });

  it('corren y descansan: el recorrido termina más allá del final y el brillo se apaga justo cuando termina; con la misma duración las dos animaciones', () => {
    const kf = (name: string) => css.slice(css.indexOf(`@keyframes ${name}`), css.indexOf('\n}', css.indexOf(`@keyframes ${name}`)) + 2);
    const move = kf('flow-move'), fade = kf('flow-fade');
    expect(move).toMatch(/0%\s*\{\s*stroke-dashoffset:\s*var\(--l\)/); // antes del comienzo
    expect(move).toMatch(/46%,\s*100%\s*\{\s*stroke-dashoffset:\s*-1;/); // más allá del final (1): no queda resto sobre la punta
    expect(fade).toMatch(/0%\s*\{\s*opacity:\s*0/);
    expect(fade).toMatch(/46%,\s*100%\s*\{\s*opacity:\s*0/);
    const r = rule('.boot .logo__flow, .boot .logo__flow-glow {');
    expect(r).toMatch(/flow-move var\(--t\)/);
    expect(r).toMatch(/flow-fade var\(--t\)/);
    expect(r).toMatch(/calc\(var\(--w\) \* -1\)/); // el desfase es negativo: al abrirse el banner ya hay destellos en camino
    expect(r).toMatch(/infinite/);
  });

  it('cada línea con su ritmo (duración y desfase propios), para que no vayan a la vez', () => {
    const t: number[] = [], w: number[] = [];
    for (let i = 1; i <= N; i++) {
      const r = rule(`.boot .logo__trail-layer:nth-of-type(${i}) {`);
      t.push(num(/--t:\s*([\d.]+)s/, r));
      w.push(num(/--w:\s*([\d.]+)s/, r));
    }
    expect(new Set(t).size, 'duraciones distintas').toBeGreaterThanOrEqual(6);
    expect(new Set(w).size, 'desfases distintos').toBe(N);
    for (const x of t) { expect(x).toBeGreaterThanOrEqual(2); expect(x).toBeLessThanOrEqual(4); }
    expect(rule('.boot .logo__trail-layer {')).toMatch(/--t:\s*[\d.]+s;\s*--w:\s*0s/); // y un valor por omisión
  });

  it('con "reducir movimiento" no se mueve nada (la regla global apaga las animaciones) y los destellos, en reposo, son invisibles', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*, \*::before, \*::after\s*\{\s*animation:\s*none !important/);
  });
});

describe('el resplandor lila de la estela', () => {
  it('es más vivo que antes pero sigue siendo violeta, difuso y sin tocar la pata', () => {
    const svg = mark();
    const g = stops(svg, 'gl');
    expect(Math.max(...g.map((s) => s.opacity))).toBeGreaterThanOrEqual(0.6);
    for (const s of g) expect(s.rgb[2], 'violeta: el azul domina').toBeGreaterThan(s.rgb[0]);
  });
});
