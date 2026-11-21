'use client';
/* Banner de carga. Va en el HTML que sirve el sitio (se ve antes de que cargue el JavaScript) y se retira cuando está
 * todo listo: la hidratación de React, las tipografías y la carga de la página (estilos e imágenes), con un mínimo para
 * que no parpadee en cargas rápidas y un máximo por si algo se cuelga.
 *
 * Al retirarse marca <html data-boot="ready"> —lo que arranca la entrada del inicio— y avisa con `ml:ready`, que es la
 * señal para que el logo pase de 2D a 3D. Mientras tanto la entrada del inicio espera detrás del banner para que no
 * se pierda. Sin JavaScript el banner no se muestra y, si el script falla, una animación CSS lo oculta a los 10 s
 * (ver .boot en globals.css). Con "reducir movimiento" se retira sin transición. */
import { useEffect, useRef, useState } from 'react';
import { DICTIONARIES } from '@/model/i18n';
import type { Locale } from '@/model/types';
import { READY_EVENT } from '../logoScene';
import { prefersReducedMotion } from '../motion';
import { Logo } from './Logo';

/** Tiempo mínimo en la primera carga de la sesión; después, con todo en caché, casi no hace falta. */
const MIN_FIRST_MS = 650;
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
  const [phase, setPhase] = useState<'loading' | 'leaving' | 'gone'>('loading');

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
        <div className="boot__mark" aria-hidden="true">
          <svg className="boot__ring" viewBox="0 0 100 100">
            <circle className="boot__track" cx="50" cy="50" r="46" />
            <circle className="boot__arc" cx="50" cy="50" r="46" />
          </svg>
          <Logo className="boot__logo" />
        </div>
        <p className="boot__label">{d.label}</p>
        <div className="boot__bar" aria-hidden="true"><i ref={barRef} /></div>
      </div>
    </div>
  );
}
