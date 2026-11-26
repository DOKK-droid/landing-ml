/* Condiciones del catálogo y controles de formato (correo, teléfono, web) con la sugerencia de correo. */
import { describe, expect, it } from 'vitest';
import { evaluate, references } from '@/model/conditions';
import { allQuestions } from '@/model/catalog';
import type { Condition } from '@/model/types';
import { matchesFormat, normalizePhone, suggestEmail, validateQuestion } from '@/model/validation';
import { toggleChoice } from '@/view/survey/Composer';

describe('condiciones', () => {
  const ctx = { services: ['ia', 'soporte'] as const, answers: { p_perfil: 'empresa', x_herramientas: ['papel', 'propio'], p_correo: '  ' } };
  const cases: [Condition, boolean][] = [
    [{ services: ['ia'] }, true],
    [{ services: ['gestion', 'desarrollo'] }, false],
    [{ onlyServices: ['ia', 'soporte', 'gestion'] }, true],
    [{ onlyServices: ['soporte'] }, false],
    [{ minServices: 2 }, true],
    [{ minServices: 3 }, false],
    [{ answered: 'p_perfil' }, true],
    [{ answered: 'p_correo' }, false], // solo espacios no es una respuesta
    [{ answered: 'no_existe' }, false],
    [{ answer: 'x_herramientas', in: ['propio', 'comercial'] }, true],
    [{ answer: 'x_herramientas', in: ['nada'] }, false],
    [{ answer: 'x_herramientas', only: ['papel', 'propio', 'planillas'] }, true],
    [{ answer: 'x_herramientas', only: ['papel'] }, false],
    [{ answer: 'no_existe', only: ['x'] }, false], // sin respuesta, «solo» no se cumple
    [{ answer: 'p_perfil', in: ['empresa'] }, true],
    [{ all: [{ services: ['ia'] }, { answered: 'p_perfil' }] }, true],
    [{ all: [{ services: ['ia'] }, { answered: 'p_correo' }] }, false],
    [{ any: [{ services: ['gestion'] }, { answered: 'p_perfil' }] }, true],
    [{ not: { services: ['ia'] } }, false],
  ];
  it.each(cases)('%j → %s', (condition, expected) => {
    expect(evaluate(condition, ctx)).toBe(expected);
  });

  it('`onlyServices` sin servicios elegidos no se cumple', () => {
    expect(evaluate({ onlyServices: ['soporte'] }, { services: [], answers: {} })).toBe(false);
  });

  it('una condición desconocida es un error del catálogo, no un «no»', () => {
    expect(() => evaluate({ rara: 1 } as unknown as Condition, ctx)).toThrow(/desconocida/);
  });

  it('lista las preguntas que mira', () => {
    expect(references({ all: [{ services: ['ia'] }, { not: { answer: 'a', in: ['x'] } }, { any: [{ answered: 'b' }, { answer: 'c', only: ['y'] }] }] }))
      .toEqual(['a', 'b', 'c']);
    expect(references(undefined)).toEqual([]);
  });
});

describe('formatos', () => {
  it('correo: el mismo patrón que el servidor', () => {
    for (const ok of ['ana@empresa.com', 'ana.perez+crm@empresa.com.ar', 'A@B.CO']) expect(matchesFormat('email', ok), ok).toBe(true);
    for (const bad of ['nn', 'ana@empresa', 'ana empresa@x.com', 'ana@@x.com', '<a@b.com>', 'a,b@x.com', `${'a'.repeat(120)}@x.com`]) {
      expect(matchesFormat('email', bad), bad).toBe(false);
    }
  });

  it('teléfono: 8 a 15 dígitos, con o sin «+», con separadores y con 00 internacional', () => {
    for (const ok of ['+54 9 11 1234-5678', '+1 (512) 555-0100', '011 4567 8901', '0054 9 11 1234 5678', '11.4567.8901']) expect(matchesFormat('phone', ok), ok).toBe(true);
    for (const bad of ['1234', '+54 9 11 1234 5678 9999 1', 'llamame', '+54-abc-1234', '++5491112345678']) expect(matchesFormat('phone', bad), bad).toBe(false);
    expect(normalizePhone(' 0054 (9) 11-1234.5678 ')).toBe('+5491112345678');
  });

  it('web: un dominio (con o sin esquema y ruta) o un usuario de red social', () => {
    for (const ok of ['empresa.com', 'www.empresa.com.ar/tienda', 'https://empresa.com', 'http://sub.empresa.io:8080/a?b=c', 'instagram.com/empresa', '@empresa.ok']) {
      expect(matchesFormat('url', ok), ok).toBe(true);
    }
    for (const bad of ['empresa', 'javascript:alert(1)', 'https://', 'empresa .com', '@a', 'ftp://empresa.com', 'https://empresa.com/<script>', 'data:text/html,x']) {
      expect(matchesFormat('url', bad), bad).toBe(false);
    }
  });

  it('un texto opcional vacío no tiene error; uno con otra forma, sí (aunque sea opcional)', () => {
    const correo = allQuestions(['ia']).find((q) => q.id === 'p_correo')!;
    expect(validateQuestion(correo, {})).toEqual({});
    expect(validateQuestion(correo, { p_correo: '   ' })).toEqual({});
    expect(validateQuestion(correo, { p_correo: 'ana@' })).toEqual({ p_correo: 'format' });
    expect(validateQuestion(correo, { p_correo: 'ana@empresa.com' })).toEqual({});
  });
});

describe('sugerencia de correo', () => {
  it.each([
    ['ana@gmial.com', 'ana@gmail.com'],
    ['ana@gmail.con', 'ana@gmail.com'],
    ['ana@gmail.co', 'ana@gmail.com'],
    ['Ana@Hotmial.com', 'Ana@hotmail.com'],
    ['ana@outlok.com', 'ana@outlook.com'],
    ['ana@empresa.con', 'ana@empresa.com'],
    ['ana@empresa.com.ra', 'ana@empresa.com.ar'],
  ])('%s → %s', (typed, expected) => {
    expect(suggestEmail(typed)).toBe(expected);
  });

  it('sin error conocido, no sugiere nada', () => {
    for (const typed of ['ana@gmail.com', 'ana@empresa.com.ar', 'ana', '@gmial.com', '']) expect(suggestEmail(typed), typed).toBeNull();
  });
});

describe('opciones exclusivas', () => {
  const herramientas = allQuestions(['gestion']).find((q) => q.id === 'x_herramientas')!;
  it('una exclusiva queda sola y otra opción la desmarca', () => {
    expect(toggleChoice(herramientas, ['papel', 'planillas'], 'nada')).toEqual(['nada']);
    expect(toggleChoice(herramientas, ['nada'], 'nose')).toEqual(['nose']);
    expect(toggleChoice(herramientas, ['nose'], 'papel')).toEqual(['papel']);
    expect(toggleChoice(herramientas, ['papel'], 'planillas')).toEqual(['papel', 'planillas']);
    expect(toggleChoice(herramientas, ['papel', 'planillas'], 'papel')).toEqual(['planillas']);
  });
});
