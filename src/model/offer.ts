/* ============================================================
 * MODELO — Oferta del relevamiento técnico (reglas puras).
 * Los valores viven en src/config/site.ts. La reunión se mide en bloques de `minutes` minutos y su DURACIÓN TOTAL define la
 * tarifa de todos los bloques: cuanto más larga la reunión, más barata la hora (la tarifa del tramo rige para toda la reunión).
 * Se muestra el precio de la hora (`hourly`) y su equivalencia por bloque; el costo real es el total que da `meetingCost`.
 * ============================================================ */
import { site } from '@/config/site';
import type { ServiceId } from './types';

/** Las reuniones de `from` minutos o más pagan `price` por bloque, en todos sus bloques. */
export interface OfferTier {
  from: number;
  price: number;
}

export interface Offer {
  /** Largo de cada bloque (unidad de redondeo). */
  minutes: number;
  /** Precio de oferta por bloque en el primer tramo (desde `promoFrom` hasta el primer `tiers[].from`) y el que se muestra en el titular. */
  price: number;
  /** Tarifa normal por bloque: la que rige en reuniones de menos de `promoFrom` minutos y el "antes" del tachado. */
  originalPrice: number;
  currency: string;
  /** Desde cuántos minutos rige la oferta. */
  promoFrom: number;
  /** Tramos siguientes, en orden creciente de `from`. */
  tiers: readonly OfferTier[];
}

export const CONSULTA: Offer = site.consulta;

/**
 * Duraciones de ejemplo (en minutos) con las que se muestra el costo total de una reunión. Son pocas a propósito y muestran
 * la ventaja: 30 min (todavía sin oferta), 2 h (primer descuento grande), 3 h y 5 h 30 min (la hora ya en su tramo más barato).
 */
export const EXAMPLE_MINUTES: readonly number[] = [30, 120, 180, 330];

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

/** Descuento de un precio por bloque sobre la tarifa normal, en porcentaje entero. */
export function ratePercent(price: number, offer: Offer = CONSULTA): number {
  return Math.round((1 - price / offer.originalPrice) * 100);
}

/** Descuento del precio de oferta del titular sobre el precio original, en porcentaje entero. */
export function discountPercent(offer: Offer): number {
  return ratePercent(offer.price, offer);
}

/** "30 min" · "1 h" · "1 h 30 min". Las abreviaturas son iguales en es, pt y en. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Precio por bloque de una reunión de `minutes` minutos: la tarifa normal por debajo de `promoFrom`; desde ahí, la del último tramo alcanzado. */
export function meetingRate(minutes: number, offer: Offer = CONSULTA): number {
  if (minutes < offer.promoFrom) return offer.originalPrice;
  let rate = offer.price;
  for (const tier of offer.tiers) if (minutes >= tier.from) rate = tier.price;
  return rate;
}

/**
 * Una fila de la tarifa: las reuniones de `from` a `to` minutos (`to` excluido; `null` = sin límite) pagan `price` por bloque,
 * que es `off` % menos que la tarifa normal. `regular` marca la tarifa normal, sin oferta.
 */
export interface OfferRate {
  from: number;
  to: number | null;
  price: number;
  off: number;
  regular: boolean;
}

/** La tarifa por tramos como filas, para mostrarla: tarifa normal hasta `promoFrom`, luego el precio de oferta y cada tramo. */
export function offerRates(offer: Offer = CONSULTA): OfferRate[] {
  const row = (from: number, to: number | null, price: number, regular: boolean): OfferRate => ({ from, to, price, off: regular ? 0 : ratePercent(price, offer), regular });
  const rows: OfferRate[] = [];
  if (offer.promoFrom > 0) rows.push(row(0, offer.promoFrom, offer.originalPrice, true));
  rows.push(row(offer.promoFrom, offer.tiers[0]?.from ?? null, offer.price, false));
  offer.tiers.forEach((tier, i) => rows.push(row(tier.from, offer.tiers[i + 1]?.from ?? null, tier.price, false)));
  return rows;
}

export interface MeetingCost {
  /** Bloques cobrados (un bloque incompleto cuenta como uno entero). */
  blocks: number;
  /** Precio por bloque que rige en esta reunión. */
  rate: number;
  /** Total a pagar. */
  price: number;
  /** Lo mismo a tarifa normal, para poder mostrar el tachado. */
  originalPrice: number;
  /** Cuánto se ahorra frente a la tarifa normal y qué porcentaje es. */
  saved: number;
  percent: number;
  /** Si se aplicó la oferta. */
  promo: boolean;
}

/**
 * Costo total de una reunión de `minutes` minutos: un bloque por cada `offer.minutes` (redondeando hacia arriba), todos al precio
 * que marca la duración total de la reunión (`meetingRate`). Por debajo de `promoFrom` minutos rige la tarifa normal.
 * La tarifa baja al cruzar cada tramo y rige para toda la reunión, así que el total puede bajar justo en el umbral
 * (1 h 59 min = USD 108; 2 h = USD 96): es la ventaja de reunirse más tiempo.
 */
export function meetingCost(minutes: number, offer: Offer = CONSULTA): MeetingCost {
  const blocks = Math.max(0, Math.ceil(minutes / offer.minutes));
  const rate = meetingRate(minutes, offer);
  const price = cents(blocks * rate);
  const originalPrice = cents(blocks * offer.originalPrice);
  const saved = cents(originalPrice - price);
  const promo = blocks > 0 && minutes >= offer.promoFrom;
  return { blocks, rate, price, originalPrice, saved, percent: originalPrice > 0 ? Math.round((saved / originalPrice) * 100) : 0, promo };
}

/**
 * Soporte 24/7 es para emergencias, reparación y mantenimiento de equipos (remoto o presencial) y se atiende aparte.
 * Cualquier otra asesoría pasa por el relevamiento técnico por bloques, así que solo ahí corresponde mostrarlo.
 */
export function consultationApplies(selected: readonly ServiceId[]): boolean {
  return selected.some((id) => id !== 'soporte');
}
