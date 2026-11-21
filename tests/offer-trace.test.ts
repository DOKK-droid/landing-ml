/* QA de la oferta del relevamiento técnico (precio por bloque de 10 min) y de la trazabilidad (referencia, versión del formulario, origen). */
import { describe, expect, it } from 'vitest';
import { initialState, sanitize, surveyReducer } from '@/controller/surveyReducer';
import { site } from '@/config/site';
import { buildSections } from '@/model/catalog';
import { DICTIONARIES } from '@/model/i18n';
import { buildMessage, SURVEY_VERSION, type MessageInput } from '@/model/message';
import { CONSULTA, consultationApplies, discountPercent, EXAMPLE_MINUTES, formatDuration, formatMoney, meetingCost } from '@/model/offer';
import { LOCALES, type ServiceId } from '@/model/types';
import { normalizeOrigin } from '@/model/validation';

const input = (selected: ServiceId[], extra: Partial<MessageInput> = {}): MessageInput => ({
  locale: 'es', selected, sections: buildSections(selected), answers: {}, reference: 'ML-261120-ABCD', siteUrl: 'https://ejemplo.dev', ...extra,
});

describe('oferta del relevamiento técnico', () => {
  it('la oferta es coherente: precio menor que el original y duración positiva', () => {
    expect(CONSULTA).toBe(site.consulta);
    expect(CONSULTA.minutes).toBeGreaterThan(0);
    expect(CONSULTA.price).toBeGreaterThan(0);
    expect(CONSULTA.price).toBeLessThan(CONSULTA.originalPrice);
  });

  it('oferta acordada: USD 9 cada 10 minutos de relevamiento técnico, precio original USD 12 (−25 %)', () => {
    // Si se cambia la oferta en src/config/site.ts, este test avisa para revisar también docs y textos.
    expect(CONSULTA).toEqual({ minutes: 10, price: 9, originalPrice: 12, currency: 'USD' });
    expect(discountPercent(CONSULTA)).toBe(25);
    expect(formatMoney(CONSULTA.price, CONSULTA.currency)).toBe('USD 9');
    expect(formatMoney(CONSULTA.originalPrice, CONSULTA.currency)).toBe('USD 12');
  });

  it('el precio es por bloque: el costo total depende de cuánto dure la reunión', () => {
    expect(meetingCost(10)).toEqual({ blocks: 1, price: 9, originalPrice: 12 });
    expect(meetingCost(30)).toEqual({ blocks: 3, price: 27, originalPrice: 36 });
    expect(meetingCost(60)).toEqual({ blocks: 6, price: 54, originalPrice: 72 });
    // Ejemplo pedido: una reunión de 3 horas son 18 bloques de 10 minutos = USD 162 (antes USD 216).
    expect(meetingCost(180)).toEqual({ blocks: 18, price: 162, originalPrice: 216 });
    expect(meetingCost(0).price).toBe(0);
  });

  it('un tramo incompleto se cobra como un bloque más', () => {
    expect(meetingCost(11).blocks).toBe(2);
    expect(meetingCost(95).blocks).toBe(10);
  });

  it('el costo no acumula errores de coma flotante con precios con decimales', () => {
    expect(meetingCost(30, { minutes: 10, price: 0.1, originalPrice: 0.2, currency: 'USD' }).price).toBe(0.3);
  });

  it('los ejemplos que se muestran son 30 min, 1 h y 3 h', () => {
    expect(EXAMPLE_MINUTES).toEqual([30, 60, 180]);
    expect(EXAMPLE_MINUTES.map(formatDuration)).toEqual(['30 min', '1 h', '3 h']);
    expect(formatDuration(90)).toBe('1 h 30 min');
  });

  it('formatea montos con decimales solo cuando hacen falta', () => {
    expect(formatMoney(9, 'USD')).toBe('USD 9');
    expect(formatMoney(9.5, 'USD')).toBe('USD 9.50');
  });

  it('la consulta corresponde a toda asesoría, pero no al soporte de emergencias', () => {
    expect(consultationApplies([])).toBe(false);
    expect(consultationApplies(['soporte'])).toBe(false);
    expect(consultationApplies(['ia'])).toBe(true);
    expect(consultationApplies(['soporte', 'desarrollo'])).toBe(true);
  });

  it('el mensaje registra la oferta vista por el cliente, en su idioma', () => {
    expect(buildMessage(input(['ia']))).toContain('*Consulta:* USD 9 cada 10 min de relevamiento técnico (oferta; precio original USD 12)');
    expect(buildMessage(input(['ia'], { locale: 'pt' }))).toContain('*Consulta:* USD 9 a cada 10 min de levantamento técnico (oferta; preço original USD 12)');
    expect(buildMessage(input(['ia'], { locale: 'en' }))).toContain('*Consultation:* USD 9 per 10 min of technical assessment (offer; original price USD 12)');
  });

  it('un pedido solo de soporte no menciona la consulta', () => {
    expect(buildMessage(input(['soporte']))).not.toMatch(/Consulta:|Consultation:/);
  });

  it('los textos de la oferta existen y usan los valores de la configuración en los tres idiomas', () => {
    for (const locale of LOCALES) {
      const d = DICTIONARIES[locale].consulta;
      expect(d.badge && d.lead && d.support && d.supportLink && d.cta && d.hero, locale).toBeTruthy();
      expect(d.title(CONSULTA.minutes)).toContain(String(CONSULTA.minutes));
      expect(d.per(CONSULTA.minutes)).toContain(String(CONSULTA.minutes));
      expect(d.perShort(CONSULTA.minutes)).toContain(String(CONSULTA.minutes));
      expect(d.billing(CONSULTA.minutes)).toContain(String(CONSULTA.minutes));
      expect(d.examples && d.was, locale).toBeTruthy();
      expect(d.off(25)).toContain('25');
      const sr = d.srPrice('USD 9', 'USD 12', 10);
      expect(sr).toContain('USD 9');
      expect(sr).toContain('USD 12');
    }
  });
});

describe('Soporte 24/7', () => {
  it('describe emergencias, reparación y mantenimiento, en remoto o presencial', async () => {
    const { getService } = await import('@/model/catalog');
    const soporte = getService('soporte');
    for (const locale of LOCALES) {
      const text = [soporte.tagline[locale], soporte.summary[locale], ...soporte.includes.map((i) => i[locale])].join(' ').toLowerCase();
      expect(text, locale).toMatch(/emerg/);
      expect(text, locale).toMatch(/repar|conserto|repair/);
      expect(text, locale).toMatch(/manten|manuten|maintenance/);
      expect(text, locale).toMatch(/remot|presencial|on-site/);
    }
    // La modalidad define si hay que ir o no: es dato crítico del pedido.
    expect(soporte.questions.find((q) => q.id === 's_modalidad')?.required).toBe(true);
  });
});

describe('trazabilidad', () => {
  it('el pie del mensaje lleva dominio, idioma y versión del formulario', () => {
    expect(buildMessage(input(['ia']))).toContain(`_Enviado desde ejemplo.dev · ES · v${SURVEY_VERSION}_`);
  });

  it('el origen de la visita viaja en el mensaje, en cada idioma', () => {
    expect(buildMessage(input(['ia'], { origin: 'tarjeta' }))).toContain(`v${SURVEY_VERSION} · origen: tarjeta_`);
    expect(buildMessage(input(['ia'], { origin: 'tarjeta', locale: 'en' }))).toContain('· source: tarjeta_');
    expect(buildMessage(input(['ia']))).not.toContain('origen');
  });

  it('normaliza el origen: solo caracteres seguros y hasta 24', () => {
    expect(normalizeOrigin('Tarjeta')).toBe('tarjeta');
    expect(normalizeOrigin('qr_2026-11')).toBe('qr_2026-11');
    expect(normalizeOrigin('<script>alert(1)</script>')).toBe('');
    expect(normalizeOrigin('a'.repeat(25))).toBe('');
    expect(normalizeOrigin('con espacio')).toBe('');
    expect(normalizeOrigin(undefined)).toBe('');
  });

  it('el primer origen gana, sobrevive al reinicio y se valida al recuperarlo', () => {
    let s = surveyReducer(initialState, { type: 'SET_ORIGIN', origin: 'tarjeta' });
    expect(s.origin).toBe('tarjeta');
    s = surveyReducer(s, { type: 'SET_ORIGIN', origin: 'otro' });
    expect(s.origin).toBe('tarjeta');
    expect(surveyReducer(s, { type: 'RESTART' }).origin).toBe('tarjeta');
    expect(sanitize({ ...s, origin: '<img onerror=x>' }).origin).toBe('');
    expect(sanitize({ ...s }).origin).toBe('tarjeta');
  });

  it('un origen inválido no cambia el estado', () => {
    expect(surveyReducer(initialState, { type: 'SET_ORIGIN', origin: '<x>' })).toBe(initialState);
  });
});
