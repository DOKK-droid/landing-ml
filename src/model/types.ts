/* ============================================================
 * MODELO — tipos del dominio "Relevamiento inicial".
 * Sin dependencias de React ni del navegador.
 * ============================================================ */

export const LOCALES = ['es', 'pt', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** Texto traducido a los tres idiomas. */
export type L10n = Record<Locale, string>;

export type FieldType = 'text' | 'textarea' | 'single' | 'multi';

export interface Option {
  id: string;
  label: L10n;
  /** Al elegirla se desmarcan las demás, y al elegir otra se desmarca ella («Todavía nada», «No lo sé», «Con ninguna»). */
  exclusive?: boolean;
  /** Valor que la opción escribe en un campo de Frappe CRM (p. ej. `no_of_employees` = "11-50"). Una sola fuente para el CRM. */
  crm?: string;
}

/**
 * Condición sobre el recorrido, en JSON puro: el servidor la evalúa igual (`landing_crm/intake/conditions.py`).
 *   · `services`: eligió alguno de esos servicios · `onlyServices`: no eligió ninguno fuera de esa lista
 *   · `minServices`: eligió al menos n · `answered`: la pregunta tiene respuesta
 *   · `answer` + `in`: la respuesta (o alguna de las elegidas) está en la lista
 *   · `answer` + `only`: eligió algo y todo lo elegido está en la lista
 * Solo puede mirar preguntas ANTERIORES (lo verifica tests/catalog-semantics.test.ts): así, responder una pregunta cambia lo
 * que viene después y nunca lo que ya pasó.
 */
export type Condition =
  | { services: ServiceId[] }
  | { onlyServices: ServiceId[] }
  | { minServices: number }
  | { answered: string }
  | { answer: string; in: string[] }
  | { answer: string; only: string[] }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/** Texto alternativo de una pregunta. Cada atributo se toma de la primera variante que lo trae y cuya condición se cumple. */
export interface Variant {
  when: Condition;
  label?: L10n;
  placeholder?: L10n;
  help?: L10n;
}

/** Formato que se controla en un campo de texto (además de si es obligatorio). */
export type AnswerFormat = 'email' | 'phone' | 'url';

export interface Question {
  id: string;
  type: FieldType;
  label: L10n;
  help?: L10n;
  placeholder?: L10n;
  /**
   * En el catálogo puede ser una condición; en las secciones que arma `buildSections` siempre es `true` o `false`.
   * Para preguntar si es obligatoria se usa `isRequired` (model/validation.ts), que solo acepta `true`.
   */
  required?: boolean | Condition;
  /** Sin condición, la pregunta se hace siempre que su sección esté en el recorrido. */
  showIf?: Condition;
  variants?: Variant[];
  format?: AnswerFormat;
  /** Tope propio de un campo de texto, menor que el general (`site.maxLineLength` / `site.maxTextLength`). */
  maxLength?: number;
  options?: Option[];
  /** Pistas para el navegador en campos de texto: autocompletado y teclado del celular. */
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'url';
}

export type ServiceId = 'consultoria' | 'desarrollo' | 'gestion' | 'infraestructura' | 'ia' | 'soporte';

export type IconName = ServiceId;

export interface Service {
  id: ServiceId;
  color: string;
  title: L10n;
  /** Nombre corto para el diagrama de la sección de concepto. */
  short: L10n;
  /** Frase de una línea visible en la tarjeta. */
  tagline: L10n;
  summary: L10n;
  includes: L10n[];
  /** Qué conviene contar: se muestra en el detalle del servicio. */
  needs: L10n;
  /** Introducción del paso del servicio en el relevamiento: solo lo propio, porque lo compartido se pregunta antes. */
  stepIntro: L10n;
  questions: Question[];
}

/** Paso del relevamiento (perfil, uno por servicio elegido, cierre). */
export interface Section {
  id: string;
  title: L10n;
  intro?: L10n;
  color?: string;
  questions: Question[];
}

/** Respuestas: texto libre o ids de opciones (independientes del idioma). */
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

/** `required`: falta un dato obligatorio · `format`: el texto no tiene la forma pedida (correo, teléfono, web). */
export type ErrorKind = 'required' | 'format';
export type Errors = Record<string, ErrorKind>;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
