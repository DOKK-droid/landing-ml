// @vitest-environment jsdom
/* La barra de servicios seleccionados va arriba, justo debajo del menú (antes estaba abajo, al final de la página):
 * es hermana del encabezado y va antes del contenido, aparece al marcar un servicio y se va al limpiar la selección.
 * Su posición fija y su animación son CSS (no se miden aquí): se comprueba dónde está y qué hace en el DOM. */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/view/App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLElement;

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const click = (el: Element | null | undefined) => {
  if (!el) throw new Error('No se encontró el elemento a tocar');
  return act(async () => { (el as HTMLElement).click(); });
};
const tick = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  sessionStorage.clear();
  window.matchMedia = ((query: string) => ({
    matches: query.includes('reduced-motion'), media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = () => {};
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(createElement(App, { locale: 'es' })); });
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('barra de servicios seleccionados', () => {
  it('no se ve mientras no haya servicios marcados', () => {
    expect($('.selbar')).toBeNull();
  });

  it('al marcar un servicio aparece arriba: junto al encabezado y antes del contenido, no al final', async () => {
    await click($('#svc-ia .toggle'));
    const bar = $('.selbar')!;
    const header = $('header')!;
    const main = $('main')!;
    expect(bar).not.toBeNull();
    // hermana del encabezado (así queda fija debajo de él para toda la página) y no dentro de <main>
    expect(bar.parentElement).toBe(header.parentElement);
    expect(main.contains(bar)).toBe(false);
    // orden en el documento: encabezado → barra → contenido
    expect(header.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('muestra el conteo, permite limpiar y continuar, y se anuncia a los lectores de pantalla', async () => {
    await click($('#svc-ia .toggle'));
    const bar = $('.selbar')!;
    expect(bar.getAttribute('role')).toBe('region');
    expect(bar.getAttribute('aria-live')).toBe('polite');
    expect(bar.querySelector('.selbar__count')!.textContent).toMatch(/1/);
    expect(bar.querySelector('.link')).not.toBeNull();
    expect(bar.querySelector('.btn--primary')).not.toBeNull();
  });

  it('al limpiar la selección sale con su animación y se desmonta', async () => {
    await click($('#svc-ia .toggle'));
    await click($('.selbar .link'));
    expect($('.selbar')!.classList.contains('is-leaving')).toBe(true);
    await tick(330);
    expect($('.selbar')).toBeNull();
  });

  it('el botón de emergencia ya no necesita subir: no hay barra abajo que esquivar', async () => {
    await click($('#svc-ia .toggle'));
    const emergency = $('.emergency')!;
    expect(emergency.className).toBe('emergency');
  });

  it('al pasar al relevamiento la barra no se muestra', async () => {
    await click($('#svc-ia .toggle'));
    await click($('.selbar .btn--primary'));
    await tick(0);
    expect($('.selbar')).toBeNull();
  });
});
