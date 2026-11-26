/* ============================================================
 * MODELO — Reglas de validación (puras).
 * ============================================================ */
import type { AnswerFormat, AnswerValue, Answers, Errors, Question, Section } from './types';

export function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim().length === 0;
}

/**
 * ¿La pregunta tiene una respuesta que realmente llegará al mensaje?
 * Una opción cuyo id ya no existe (p. ej. un relevamiento guardado antes de cambiar el catálogo) no cuenta:
 * el mensaje la omite, y no puede darse por respondido un dato que no se va a enviar.
 */
export function isAnswered(question: Question, value: AnswerValue | undefined): boolean {
  if (isEmpty(value)) return false;
  if (question.type === 'single' || question.type === 'multi') {
    const ids = Array.isArray(value) ? value : [value as string];
    return ids.some((id) => question.options?.some((opt) => opt.id === id));
  }
  return true;
}

/**
 * ¿Es obligatoria? Solo `true`: en las secciones de `buildSections` ya está decidido. Una condición sin resolver (una
 * pregunta tomada directo del catálogo) no cuenta como obligatoria, en vez de contar siempre por ser un objeto.
 */
export function isRequired(question: Question): boolean {
  return question.required === true;
}

/**
 * Formatos. El correo usa el mismo patrón que el servidor (`landing_crm/intake/payload.py`, EMAIL_PATTERN), que además lo
 * revisa con `validate_email_address` de Frappe. El teléfono: 8 a 15 dígitos (E.164), con o sin «+» y separadores.
 * La web: un dominio, con o sin `http(s)://` y ruta, o un usuario de red social (`@empresa`).
 */
export const EMAIL_PATTERN = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/;
const MAX_EMAIL_LENGTH = 120;
const PHONE_SEPARATORS = /[\s().-]/g;
const PHONE_PATTERN = /^\+?\d{8,15}$/;
const HANDLE_PATTERN = /^@[A-Za-z0-9._]{2,30}$/;
const WEB_PATTERN = /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{1,5})?(?:[/?#][^\s<>"'`]*)?$/i;

/** El teléfono sin separadores; «00» al principio es el prefijo internacional y pasa a «+». */
export function normalizePhone(value: string): string {
  const compact = value.trim().replace(PHONE_SEPARATORS, '');
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
}

export function matchesFormat(format: AnswerFormat, value: string): boolean {
  const text = value.trim();
  if (format === 'email') return text.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(text);
  if (format === 'phone') return PHONE_PATTERN.test(normalizePhone(text));
  return HANDLE_PATTERN.test(text) || WEB_PATTERN.test(text);
}

/** Errores de tipeo frecuentes en el dominio del correo (lo de la izquierda es lo que se escribió). */
const DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmail.om': 'gmail.com', 'gmaill.com': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'homail.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'icloud.co': 'icloud.com', 'iclod.com': 'icloud.com',
};
/** Terminaciones mal escritas de cualquier dominio. */
const TLD_FIXES: [RegExp, string][] = [[/\.con$/, '.com'], [/\.cmo$/, '.com'], [/\.comm$/, '.com'], [/\.ocm$/, '.com'], [/\.com\.ra$/, '.com.ar']];

/** «¿Quiso decir…?»: el correo corregido si el dominio tiene un error de tipeo conocido; si no, null. */
export function suggestEmail(value: string): string | null {
  const text = value.trim();
  const at = text.lastIndexOf('@');
  if (at < 1) return null;
  const domain = text.slice(at + 1).toLowerCase();
  let fixed = DOMAIN_FIXES[domain] ?? domain;
  for (const [pattern, replacement] of TLD_FIXES) fixed = fixed.replace(pattern, replacement);
  fixed = DOMAIN_FIXES[fixed] ?? fixed;
  return fixed !== domain ? `${text.slice(0, at)}@${fixed}` : null;
}

/** Errores de una sola pregunta: la conversación valida de a una. Un texto opcional también debe tener la forma pedida. */
export function validateQuestion(question: Question, answers: Answers): Errors {
  const value = answers[question.id];
  if (isRequired(question) && !isAnswered(question, value)) return { [question.id]: 'required' };
  if (question.format && typeof value === 'string' && value.trim() && !matchesFormat(question.format, value)) return { [question.id]: 'format' };
  return {};
}

export function hasErrors(errors: Errors): boolean {
  return Object.keys(errors).length > 0;
}

export interface CriticalProgress {
  /** Datos obligatorios ya respondidos. */
  done: number;
  /** Datos obligatorios de todo el recorrido elegido (no solo del paso actual). */
  total: number;
  /** Ids de las preguntas obligatorias que faltan, en orden de aparición. */
  missing: string[];
}

/** Avance de la información crítica (las preguntas obligatorias) en todo el recorrido. */
export function criticalProgress(sections: Section[], answers: Answers): CriticalProgress {
  const missing: string[] = [];
  let total = 0;
  for (const section of sections) {
    for (const q of section.questions) {
      if (!isRequired(q)) continue;
      total += 1;
      if (!isAnswered(q, answers[q.id])) missing.push(q.id);
    }
  }
  return { done: total - missing.length, total, missing };
}

/**
 * Origen de la visita (por ejemplo `?o=tarjeta` en el QR de la tarjeta).
 * Solo letras, números, guion y guion bajo, hasta 24 caracteres: viaja dentro del mensaje, así que se filtra.
 */
export function normalizeOrigin(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9_-]{1,24}$/i.test(value.trim()) ? value.trim().toLowerCase() : '';
}
