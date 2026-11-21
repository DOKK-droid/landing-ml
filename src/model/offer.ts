/* ============================================================
 * MODELO — Oferta del relevamiento técnico (reglas puras).
 * Los valores viven en src/config/site.ts. El precio es POR BLOQUE de `minutes` minutos de reunión:
 * el total de una reunión depende de cuánto dure.
 * ============================================================ */
import { site } from '@/config/site';
import type { ServiceId } from './types';

export interface Offer {
  /** Largo de cada bloque que se paga. */
  minutes: number;
  /** Precio de oferta por bloque. */
  price: number;
  /** Precio original por bloque. */
  originalPrice: number;
  currency: string;
}

export const CONSULTA: Offer = site.consulta;

/** Duraciones de ejemplo (en minutos) con las que se muestra el costo total de una reunión. */
export const EXAMPLE_MINUTES: readonly number[] = [30, 60, 180];

/** "USD 9" · "USD 9.50". Sin separadores locales: se lee igual en los tres idiomas. */
export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/** Descuento sobre el precio original, en porcentaje entero. */
export function discountPercent(offer: Offer): number {
  return Math.round((1 - offer.price / offer.originalPrice) * 100);
}

/** "30 min" · "1 h" · "1 h 30 min". Las abreviaturas son iguales en es, pt y en. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * Costo total de una reunión de `minutes` minutos: un bloque por cada `offer.minutes`, redondeando hacia arriba.
 * Devuelve el precio de oferta y el original, para poder mostrar el tachado.
 */
export function meetingCost(minutes: number, offer: Offer = CONSULTA): { blocks: number; price: number; originalPrice: number } {
  const blocks = Math.max(0, Math.ceil(minutes / offer.minutes));
  return { blocks, price: cents(blocks * offer.price), originalPrice: cents(blocks * offer.originalPrice) };
}

/**
 * Soporte 24/7 es para emergencias, reparación y mantenimiento de equipos (remoto o presencial) y se atiende aparte.
 * Cualquier otra asesoría pasa por el relevamiento técnico por bloques, así que solo ahí corresponde mostrarlo.
 */
export function consultationApplies(selected: readonly ServiceId[]): boolean {
  return selected.some((id) => id !== 'soporte');
}
