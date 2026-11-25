/* ============================================================
 * MODELO — Cuerpo que el sitio envía al CRM (funciones puras).
 * Contrato: docs/SEGURIDAD.md 7.5 (servidor: `landing_crm.api.submit_lead`). El servidor no confía en nada de esto y
 * lo valida de nuevo contra su copia del catálogo; acá solo se arma el cuerpo con la forma que espera.
 * ============================================================ */
import { site } from '@/config/site';
import { consultationApplies, offerFigures } from './offer';
import { cleanText, SURVEY_VERSION } from './message';
import { isEmpty } from './validation';
import type { Answers, Locale, Section, ServiceId } from './types';

/** Límite del campo `offer` en el servidor: un texto más largo hace que rechace la consulta entera. */
export const MAX_OFFER_LENGTH = 140;

export interface LeadSubmission {
  idempotency_key: string;
  /** La misma en todos los envíos de esta pestaña: el servidor los junta en un solo `CRM Lead`, con una sola referencia. */
  visit_key: string;
  locale: Locale;
  form_version: number;
  origin: string;
  offer: string;
  services: ServiceId[];
  answers: Answers;
  consent: true;
  turnstile: string;
  /** Señuelo (honeypot): el sitio nunca lo completa; solo lo llenaría un robot que arma el cuerpo a mano. */
  website: '';
  /**
   * El texto de WhatsApp, solo si el cliente lo editó a mano: entonces puede decir algo que las respuestas no dicen (otro
   * correo, una aclaración), y Mariano lo ve en la nota del `CRM Lead`. Sin editar no viaja: sería repetir las respuestas.
   */
  message?: string;
}

/** Límite del campo `message` en el servidor: más largo, rechaza la consulta entera. */
export const MAX_MESSAGE_LENGTH = 8000;

/** ¿Está activa la conexión con el CRM? Necesita el origen de la API y la clave pública de Turnstile. */
export function crmEnabled(config: { url: string; turnstileSiteKey: string } = site.crm): boolean {
  return Boolean(crmOrigin(config.url) && config.turnstileSiteKey);
}

/** Origen (https) de la API, o '' si el valor no es una dirección usable. Solo `https:`, salvo `localhost` para probar. */
export function crmOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    return parsed.protocol === 'https:' || (parsed.protocol === 'http:' && local) ? parsed.origin : '';
  } catch {
    return '';
  }
}

/**
 * La oferta tal como la vio el cliente, en una línea y sin idioma: "USD 54/h (USD 9/10 min)".
 * Es solo un dato para quien lee el `CRM Lead`; el servidor no calcula nada con él. Va vacía si el recorrido no incluye la consulta.
 */
export function offerSummary(selected: ServiceId[]): string {
  if (!consultationApplies(selected)) return '';
  const f = offerFigures();
  return `${f.hour}/h (${f.block}/${f.minutes} min)`.slice(0, MAX_OFFER_LENGTH);
}

/** Solo las respuestas de las preguntas del recorrido elegido y con contenido: lo que el servidor guarda. */
export function answersOf(sections: Section[], answers: Answers): Answers {
  const out: Answers = {};
  for (const question of sections.flatMap((section) => section.questions)) {
    const value = answers[question.id];
    if (value !== undefined && !isEmpty(value)) out[question.id] = value;
  }
  return out;
}

export interface SubmissionInput {
  locale: Locale;
  selected: ServiceId[];
  sections: Section[];
  answers: Answers;
  origin: string;
  idempotencyKey: string;
  visitKey: string;
  turnstile: string;
  /** El mensaje editado a mano (`null` o vacío: no se editó). */
  message?: string | null;
}

export function buildSubmission(input: SubmissionInput): LeadSubmission {
  // Se limpia antes de cortar, como lo hará el servidor: así lo que llega nunca pasa su límite.
  const message = input.message ? cleanText(input.message).trim().slice(0, MAX_MESSAGE_LENGTH) : '';
  return {
    ...(message ? { message } : {}),
    idempotency_key: input.idempotencyKey,
    visit_key: input.visitKey,
    locale: input.locale,
    form_version: SURVEY_VERSION,
    origin: input.origin,
    offer: offerSummary(input.selected),
    services: [...input.selected],
    answers: answersOf(input.sections, input.answers),
    consent: true,
    turnstile: input.turnstile,
    website: '',
  };
}

/** UUID v4 para la clave de idempotencia y la de visita. `randomUUID` solo existe en contextos seguros (https, localhost): sin él se arma con `getRandomValues`. */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
