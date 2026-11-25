/* ============================================================
 * MODELO — Construcción del mensaje de WhatsApp (funciones puras).
 * Formato WhatsApp: *negrita*, _cursiva_, viñetas "•".
 *
 * Hay UN solo constructor de líneas (`buildLines`). Del mismo resultado salen:
 *   · el texto que se envía (`buildMessage`), y
 *   · la vista previa en vivo, que además muestra como "pendientes" los datos críticos que faltan.
 * Así la vista previa no puede diferir de lo que realmente se envía.
 * ============================================================ */
import { site } from '@/config/site';
import { SERVICES } from './catalog';
import { DICTIONARIES } from './i18n';
import { consultationApplies, offerFigures } from './offer';
import { isEmpty } from './validation';
import type { Answers, Locale, Question, Section, ServiceId } from './types';

/**
 * Versión del formulario. Viaja en el pie del mensaje para saber con qué preguntas respondió el cliente.
 * Subirla cuando cambian las preguntas de forma que afecte la lectura de las respuestas.
 */
export const SURVEY_VERSION = 3;

export interface MessageInput {
  locale: Locale;
  selected: ServiceId[];
  sections: Section[];
  answers: Answers;
  reference: string;
  siteUrl?: string;
  /** Origen de la visita (p. ej. "tarjeta"), ya normalizado. */
  origin?: string;
}

export type MessageLine =
  /** Línea de texto con formato WhatsApp: saludo, título, servicios, oferta, cierre. */
  | { kind: 'text'; text: string }
  | { kind: 'gap' }
  | { kind: 'section'; sectionId: string; text: string }
  /** `value: null` = dato que todavía falta (solo existe en la vista previa); `optional` lo distingue de un dato crítico. */
  | { kind: 'item'; sectionId: string; questionId: string; label: string; value: string | null; multiline: boolean; optional: boolean }
  | { kind: 'footer'; text: string };

/** Valor legible de una respuesta en el idioma del cliente. */
export function formatAnswer(question: Question, answers: Answers, locale: Locale): string | null {
  const value = answers[question.id];
  if (isEmpty(value)) return null;
  if (question.type === 'single' || question.type === 'multi') {
    const ids = Array.isArray(value) ? value : [value as string];
    const labels = ids
      .map((id) => question.options?.find((opt) => opt.id === id)?.label[locale])
      .filter((label): label is string => Boolean(label));
    return labels.length ? labels.join(', ') : null;
  }
  return (value as string).trim().replace(/\n{3,}/g, '\n\n');
}

/**
 * Líneas del mensaje. Con `pending: true` incluye, en su sección, las preguntas obligatorias sin responder
 * (para la vista previa); `focusId` suma además la pregunta que se está respondiendo ahora, aunque sea opcional,
 * para que se vea dónde va a aparecer la respuesta. Sin eso solo hay lo respondido, que es lo que se envía.
 */
export function buildLines(input: MessageInput, options: { pending?: boolean; focusId?: string } = {}): MessageLine[] {
  const { locale, selected, sections, answers, reference, origin = '', siteUrl = site.url } = input;
  const dict = DICTIONARIES[locale].message;
  const lines: MessageLine[] = [];

  const rawName = answers.p_nombre;
  const name = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : '';
  lines.push({ kind: 'text', text: name ? dict.greetingNamed(name) : dict.greeting }, { kind: 'gap' });
  lines.push({ kind: 'text', text: `*${dict.title}* · ${dict.ref} ${reference}` });

  if (selected.length) {
    const names = SERVICES.filter((s) => selected.includes(s.id)).map((s) => s.title[locale]);
    lines.push({ kind: 'text', text: `*${dict.services}:* ${names.join(', ')}` });
  }
  if (consultationApplies(selected)) {
    const value = dict.consultValue(offerFigures());
    lines.push({ kind: 'text', text: `*${dict.consult}:* ${value}` });
  }

  sections.forEach((section, index) => {
    const rows = section.questions
      .map((q) => ({ q, value: formatAnswer(q, answers, locale) }))
      .filter((row) => row.value !== null || (options.pending && (row.q.required || row.q.id === options.focusId)));
    if (!rows.length) return;

    lines.push({ kind: 'gap' }, { kind: 'section', sectionId: section.id, text: `*${index + 1}. ${section.title[locale]}*` });
    for (const { q, value } of rows) {
      lines.push({
        kind: 'item',
        sectionId: section.id,
        questionId: q.id,
        label: q.label[locale].replace(/[¿?]/g, '').trim(),
        value,
        multiline: q.type === 'textarea',
        optional: !q.required,
      });
    }
  });

  const host = siteUrl.replace(/^https?:\/\//, '');
  const trace = [host, locale.toUpperCase(), `v${SURVEY_VERSION}`, ...(origin ? [`${dict.origin}: ${origin}`] : [])];
  lines.push({ kind: 'gap' }, { kind: 'text', text: dict.closing }, { kind: 'footer', text: `_${dict.footer} ${trace.join(' · ')}_` });
  return lines;
}

/**
 * Texto plano que se envía por WhatsApp. Los pendientes se omiten, y con ellos las secciones que quedan sin
 * ningún dato (su encabezado y el espacio previo), así el resultado no depende de si se pidieron pendientes.
 */
export function linesToText(lines: MessageLine[]): string {
  const filled = new Set(lines.flatMap((l) => (l.kind === 'item' && l.value !== null ? [l.sectionId] : [])));
  const out: string[] = [];
  lines.forEach((line, i) => {
    const next = lines[i + 1];
    if (line.kind === 'gap') {
      if (next?.kind === 'section' && !filled.has(next.sectionId)) return;
      out.push('');
    } else if (line.kind === 'section') {
      if (filled.has(line.sectionId)) out.push(line.text);
    } else if (line.kind === 'item') {
      if (line.value === null) return;
      if (line.multiline) out.push(`• ${line.label}:`, `  ${line.value.replace(/\n/g, '\n  ')}`);
      else out.push(`• ${line.label}: ${line.value}`);
    } else out.push(line.text);
  });
  return out.join('\n');
}

export function buildMessage(input: MessageInput): string {
  return linesToText(buildLines(input));
}

/**
 * Caracteres de control (salvo tabulación y saltos de línea) y los invisibles que reordenan u ocultan texto: con ellos un
 * mensaje puede mostrarse distinto de lo que dice. Es la misma lista que limpia el servidor (`landing_crm/intake/payload.py`).
 */
const UNWANTED_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-\u200F\u202A-\u202E\u2066-\u2069﻿]/g;

/** El texto en forma NFC y sin esos caracteres. No escapa nada: WhatsApp no interpreta HTML y la URL la codifica `encodeURIComponent`. */
export function cleanText(text: string): string {
  return text.normalize('NFC').replace(UNWANTED_CHARACTERS, '');
}

/**
 * El enlace a WhatsApp. `encodeURIComponent` hace que el texto no pueda alterar la dirección (otro número, otro parámetro);
 * `cleanText` quita lo invisible, también de un mensaje editado a mano.
 */
export function buildWhatsAppUrl(text: string, phone: string = site.whatsapp): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(cleanText(text))}`;
}

/**
 * Hay dos clases de referencia, y se distinguen a simple vista:
 *   · la LOCAL (`ML-261120-AB3K`) la arma el navegador; lleva siempre al menos una letra y nunca usa 0, 1, I ni O;
 *   · la del SERVIDOR (`ML-261120-0042`) es la serie de Frappe: cuatro dígitos, un contador por día.
 * Como la local siempre trae una letra, ninguna puede confundirse con la otra.
 */
const REFERENCE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const REFERENCE_ALPHABET = `${REFERENCE_LETTERS}23456789`;
const LOCAL_REFERENCE = /^ML-\d{6}-[A-HJ-NP-Z2-9]{4}$/;
export const SERVER_REFERENCE_PATTERN = /^ML-\d{6}-\d{4}$/;
export const REFERENCE_PATTERN = /^ML-\d{6}-(?:[A-HJ-NP-Z2-9]{4}|\d{4})$/;

/** ¿Tiene el formato de una referencia, local o del servidor? No prueba que sea auténtica (nada la firma). */
export function isValidReference(value: unknown): value is string {
  return typeof value === 'string' && REFERENCE_PATTERN.test(value);
}

/** ¿Es una referencia emitida por el servidor (la consulta quedó registrada en el CRM)? */
export function isServerReference(value: unknown): value is string {
  return typeof value === 'string' && SERVER_REFERENCE_PATTERN.test(value);
}

/** ¿Es una referencia armada en el navegador? Las viejas, sin letra obligatoria, también valen mientras tengan el formato. */
export function isLocalReference(value: unknown): value is string {
  return typeof value === 'string' && LOCAL_REFERENCE.test(value);
}

/** Referencia local para identificar la consulta: ML-AAMMDD-XXXX. La primera posición es siempre una letra. */
export function createReference(date: Date = new Date(), random: () => number = Math.random): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const pick = (alphabet: string) => alphabet[Math.floor(random() * alphabet.length)];
  const suffix = [pick(REFERENCE_LETTERS), ...Array.from({ length: 3 }, () => pick(REFERENCE_ALPHABET))].join('');
  return `ML-${yy}${mm}${dd}-${suffix}`;
}

/** Cambia la referencia dentro de un texto (también si el cliente lo editó a mano). Sin esa referencia, lo devuelve igual. */
export function replaceReference(text: string, from: string, to: string): string {
  return from && text.includes(from) ? text.split(from).join(to) : text;
}

/** Por encima de este largo de URL algunos navegadores móviles truncan el enlace. */
export const SAFE_URL_LENGTH = 6000;
