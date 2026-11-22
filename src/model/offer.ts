/* ============================================================
 * MODELO — Oferta del relevamiento técnico (reglas puras).
 * Los valores viven en src/config/site.ts. Se cobra POR TRAMOS: la reunión se mide en bloques de `minutes` minutos y cada
 * bloque cuesta lo que marca el tramo en el que empieza. Se muestra el precio de la hora (`hourly`) y su equivalencia por
 * bloque; el costo real es el total que da `meetingCost`.
 * ============================================================ */
import { site } from '@/config/site';
import type { ServiceId } from './types';

/** Desde `after` minutos, cada bloque que empieza ahí o más tarde cuesta `price`. */
export interface OfferTier {
  after: number;
  price: number;
}

export interface Offer {
  /** Largo de cada bloque (unidad de redondeo y de la referencia). */
  minutes: number;
  /** Precio de oferta por bloque: el del primer tramo y la referencia que se muestra. */
  price: number;
  /** Tarifa normal por bloque: la que rige en reuniones de menos de `promoFrom` minutos y el "antes" del tachado. */
  originalPrice: number;
  currency: string;
  /** Desde cuántos minutos rige la oferta. */
  promoFrom: number;
  /** Tramos siguientes, en orden creciente de `after`. */
  tiers: readonly OfferTier[];
}

export const CONSULTA: Offer = site.consulta;

/** Duraciones de ejemplo (en minutos) con las que se muestra el costo total de una reunión. */
export const EXAMPLE_MINUTES: readonly number[] = [30, 60, 120, 240];

/** "USD 9" · "USD 9.50". Sin separadores locales: se lee igual en los tres idiomas. */
export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/** Cuánto sale la hora a partir del precio de un bloque: "USD 9 cada 10 min" = "USD 54 la hora". */
export function hourly(blockPrice: number, offer: Offer = CONSULTA): number {
  return cents((blockPrice * 60) / offer.minutes);
}

/** Cifras de la oferta ya formateadas, para los textos: la hora y su equivalencia por bloque, con oferta y a tarifa normal. */
export interface OfferFigures {
  minutes: number;
  hour: string;
  hourOriginal: string;
  block: string;
  blockOriginal: string;
  /** Desde cuánto de reunión rige la oferta ("1 h"). */
  from: string;
}

export function offerFigures(offer: Offer = CONSULTA): OfferFigures {
  const money = (n: number) => formatMoney(n, offer.currency);
  return {
    minutes: offer.minutes,
    hour: money(hourly(offer.price, offer)),
    hourOriginal: money(hourly(offer.originalPrice, offer)),
    block: money(offer.price),
    blockOriginal: money(offer.originalPrice),
    from: formatDuration(offer.promoFrom),
  };
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

/** Precio de oferta del bloque que empieza en el minuto `start` (0 = el primero): el del último tramo ya alcanzado. */
export function blockRate(start: number, offer: Offer = CONSULTA): number {
  let rate = offer.price;
  for (const tier of offer.tiers) if (start >= tier.after) rate = tier.price;
  return rate;
}

/** Una fila de la tarifa: de `from` a `to` minutos (`null` = sin límite) cada bloque cuesta `price`. `regular` marca la tarifa normal, sin oferta. */
export interface OfferRate {
  from: number;
  to: number | null;
  price: number;
  regular: boolean;
}

/** La tarifa por tramos como filas, para mostrarla: tarifa normal hasta `promoFrom`, luego el precio de oferta y cada tramo. */
export function offerRates(offer: Offer = CONSULTA): OfferRate[] {
  const rows: OfferRate[] = [];
  if (offer.promoFrom > 0) rows.push({ from: 0, to: offer.promoFrom, price: offer.originalPrice, regular: true });
  rows.push({ from: offer.promoFrom, to: offer.tiers[0]?.after ?? null, price: offer.price, regular: false });
  offer.tiers.forEach((tier, i) => rows.push({ from: tier.after, to: offer.tiers[i + 1]?.after ?? null, price: tier.price, regular: false }));
  return rows;
}

/**
 * Costo total de una reunión de `minutes` minutos, por tramos: un bloque por cada `offer.minutes` (redondeando hacia arriba) y
 * cada bloque al precio del tramo donde empieza. Por debajo de `promoFrom` minutos rige la tarifa normal en todos los bloques.
 * Devuelve también el total a tarifa normal, para poder mostrar el tachado, y si la oferta se aplicó.
 */
export function meetingCost(minutes: number, offer: Offer = CONSULTA): { blocks: number; price: number; originalPrice: number; promo: boolean } {
  const blocks = Math.max(0, Math.ceil(minutes / offer.minutes));
  const originalPrice = cents(blocks * offer.originalPrice);
  if (minutes < offer.promoFrom) return { blocks, price: originalPrice, originalPrice, promo: false };
  let price = 0;
  for (let i = 0; i < blocks; i++) price += blockRate(i * offer.minutes, offer);
  return { blocks, price: cents(price), originalPrice, promo: blocks > 0 };
}

/**
 * Soporte 24/7 es para emergencias, reparación y mantenimiento de equipos (remoto o presencial) y se atiende aparte.
 * Cualquier otra asesoría pasa por el relevamiento técnico por bloques, así que solo ahí corresponde mostrarlo.
 */
export function consultationApplies(selected: readonly ServiceId[]): boolean {
  return selected.some((id) => id !== 'soporte');
}
