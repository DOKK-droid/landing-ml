import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { RESUME_ATTR, RESUME_FAILSAFE_MS, STORAGE_KEY, resumeScript } from '@/controller/resume';
import { initialState, sanitize, type SurveyState } from '@/controller/surveyReducer';

/** Ejecuta el script de <head> contra un "navegador" mínimo y devuelve lo que hizo. */
function runScript(stored: string | null | (() => never), pathname = '/es/') {
  const calls: string[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const keysRead: string[] = [];
  runInNewContext(resumeScript, {
    location: { pathname },
    sessionStorage: {
      getItem: (key: string) => {
        keysRead.push(key);
        return typeof stored === 'function' ? stored() : stored;
      },
    },
    document: {
      documentElement: {
        setAttribute: (name: string) => calls.push(`set ${name}`),
        removeAttribute: (name: string) => calls.push(`remove ${name}`),
      },
    },
    setTimeout: (fn: () => void, ms: number) => {
      timers.push({ fn, ms });
      return 1;
    },
  });
  return { calls, timers, keysRead };
}

const REF = 'ML-261120-K7QM';
const saved = (patch: Partial<SurveyState>) => JSON.stringify({ ...initialState, reference: REF, ...patch });

describe('reanudar tras cambiar de idioma', () => {
  it('marca <html> si hay un relevamiento en curso', () => {
    for (const phase of ['survey', 'review', 'sent'] as const) {
      const { calls, keysRead } = runScript(saved({ phase, selected: ['ia'] }));
      expect(calls).toEqual([`set ${RESUME_ATTR}`]);
      expect(keysRead).toEqual([STORAGE_KEY]);
    }
  });

  it('no marca nada en la landing, sin servicios, sin datos o con datos corruptos', () => {
    expect(runScript(saved({ phase: 'landing', selected: ['ia'] })).calls).toEqual([]);
    expect(runScript(saved({ phase: 'survey', selected: [] })).calls).toEqual([]);
    expect(runScript(saved({ phase: 'otra' as never, selected: ['ia'] })).calls).toEqual([]);
    expect(runScript(saved({ phase: 'survey', selected: ['ia'], reference: '' })).calls).toEqual([]); // sin referencia válida sanitize() vuelve a la landing
    expect(runScript(saved({ phase: 'survey', selected: ['ia'], reference: '<x>' })).calls).toEqual([]);
    expect(runScript(null).calls).toEqual([]);
    expect(runScript('{no es json').calls).toEqual([]);
  });

  it('no lanza errores si sessionStorage no está disponible', () => {
    expect(() => runScript(() => { throw new Error('bloqueado'); })).not.toThrow();
  });

  it('quita la marca sola pasado el tiempo de seguridad', () => {
    const { calls, timers } = runScript(saved({ phase: 'survey', selected: ['ia'] }));
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(RESUME_FAILSAFE_MS);
    timers[0].fn();
    expect(calls).toEqual([`set ${RESUME_ATTR}`, `remove ${RESUME_ATTR}`]);
  });

  it('marca exactamente cuando el estado restaurado ya no será la landing', () => {
    // El script y sanitize() deben coincidir: lo que el script oculta, la hidratación lo reemplaza por el paso.
    for (const phase of ['survey', 'review', 'sent'] as const) {
      const raw = saved({ phase, selected: ['ia', 'soporte'] });
      expect(runScript(raw).calls.length).toBe(1);
      expect(sanitize(JSON.parse(raw)).phase).toBe(phase);
    }
  });
});
