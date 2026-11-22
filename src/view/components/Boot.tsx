'use client';
/* Banner de carga. Va en el HTML que sirve el sitio (se ve antes de que cargue el JavaScript) y se retira cuando está
 * todo listo: la hidratación de React, las tipografías y la carga de la página (estilos e imágenes), con un mínimo para
 * que no parpadee en cargas rápidas y un máximo por si algo se cuelga.
 *
 * Al retirarse marca <html data-boot="ready"> —lo que arranca la entrada del inicio— y avisa con `ml:ready`, que es la
 * señal para que el logo pase de 2D a 3D. Mientras tanto la entrada del inicio espera detrás del banner para que no
 * se pierda. Sin JavaScript el banner no se muestra y, si el script falla, una animación CSS lo oculta a los 10 s
 * (ver .boot en globals.css). Con "reducir movimiento" se retira sin transición.
 *
 * El banner muestra el mismo globo que gira detrás del logo en el inicio (el círculo de alrededor ES el globo, dibujado con el mismo
 * código: view/logoScene.ts) y el barrido de ML (view/logoSweep.ts): el logo aparece con un barrido que empieza por la estela y sigue sus trazos
 * hasta la punta de la L y se borra con otro igual que arranca antes de que el primero termine, en bucle: intermitente y fluido. La estela, mientras tanto, lleva destellos que corren por sus líneas. */
import { useEffect, useRef, useState } from 'react';
import { DICTIONARIES } from '@/model/i18n';
import type { Locale } from '@/model/types';
import { OUT_DONE, startSweep } from '../logoSweep';
import { READY_EVENT, startGlobe } from '../logoScene';
import { prefersReducedMotion } from '../motion';
import { Logo } from './Logo';

/**
 * Tiempo mínimo en la primera carga de la sesión: el justo para ver UN ciclo entero del logo (aparece y se borra: `OUT_DONE` en
 * view/logoSweep.ts); después, con todo en caché, casi no hace falta. Si la carga tarda más, el ciclo se repite.
 */
export const MIN_FIRST_MS = Math.ceil((OUT_DONE + 60) / 100) * 100;
const MIN_RETURN_MS = 120;
/** Si algo no termina (una fuente que no llega), el banner se retira igual. Menos que la red de seguridad de CSS (10 s). */
const MAX_MS = 8000;
/** Pausa para que la barra se vea llena antes de retirar el banner, y duración de su salida (ver .boot.is-leaving). */
const FILL_MS = 220;
const EXIT_MS = 560;
const SEEN_KEY = 'ml-booted';

export function Boot({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale].boot;
  const barRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'gone'>('loading');
  const gone = phase === 'gone';

  // El globo gira mientras el banner está a la vista; al retirarse se detiene (el componente sigue montado, sin pintar nada).
  useEffect(() => {
    const box = markRef.current, canvas = globeRef.current;
    if (gone || !box || !canvas) return;
    return startGlobe(box, canvas);
  }, [gone]);

  // El logo aparece con un barrido y se borra con otro que arranca antes de que el primero termine, en bucle; se detiene igual.
  useEffect(() => {
    const box = markRef.current;
    if (gone || !box) return;
    return startSweep(box);
  }, [gone]);

  useEffect(() => {
    const html = document.documentElement;
    const bar = barRef.current;
    const reduced = prefersReducedMotion();
    const timers: number[] = [];
    let alive = true;
    let ended = false;

    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch { /* sin almacenamiento: se trata como primera carga */ }

    const progress = (v: number) => bar?.style.setProperty('--p', Math.min(1, v).toFixed(3));
    const onLoad = new Promise<void>((resolve) => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', () => resolve(), { once: true });
    });
    const tasks: Promise<unknown>[] = [
      document.fonts ? document.fonts.ready : Promise.resolve(),
      onLoad,
      new Promise<void>((resolve) => { timers.push(window.setTimeout(resolve, seen ? MIN_RETURN_MS : MIN_FIRST_MS)); }),
    ];

    // La barra avanza con lo que se va completando: hidratación (esto mismo), tipografías, carga y tiempo mínimo.
    let done = 0;
    progress(1 / (tasks.length + 1));
    for (const t of tasks) t.then(() => { if (alive && !ended) progress((1 + ++done) / (tasks.length + 1)); });

    const reveal = () => {
      if (!alive) return;
      html.dataset.boot = 'ready';
      window.dispatchEvent(new Event(READY_EVENT));
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* idem */ }
      if (reduced) { setPhase('gone'); return; }
      setPhase('leaving');
      timers.push(window.setTimeout(() => setPhase('gone'), EXIT_MS));
    };
    const finish = () => {
      if (!alive || ended) return;
      ended = true;
      progress(1);
      if (reduced) reveal(); else timers.push(window.setTimeout(reveal, FILL_MS));
    };

    Promise.all(tasks).then(finish);
    timers.push(window.setTimeout(finish, MAX_MS));
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  if (phase === 'gone') return null;
  return (
    <div className={`boot${phase === 'leaving' ? ' is-leaving' : ''}`} role="status" aria-live="polite">
      <div className="boot__inner">
        <div className="boot__mark" ref={markRef} aria-hidden="true">
          <canvas ref={globeRef} className="logo3d__cv" />
          <div className="boot__ml">
            <Logo className="boot__logo" flow sweep="hidden" />
          </div>
        </div>
        <p className="boot__label">{d.label}</p>
        <div className="boot__bar" aria-hidden="true"><i ref={barRef} /></div>
      </div>
    </div>
  );
}
