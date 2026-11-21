/* Regresión del destello del logo 2D tras el banner de carga.
 *
 * El fallo: el logo estaba visible (y tapado por el banner) y, al retirarse este, el CSS le creaba una animación con opacidad.
 * Como el logo son canvas y capas aceleradas, podía pintarse un cuadro entero, a plena opacidad, antes de que la animación
 * lo ocultara: se veía el logo, desaparecía y volvía a entrar.
 *
 * La solución: el logo nace OCULTO como estado estático (ya en el HTML) y se muestra con una transición cuando la escena
 * le pone `data-shown`. Aquí se fija ese diseño leyendo el CSS y el HTML: un navegador real es lo único que ve el destello,
 * pero estas condiciones son las que lo hacen imposible. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const css = readFileSync(join(ROOT, 'src/styles/globals.css'), 'utf8');
const layout = readFileSync(join(ROOT, 'src/app/[locale]/layout.tsx'), 'utf8');

/** Cuerpo de la primera regla cuyo selector contiene `selector`. */
const rule = (selector: string): string | null => {
  const at = css.indexOf(selector);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
};

describe('entrada del logo tras el banner de carga', () => {
  it('el logo está oculto como estado estático mientras no se le muestre (no depende de que arranque una animación)', () => {
    const hidden = rule("html[data-boot] .hero__logo:not([data-shown])");
    expect(hidden).not.toBeNull();
    expect(hidden).toMatch(/opacity:\s*0\b/);
  });

  it('el estado oculto vale desde el primer pintado: se engancha a data-boot, que el HTML ya trae', () => {
    expect(layout).toMatch(/<html[^>]*data-boot="loading"/);
    // sin condición de "ready": no hay ningún momento intermedio en que el logo quede visible
    expect(css).not.toMatch(/html\[data-boot=['"]ready['"]\][^{]*\.hero__logo\s*\{[^}]*animation/);
  });

  it('aparece con una transición (no con una animación que haya que arrancar en el momento justo)', () => {
    const base = rule('.hero__logo { transition');
    expect(base).not.toBeNull();
    expect(base).toMatch(/opacity/);
    expect(base).toMatch(/transform/);
    expect(css).not.toMatch(/animation:\s*logo-in\b/);
    expect(css).not.toMatch(/@keyframes logo-in\b/);
  });

  it('tiene red de seguridad: sin script se ve, y si el script falla se muestra a los 10 s', () => {
    expect(css).toMatch(/@media \(scripting: none\)\s*\{[^@]*html\[data-boot\] \.hero__logo\s*\{[^}]*opacity:\s*1/);
    expect(css).toMatch(/html\[data-boot='loading'\] \.hero__logo:not\(\[data-shown\]\)\s*\{[^}]*animation:\s*logo-failsafe 0s linear 10s forwards/);
    expect(css).toMatch(/@keyframes logo-failsafe\s*\{\s*to\s*\{[^}]*opacity:\s*1/);
    // y también con "reducir movimiento", que apaga todas las animaciones
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{[^@]*logo-failsafe 0s linear 10s forwards !important/);
  });

  it('la duración de la transición coincide con la que usa la escena para fijar cuándo empieza el 3D', () => {
    const base = rule('.hero__logo { transition')!;
    expect(base).toMatch(/opacity 1\.2s/);
    const scene = readFileSync(join(ROOT, 'src/view/logoScene.ts'), 'utf8');
    expect(scene).toMatch(/const APPEAR_MS = 1200;/);
  });
});

const built = join(ROOT, 'out/es/index.html');
describe.skipIf(!existsSync(built))('build real (carpeta out/)', () => {
  const html = existsSync(built) ? readFileSync(built, 'utf8') : '';

  it('el HTML servido ya trae el banner y marca el logo como no mostrado', () => {
    expect(html).toMatch(/<html[^>]*data-boot="loading"/);
    expect(html).toContain('class="boot"');
    const wrap = /<div class="logo3d-wrap hero__logo"[^>]*>/.exec(html);
    expect(wrap).not.toBeNull();
    expect(wrap![0]).not.toContain('data-shown');
  });

  it('el CSS compilado conserva el estado oculto, la transición y la red de seguridad', () => {
    const chunk = readFileSync(join(ROOT, 'out', /\/(_next\/static\/[^"]*\.css)/.exec(html)![1]), 'utf8');
    expect(chunk).toMatch(/html\[data-boot\] \.hero__logo:not\(\[data-shown\]\)\{[^}]*opacity:0/);
    expect(chunk).toMatch(/\.hero__logo\{[^}]*transition:/);
    expect(chunk).toContain('logo-failsafe');
    expect(chunk).not.toContain('logo-in');
  });
});
