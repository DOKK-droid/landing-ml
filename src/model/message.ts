/* ============================================================
 * MODELO — Construcción del mensaje de WhatsApp (función pura).
 * Formato WhatsApp: *negrita*, _cursiva_, viñetas "•".
 * ============================================================ */
import { site } from '@/config/site';
import { SERVICES } from './catalog';
import { DICTIONARIES } from './i18n';
import { isEmpty } from './validation';
import type { Answers, Locale, Question, Section, ServiceId } from './types';

export interface MessageInput {
  locale: Locale;
  selected: ServiceId[];
  sections: Section[];
  answers: Answers;
  reference: string;
  siteUrl?: string;
}

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

export function buildMessage({ locale, selected, sections, answers, reference, siteUrl = site.url }: MessageInput): string {
  const dict = DICTIONARIES[locale].message;
  const lines: string[] = [];

  lines.push(dict.greeting, '');
  lines.push(`*${dict.title}* · ${dict.ref} ${reference}`);
  if (selected.length) {
    const names = SERVICES.filter((s) => selected.includes(s.id)).map((s) => s.title[locale]);
    lines.push(`*${dict.services}:* ${names.join(', ')}`);
  }

  sections.forEach((section, index) => {
    const answered = section.questions
      .map((q) => ({ q, text: formatAnswer(q, answers, locale) }))
      .filter((row): row is { q: Question; text: string } => row.text !== null);
    if (!answered.length) return;

    lines.push('', `*${index + 1}. ${section.title[locale]}*`);
    for (const { q, text } of answered) {
      const label = q.label[locale].replace(/[¿?]/g, '').trim();
      if (q.type === 'textarea') {
        lines.push(`• ${label}:`, `  ${text.replace(/\n/g, '\n  ')}`);
      } else {
        lines.push(`• ${label}: ${text}`);
      }
    }
  });

  lines.push('', dict.closing, `_${dict.footer} ${siteUrl.replace(/^https?:\/\//, '')} · ${locale.toUpperCase()}_`);
  return lines.join('\n');
}

export function buildWhatsAppUrl(text: string, phone: string = site.whatsapp): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** Referencia corta para identificar la consulta: ML-AAMMDD-XXXX. */
export function createReference(date: Date = new Date(), random: () => number = Math.random): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
  return `ML-${yy}${mm}${dd}-${suffix}`;
}

/** Por encima de este largo de URL algunos navegadores móviles truncan el enlace. */
export const SAFE_URL_LENGTH = 6000;
