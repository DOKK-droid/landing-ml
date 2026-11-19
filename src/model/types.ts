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
}

export interface Question {
  id: string;
  type: FieldType;
  label: L10n;
  help?: L10n;
  placeholder?: L10n;
  required?: boolean;
  options?: Option[];
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
  /** Qué conviene contar: se muestra en el detalle y como introducción del paso. */
  needs: L10n;
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

export type Errors = Record<string, 'required'>;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
