'use client';
/* ============================================================
 * CONTROLADOR — Turnstile (anti-bots de Cloudflare), con carga bajo demanda.
 *
 * El script NO está en el HTML: se pide solo cuando el cliente marca el consentimiento. Así, quien no acepta el registro
 * nunca habla con `challenges.cloudflare.com`. No lleva SRI (el proveedor lo actualiza); se acota con el origen exacto en la
 * CSP (scripts/lib/harden.mjs). El token es de un solo uso y vence a los 5 minutos: la verificación la hace el servidor.
 * ============================================================ */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@/model/types';

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
const SCRIPT_SRC = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

/** Lo único que se usa de la API global del widget. */
export interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Carga el script una sola vez. Si falla, el próximo intento vuelve a probar. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    script.onerror = () => reject(new Error('turnstile'));
    document.head.append(script);
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** Idioma del widget: Turnstile usa `pt-br` para el portugués. */
const WIDGET_LANGUAGE: Record<Locale, string> = { es: 'es', pt: 'pt-br', en: 'en' };

/**
 * En qué punto está la verificación:
 *   · `idle`: todavía no se pidió (el cliente no consintió);
 *   · `pending`: Cloudflare está verificando por su cuenta, sin mostrar nada;
 *   · `interactive`: Cloudflare necesita que el cliente haga algo (el widget se ve);
 *   · `ready`: hay un token vigente;
 *   · `failed`: no se pudo cargar o completar (sin script, sin red, error del widget).
 */
export type TurnstileStatus = 'idle' | 'pending' | 'interactive' | 'ready' | 'failed';

export interface TurnstileHandle {
  status: TurnstileStatus;
  /** Elemento donde se dibuja el widget. */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Token vigente; si todavía no hay, espera hasta `waitMs`. `null` = no llegó a tiempo (el cliente sigue sin registro). */
  getToken: (waitMs: number) => Promise<string | null>;
  /** El token ya se usó (o falló el envío): se descarta y el widget pide otro. */
  consume: () => void;
}

/**
 * Dibuja el widget cuando `enabled` y guarda el token. `appearance: 'interaction-only'`: el widget solo se ve si
 * Cloudflare necesita que el cliente haga algo; si no, trabaja sin mostrarse.
 */
export function useTurnstile({ enabled, siteKey, locale }: { enabled: boolean; siteKey: string; locale: Locale }): TurnstileHandle {
  const containerRef = useRef<HTMLDivElement>(null);
  const token = useRef<string | null>(null);
  const widget = useRef<string | null>(null);
  const waiters = useRef(new Set<(value: string | null) => void>());
  const [status, setStatus] = useState<TurnstileStatus>('idle');

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !siteKey || !container) {
      setStatus('idle');
      return;
    }
    setStatus('pending');
    let cancelled = false;
    let api: TurnstileApi | null = null;
    loadTurnstile()
      .then((loaded) => {
        if (cancelled) return;
        api = loaded;
        widget.current = loaded.render(container, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          // El sitio es oscuro: con el tema por defecto el widget sale como una caja blanca.
          theme: 'dark',
          language: WIDGET_LANGUAGE[locale],
          callback: (value: string) => {
            token.current = value;
            setStatus('ready');
            waiters.current.forEach((resolve) => resolve(value));
            waiters.current.clear();
          },
          // Cloudflare avisa justo antes de pedir una acción al cliente y justo después de que la completa.
          'before-interactive-callback': () => {
            if (!token.current) setStatus('interactive');
          },
          'after-interactive-callback': () => {
            if (!token.current) setStatus('pending');
          },
          'expired-callback': () => {
            token.current = null;
            setStatus('pending'); // vence a los 5 min: el widget pide otro solo
          },
          'error-callback': () => {
            token.current = null;
            setStatus('failed');
          },
        });
      })
      .catch(() => {
        // Sin script no hay token: al enviar se sigue a WhatsApp sin registro.
        if (!cancelled) setStatus('failed');
      });
    return () => {
      cancelled = true;
      token.current = null;
      if (api && widget.current) api.remove(widget.current);
      widget.current = null;
    };
  }, [enabled, siteKey, locale]);

  const getToken = useCallback((waitMs: number) => {
    if (token.current) return Promise.resolve(token.current);
    return new Promise<string | null>((resolve) => {
      const done = (value: string | null) => {
        clearTimeout(timer);
        waiters.current.delete(done);
        resolve(value);
      };
      const timer = setTimeout(() => done(null), waitMs);
      waiters.current.add(done);
    });
  }, []);

  const consume = useCallback(() => {
    token.current = null;
    setStatus('pending');
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);

  return { status, containerRef, getToken, consume };
}
