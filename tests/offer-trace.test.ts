/* QA de la oferta del relevamiento técnico (cobro POR TRAMOS; se muestra el precio de la hora y su equivalencia por 10 min) y de la trazabilidad (referencia, versión del formulario, origen). */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialState, sanitize, surveyReducer } from '@/controller/surveyReducer';
import { site } from '@/config/site';
import { buildSections } from '@/model/catalog';
import { DICTIONARIES } from '@/model/i18n';
import { buildMessage, SURVEY_VERSION, type MessageInput } from '@/model/message';
import { blockRate, CONSULTA, consultationApplies, discountPercent, EXAMPLE_MINUTES, formatDuration, formatMoney, hourly, meetingCost, offerFigures, offerRates } from '@/model/offer';
import { LOCALES, type ServiceId } from '@/model/types';
import { normalizeOrigin } from '@/model/validation';
import { Hero, OfferSection } from '@/view/components/Sections';

const input = (selected: ServiceId[], extra: Partial<MessageInput> = {}): MessageInput => ({
  locale: 'es', selected, sections: buildSections(selected), answers: {}, reference: 'ML-261120-ABCD', siteUrl: 'https://ejemplo.dev', ...extra,
});

describe('oferta del relevamiento técnico', () => {
  it('la oferta es coherente: precio menor que el normal, tramos crecientes y cada tramo más barato que el anterior', () => {
    expect(CONSULTA).toBe(site.consulta);
    expect(CONSULTA.minutes).toBeGreaterThan(0);
    expect(CONSULTA.price).toBeGreaterThan(0);
    expect(CONSULTA.price).toBeLessThan(CONSULTA.originalPrice);
    expect(CONSULTA.promoFrom).toBeGreaterThan(0);
    let after = CONSULTA.promoFrom, price: number = CONSULTA.price;
    for (const tier of CONSULTA.tiers) {
      expect(tier.after, 'los tramos van en orden').toBeGreaterThan(after);
      expect(tier.price, 'cada tramo cuesta menos que el anterior').toBeLessThan(price);
      after = tier.after;
      price = tier.price;
    }
  });

  it('oferta acordada: desde 1 h, USD 9 cada 10 min; USD 8 los bloques que pasan de 2 h y USD 7 los que pasan de 3 h 30; normal USD 12', () => {
    // Si se cambia la oferta en src/config/site.ts, este test avisa para revisar también docs y textos.
    expect(CONSULTA).toEqual({ minutes: 10, price: 9, originalPrice: 12, currency: 'USD', promoFrom: 60, tiers: [{ after: 120, price: 8 }, { after: 210, price: 7 }] });
    expect(discountPercent(CONSULTA)).toBe(25);
    expect(formatMoney(CONSULTA.price, CONSULTA.currency)).toBe('USD 9');
    expect(formatMoney(CONSULTA.originalPrice, CONSULTA.currency)).toBe('USD 12');
  });

  it('cada bloque se cobra al precio del tramo donde EMPIEZA: el 8 solo desde los 2 h y el 7 solo desde las 3 h 30, sin recalcular los anteriores', () => {
    expect(blockRate(0)).toBe(9);
    expect(blockRate(110)).toBe(9); // el bloque de 1 h 50 a 2 h todavía es de 9
    expect(blockRate(120)).toBe(8); // el primero que pasa de 2 h
    expect(blockRate(200)).toBe(8);
    expect(blockRate(210)).toBe(7); // el primero que pasa de 3 h 30
    expect(blockRate(600)).toBe(7);
  });

  it('totales por tramos', () => {
    const total = (m: number) => meetingCost(m).price;
    expect(total(60)).toBe(54); // 6 × 9
    expect(total(90)).toBe(81);
    expect(total(120)).toBe(108); // 12 × 9
    expect(total(121)).toBe(116); // 12 × 9 + 1 × 8: solo el bloque nuevo va a 8
    expect(total(130)).toBe(116);
    expect(total(131)).toBe(124);
    expect(total(180)).toBe(156); // 12 × 9 + 6 × 8
    expect(total(210)).toBe(180); // 12 × 9 + 9 × 8
    expect(total(211)).toBe(187); // + 1 × 7
    expect(total(240)).toBe(201); // 12 × 9 + 9 × 8 + 3 × 7
    expect(meetingCost(240)).toEqual({ blocks: 24, price: 201, originalPrice: 288, promo: true });
    expect(meetingCost(0)).toEqual({ blocks: 0, price: 0, originalPrice: 0, promo: false });
  });

  it('con menos de 1 h rige la tarifa normal en todos los bloques (la oferta empieza en 1 h)', () => {
    expect(meetingCost(10)).toEqual({ blocks: 1, price: 12, originalPrice: 12, promo: false });
    expect(meetingCost(30)).toEqual({ blocks: 3, price: 36, originalPrice: 36, promo: false });
    expect(meetingCost(59)).toEqual({ blocks: 6, price: 72, originalPrice: 72, promo: false }); // 59 min se cobran como 6 bloques
    expect(meetingCost(60)).toEqual({ blocks: 6, price: 54, originalPrice: 72, promo: true });
  });

  it('el salto a la 1 h es a propósito (menos de 1 h cuesta más que 1 h): es lo único que baja; a partir de ahí el total siempre sube', () => {
    expect(meetingCost(59).price).toBeGreaterThan(meetingCost(60).price);
    let prev = meetingCost(60).price;
    for (let m = 61; m <= 600; m++) {
      const { price, blocks } = meetingCost(m);
      expect(price, `${m} min`).toBeGreaterThanOrEqual(prev);
      if (blocks > meetingCost(m - 1).blocks) expect(price, `${m} min: un bloque más cuesta más`).toBeGreaterThan(prev);
      prev = price;
    }
    // y sin las anomalías del esquema por reunión completa: pasar de 2 h o de 3 h 30 ya no abarata
    expect(meetingCost(121).price).toBeGreaterThan(meetingCost(120).price);
    expect(meetingCost(211).price).toBeGreaterThan(meetingCost(210).price);
  });

  it('un tramo incompleto se cobra como un bloque más', () => {
    expect(meetingCost(11).blocks).toBe(2);
    expect(meetingCost(95).blocks).toBe(10);
    expect(meetingCost(95).price).toBe(90); // 10 bloques de 9
  });

  it('el costo no acumula errores de coma flotante con precios con decimales', () => {
    expect(meetingCost(30, { minutes: 10, price: 0.1, originalPrice: 0.2, currency: 'USD', promoFrom: 0, tiers: [] }).price).toBe(0.3);
  });

  it('la tarifa por tramos se muestra como filas contiguas: normal, 9, 8 y 7', () => {
    const rows = offerRates();
    expect(rows).toEqual([
      { from: 0, to: 60, price: 12, regular: true },
      { from: 60, to: 120, price: 9, regular: false },
      { from: 120, to: 210, price: 8, regular: false },
      { from: 210, to: null, price: 7, regular: false },
    ]);
    rows.slice(1).forEach((r, i) => expect(r.from).toBe(rows[i].to));
  });

  it('los ejemplos que se muestran son 30 min, 1 h, 2 h y 4 h, con su total por tramos', () => {
    expect(EXAMPLE_MINUTES).toEqual([30, 60, 120, 240]);
    expect(EXAMPLE_MINUTES.map(formatDuration)).toEqual(['30 min', '1 h', '2 h', '4 h']);
    expect(EXAMPLE_MINUTES.map((m) => meetingCost(m).price)).toEqual([36, 54, 108, 201]);
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

  it('la hora y su equivalencia por bloque: USD 54 la hora = USD 9 cada 10 min (antes USD 72 = USD 12), y la hora de cada tramo', () => {
    expect(hourly(9)).toBe(54);
    expect(hourly(12)).toBe(72);
    expect(hourly(8)).toBe(48);
    expect(hourly(7)).toBe(42);
    expect(offerFigures()).toEqual({ minutes: 10, hour: 'USD 54', hourOriginal: 'USD 72', block: 'USD 9', blockOriginal: 'USD 12', from: '1 h' });
    // la hora a precio de oferta es exactamente 6 bloques: coincide con el total de una reunión de 1 h
    expect(meetingCost(60).price).toBe(hourly(CONSULTA.price));
  });

  it('el mensaje registra la oferta vista por el cliente: la hora, su equivalencia por bloque, desde cuándo rige y que el total es por tramos, en su idioma', () => {
    expect(buildMessage(input(['ia']))).toContain('*Consulta:* USD 54 la hora (USD 9 cada 10 min), oferta desde 1 h; precio normal USD 72 la hora; total por tramos');
    expect(buildMessage(input(['ia'], { locale: 'pt' }))).toContain('*Consulta:* USD 54 a hora (USD 9 a cada 10 min), oferta a partir de 1 h; preço normal USD 72 a hora; total por faixas');
    expect(buildMessage(input(['ia'], { locale: 'en' }))).toContain('*Consultation:* USD 54 per hour (USD 9 per 10 min), offer from 1 h; regular price USD 72 per hour; total by tier');
  });

  it('un pedido solo de soporte no menciona la consulta', () => {
    expect(buildMessage(input(['soporte']))).not.toMatch(/Consulta:|Consultation:/);
  });

  it('los textos de la oferta existen, dicen cuánto cuesta la hora y su equivalencia por bloque, y no hablan de "referencia"', () => {
    const f = offerFigures();
    for (const locale of LOCALES) {
      const d = DICTIONARIES[locale].consulta;
      expect(d.badge && d.title && d.lead && d.support && d.supportLink && d.cta && d.hero && d.perHour && d.hourShort, locale).toBeTruthy();
      // la equivalencia: cuánto cuesta el bloque de 10 min y cuánto era
      const eq = d.equals(f);
      for (const part of [f.block, String(f.minutes), f.blockOriginal]) expect(eq, `${locale}: ${part}`).toContain(part);
      // el texto de lectores de pantalla da la hora, el bloque, desde cuándo y el precio normal
      const sr = d.srPrice(f);
      for (const part of [f.hour, f.hourOriginal, f.block, f.blockOriginal, f.from, String(f.minutes)]) expect(sr, `${locale}: ${part}`).toContain(part);
      const billing = d.billing(CONSULTA.minutes, f.from);
      expect(billing).toContain(String(CONSULTA.minutes));
      expect(billing).toContain(f.from);
      expect(billing, 'explica el cobro por tramos').toMatch(/tramo|faixa|tier/);
      expect(d.tiersTitle(CONSULTA.minutes)).toContain(String(CONSULTA.minutes));
      expect(d.tierBelow('1 h')).toContain('1 h');
      expect(d.tierBetween('1 h', '2 h')).toMatch(/1 h.*2 h/);
      expect(d.tierFrom('3 h')).toContain('3 h');
      expect(d.examples && d.was, locale).toBeTruthy();
      expect(d.off(25)).toContain('25');
      // nada de "referencia": el precio se presenta como lo que es
      for (const text of [d.perHour, d.hourShort, eq, sr, billing, d.tiersTitle(CONSULTA.minutes), DICTIONARIES[locale].message.consultValue(f)]) {
        expect(text, `${locale}: "${text}"`).not.toMatch(/referenc|referên|reference|\bref\./i);
      }
    }
  });

  it('la sección muestra cuánto cuesta la hora, su equivalencia por 10 min, la tarifa por tramos (por bloque y por hora) y los totales, en los tres idiomas', () => {
    for (const locale of LOCALES) {
      const html = renderToStaticMarkup(createElement(OfferSection, { locale, onStart: () => {} }));
      const d = DICTIONARIES[locale].consulta;
      const f = offerFigures();
      // el precio principal es el de la HORA (USD 54, antes USD 72) y debajo su equivalencia por bloque
      expect(html).toContain(f.hour);
      expect(html).toContain(f.hourOriginal);
      expect(html).toContain(d.perHour);
      expect(html).toContain(d.equals(f));
      expect(html).toContain(d.billing(CONSULTA.minutes, f.from));
      expect(html, 'no se habla de "referencia"').not.toMatch(/referenc|referên|reference/i);
      // los cuatro tramos, cada uno con su precio por bloque y por hora
      const tiers = html.slice(html.indexOf('offer__tiers'), html.indexOf('</ul>', html.indexOf('offer__tiers')));
      expect(tiers.match(/<li/g)).toHaveLength(4);
      for (const [block, hour] of [['USD 12', 'USD 72'], ['USD 9', 'USD 54'], ['USD 8', 'USD 48'], ['USD 7', 'USD 42']]) {
        expect(tiers, `${locale}: ${block} / 10 min`).toContain(`${block} / 10 min`);
        expect(tiers, `${locale}: ${hour} / h`).toContain(`${hour} / h`);
      }
      expect(tiers).toContain(d.tierBelow('1 h'));
      expect(tiers).toContain(d.tierBetween('1 h', '2 h'));
      expect(tiers).toContain(d.tierBetween('2 h', '3 h 30 min'));
      expect(tiers).toContain(d.tierFrom('3 h 30 min'));
      // los totales de ejemplo
      for (const total of ['USD 36', 'USD 54', 'USD 108', 'USD 201']) expect(html, `${locale}: ${total}`).toContain(total);
    }
  });

  it('el aviso del inicio da el precio de la hora (USD 54, antes USD 72), no el del bloque', () => {
    for (const locale of LOCALES) {
      const html = renderToStaticMarkup(createElement(Hero, { locale, onStart: () => {} }));
      const offer = html.slice(html.indexOf('hero__offer'), html.indexOf('</a>', html.indexOf('hero__offer')));
      expect(offer, locale).toContain('USD 54');
      expect(offer).toContain('USD 72');
      expect(offer).toContain(DICTIONARIES[locale].consulta.hourShort);
      expect(offer).not.toMatch(/referenc|referên|reference|\bref\./i);
    }
  });

  it('en los ejemplos solo se tacha el total normal cuando hay oferta: 30 min (tarifa normal) no lleva tachado, 1 h sí', () => {
    const html = renderToStaticMarkup(createElement(OfferSection, { locale: 'es', onStart: () => {} }));
    const examples = html.slice(html.lastIndexOf('offer__examples'));
    const row = (label: string) => examples.split('<li').find((r) => r.includes(`>${label}<`)) ?? '';
    expect(row('30 min')).not.toContain('<s>');
    expect(row('1 h')).toContain('<s>');
    expect(row('1 h')).toContain('USD 72');
    expect(row('4 h')).toContain('USD 288');
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
