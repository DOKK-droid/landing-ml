'use client';
/* VISTA — Utilidades de movimiento: preferencias del usuario, aparición al hacer scroll y salida animada.
 * Todo es mejora progresiva: sin JavaScript o con "reducir movimiento" el contenido se ve completo y sin animar. */
import { useEffect, useRef, useState } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';
/** Puntero preciso con hover (mouse, trackpad). En táctil el detalle se abre con botón. */
const HOVER = '(hover: hover) and (pointer: fine)';

function matches(query: string): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

export const prefersReducedMotion = () => matches(REDUCED);
export const hasHover = () => matches(HOVER);

/** Comportamiento para scrollIntoView: respeta "reducir movimiento" (el CSS no alcanza a las llamadas explícitas). */
export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');

/**
 * Anima la entrada de los elementos `[data-reveal]` que están debajo del pliegue.
 * Los que ya se ven al cargar no se tocan (evita el parpadeo); el resto espera a entrar en pantalla.
 * `--rd` en el elemento define el retraso (escalonado).
 */
export function useReveal(active: boolean): void {
  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return;

    const limit = window.innerHeight * 0.95;
    const pending = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
      (el) => el.getBoundingClientRect().top > limit,
    );
    if (!pending.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          io.unobserve(el);
          el.classList.remove('reveal-pending');
          el.classList.add('reveal-in');
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 },
    );
    for (const el of pending) {
      el.classList.add('reveal-pending');
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const el of pending) el.classList.remove('reveal-pending');
    };
  }, [active]);
}

/**
 * Mantiene montado un elemento `exitMs` después de ocultarlo, para poder animar la salida.
 * `leaving` es true durante esa ventana.
 */
export function usePresence(show: boolean, exitMs: number): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [show, exitMs]);
  return { mounted: mounted || show, leaving: mounted && !show };
}

export type SwapPhase = 'ready' | 'leaving' | 'typing';

/**
 * Pasa de un contenido al siguiente como en un chat: el actual sale (`exitMs`), aparece el indicador
 * "escribiendo…" (`typingMs`) y entra el nuevo. `shown` es lo que hay que dibujar en cada momento y `phase`
 * en qué punto de la secuencia está. Al volver atrás (`order` menor) no se simula que se escribe.
 * Con "reducir movimiento" el cambio es inmediato y no hay indicador.
 */
export function useSwap<T>(value: T, order: number, exitMs: number, typingMs: number): { shown: T; phase: SwapPhase } {
  const [shown, setShown] = useState(value);
  // Al montar también se "escribe" la primera pregunta, para que la conversación arranque igual que sigue.
  const [typing, setTyping] = useState(() => !prefersReducedMotion());
  const shownOrder = useRef(order);

  useEffect(() => {
    if (value === shown) return;
    const swap = () => {
      const forward = order >= shownOrder.current;
      shownOrder.current = order;
      setShown(value);
      setTyping(forward && !prefersReducedMotion());
    };
    if (prefersReducedMotion()) {
      swap();
      return;
    }
    const t = window.setTimeout(swap, exitMs);
    return () => window.clearTimeout(t);
  }, [value, order, shown, exitMs]);

  useEffect(() => {
    if (!typing) return;
    const t = window.setTimeout(() => setTyping(false), typingMs);
    return () => window.clearTimeout(t);
  }, [typing, typingMs]);

  return { shown, phase: shown !== value ? 'leaving' : typing ? 'typing' : 'ready' };
}
