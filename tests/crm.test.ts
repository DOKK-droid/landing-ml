/* Conexión con el CRM: el cuerpo que se envía, las referencias, la llamada de red y la política de contenido que la permite.
 * El contrato es el de docs/SEGURIDAD.md 7.5; el servidor (landing_crm.api.submit_lead) lo valida de nuevo y no confía en nada. */
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { site } from '@/config/site';
import { registerLead, submitUrl, SUBMIT_PATH } from '@/controller/registerLead';
import { TURNSTILE_ORIGIN as CLIENT_TURNSTILE_ORIGIN } from '@/controller/turnstile';
import { deliver } from '@/controller/whatsapp';
import { buildSections } from '@/model/catalog';
import { answersOf, buildSubmission, crmEnabled, crmOrigin, MAX_MESSAGE_LENGTH, MAX_OFFER_LENGTH, newIdempotencyKey, offerSummary } from '@/model/crm';
import {
  buildWhatsAppUrl, cleanText, createReference, isLocalReference, isServerReference, isValidReference, REFERENCE_PATTERN, replaceReference, SURVEY_VERSION,
} from '@/model/message';
import { buildCsp, checkHtml, crmOrigin as buildCrmOrigin, hardenHtml, parseCsp, TURNSTILE_ORIGIN } from '../scripts/lib/harden.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SELECTED = ['ia' as const];
const SECTIONS = buildSections(SELECTED);
const ANSWERS = { p_nombre: 'Ana Pérez', p_correo: '', p_org: 'Acme', p_ubicacion: 'Posadas, Argentina', no_existe: 'x' };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('referencias: local (navegador) y del servidor', () => {
  it('la local siempre lleva una letra, así que nunca se confunde con la del servidor (solo dígitos)', () => {
    for (let i = 0; i < 5000; i += 1) {
      const ref = createReference();
      expect(isLocalReference(ref), ref).toBe(true);
      expect(isServerReference(ref), ref).toBe(false);
    }
  });

  it('el servidor emite ML-AAMMDD-NNNN, que se acepta como referencia pero no es local', () => {
    expect(isServerReference('ML-261124-0042')).toBe(true);
    expect(isLocalReference('ML-261124-0042')).toBe(false);
    expect(isValidReference('ML-261124-0042')).toBe(true);
    expect(isValidReference('ML-261124-AB3K')).toBe(true);
  });

  it('rechaza lo que no es una referencia', () => {
    for (const bad of ['', 'ML-261124-004', 'ML-261124-00420', 'ML-26112-0042', 'ml-261124-0042', 'ML-261124-AB3O', 'ML-261124-0042\n', 42, null, undefined]) {
      expect(isValidReference(bad), String(bad)).toBe(false);
      expect(isServerReference(bad), String(bad)).toBe(false);
    }
  });

  it('el patrón que usa el script de reanudación acepta las dos formas', () => {
    expect(REFERENCE_PATTERN.test('ML-261124-0042')).toBe(true);
    expect(REFERENCE_PATTERN.test('ML-261124-AB3K')).toBe(true);
  });

  it('el enlace de WhatsApp no lleva caracteres invisibles ni de control, y el texto no puede alterar la dirección', () => {
    const url = buildWhatsAppUrl('Hola​‍\u202Eolleh﻿\u2066 x\u0000\ny&phone=1#z', '549000');
    expect(url.startsWith('https://wa.me/549000?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe('Holaolleh x\ny&phone=1#z');
    expect(new URL(url).searchParams.get('phone')).toBeNull(); // el «&phone=» quedó dentro del texto
    expect(cleanText('é')).toBe('é'); // forma NFC, como el servidor
  });

  it('replaceReference cambia todas las apariciones y no toca un texto sin ella', () => {
    expect(replaceReference('Ref. A y otra vez A', 'A', 'B')).toBe('Ref. B y otra vez B');
    expect(replaceReference('sin nada', 'ML-1', 'ML-2')).toBe('sin nada');
    expect(replaceReference('x', '', 'y')).toBe('x');
  });
});

describe('cuerpo que se envía al servidor', () => {
  const submission = buildSubmission({
    locale: 'es', selected: SELECTED, sections: SECTIONS, answers: ANSWERS, origin: 'tarjeta',
    idempotencyKey: '0b8f6a52-6d3e-4f3a-9a53-0c3f5f7d9e11', visitKey: '5d1c2e7a-0a43-4b8e-9f1c-2a6b3c4d5e6f', turnstile: 'tok',
  });

  it('tiene exactamente los campos del contrato', () => {
    expect(Object.keys(submission).sort()).toEqual(
      ['answers', 'consent', 'form_version', 'idempotency_key', 'locale', 'offer', 'origin', 'services', 'turnstile', 'visit_key', 'website'],
    );
    expect(submission).toMatchObject({
      consent: true, website: '', turnstile: 'tok', locale: 'es', origin: 'tarjeta', services: ['ia'], form_version: SURVEY_VERSION,
      visit_key: '5d1c2e7a-0a43-4b8e-9f1c-2a6b3c4d5e6f',
    });
  });

  it('manda solo las respuestas del recorrido y con contenido (el servidor descartaría el resto)', () => {
    expect(submission.answers).toEqual({ p_nombre: 'Ana Pérez', p_org: 'Acme', p_ubicacion: 'Posadas, Argentina' });
    expect(answersOf(SECTIONS, { p_nombre: '   ' })).toEqual({});
  });

  it('la oferta es corta y está dentro del límite del servidor (más largo, rechaza la consulta entera)', () => {
    expect(submission.offer).toBe('USD 54/h (USD 9/10 min)');
    expect(submission.offer.length).toBeLessThanOrEqual(MAX_OFFER_LENGTH);
    expect(offerSummary(['soporte'])).toBe(''); // el soporte 24/7 no lleva la consulta
  });

  it('el mensaje editado a mano viaja solo si existe, limpio y dentro del límite del servidor', () => {
    const base = { locale: 'es' as const, selected: SELECTED, sections: SECTIONS, answers: ANSWERS, origin: '', idempotencyKey: 'k', visitKey: 'v', turnstile: 't' };
    expect('message' in buildSubmission({ ...base, message: null })).toBe(false);
    expect('message' in buildSubmission({ ...base, message: '  ' })).toBe(false);
    expect(buildSubmission({ ...base, message: ' Hola​\u202E mundo﻿\u0007 ' }).message).toBe('Hola mundo');
    expect(buildSubmission({ ...base, message: 'x'.repeat(MAX_MESSAGE_LENGTH + 50) }).message).toHaveLength(MAX_MESSAGE_LENGTH);
  });

  it('la clave de idempotencia es un UUID v4, con o sin randomUUID', () => {
    expect(newIdempotencyKey()).toMatch(UUID);
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    const keys = new Set(Array.from({ length: 50 }, newIdempotencyKey));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(UUID);
  });
});

describe('activación: dos variables de build, o el sitio sigue como antes', () => {
  it('sin URL o sin clave de Turnstile está apagada', () => {
    expect(crmEnabled({ url: '', turnstileSiteKey: 'k' })).toBe(false);
    expect(crmEnabled({ url: 'https://api.ejemplo.com', turnstileSiteKey: '' })).toBe(false);
    expect(crmEnabled({ url: 'https://api.ejemplo.com', turnstileSiteKey: 'k' })).toBe(true);
  });

  it('en las pruebas está apagada por defecto (no hay variables de entorno)', () => {
    expect(crmEnabled()).toBe(false);
    expect(site.crm.timeoutMs).toBeGreaterThan(0);
  });

  it('solo https (http únicamente en localhost) y se queda con el origen', () => {
    expect(crmOrigin('https://api.ejemplo.com/ruta?x=1')).toBe('https://api.ejemplo.com');
    expect(crmOrigin('http://localhost:8000')).toBe('http://localhost:8000');
    for (const bad of ['', 'api.ejemplo.com', 'http://api.ejemplo.com', 'ftp://x', 'javascript:alert(1)']) expect(crmOrigin(bad), bad).toBe('');
  });

  it('el navegador y el build calculan el mismo origen (si no, la CSP bloquearía la llamada)', () => {
    for (const url of ['', 'x', 'https://api.atlasdigi.org', 'https://api.atlasdigi.org/a/b?c=d#e', 'http://localhost:8000/x', 'http://127.0.0.1', 'http://evil.com', 'https://user:pw@host.com:8443/p', 'file:///etc/passwd']) {
      expect(crmOrigin(url), url).toBe(buildCrmOrigin(url));
    }
  });

  it('la ruta del método es la que permite la regla de la WAF', () => {
    expect(SUBMIT_PATH).toBe('/api/method/landing_crm.api.submit_lead');
    expect(submitUrl('https://api.ejemplo.com/otra/ruta')).toBe('https://api.ejemplo.com/api/method/landing_crm.api.submit_lead');
    expect(submitUrl('')).toBe('');
  });
});

describe('registerLead: nunca lanza y siempre dice qué pasó', () => {
  const submission = buildSubmission({ locale: 'es', selected: SELECTED, sections: SECTIONS, answers: ANSWERS, origin: '', idempotencyKey: 'k', visitKey: 'v', turnstile: 'tok' });
  const options = (fetchImpl: typeof fetch) => ({ url: 'https://api.ejemplo.com', timeoutMs: 4000, fetchImpl });
  const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

  it('éxito: devuelve la referencia del servidor y qué envío fue', async () => {
    const fetchImpl = reply({ message: { reference: 'ML-261124-0042', submission: 3 } });
    expect(await registerLead(submission, options(fetchImpl as unknown as typeof fetch))).toEqual({ ok: true, reference: 'ML-261124-0042', submission: 3 });
  });

  it('un número de envío ausente (servidor anterior) o raro cuenta como el primero', async () => {
    for (const value of [undefined, 0, -1, 1.5, '2', 1000, null]) {
      const fetchImpl = reply({ message: { reference: 'ML-261124-0042', submission: value } });
      const result = await registerLead(submission, options(fetchImpl as unknown as typeof fetch));
      expect(result, String(value)).toEqual({ ok: true, reference: 'ML-261124-0042', submission: 1 });
    }
  });

  it('la petición es un POST de JSON, sin cookies, sin seguir redirecciones y con el cuerpo del contrato', async () => {
    const fetchImpl = reply({ message: { reference: 'ML-261124-0042' } });
    await registerLead(submission, options(fetchImpl as unknown as typeof fetch));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.ejemplo.com/api/method/landing_crm.api.submit_lead');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', mode: 'cors', redirect: 'error', cache: 'no-store' });
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(submission);
  });

  it.each([[417], [403], [429], [500]])('el servidor rechaza con %i: sigue sin registro', async (status) => {
    expect(await registerLead(submission, options(reply('{}', status) as unknown as typeof fetch))).toEqual({ ok: false, reason: 'rejected' });
  });

  it('una respuesta que no trae una referencia del servidor no se acepta (ni una local, ni texto)', async () => {
    for (const body of [{}, { message: {} }, { message: { reference: 'ML-261124-AB3K' } }, { message: { reference: '<b>x</b>' } }, { message: 'ML-261124-0042' }, 'no es json', 'null']) {
      expect(await registerLead(submission, options(reply(body) as unknown as typeof fetch)), JSON.stringify(body)).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('sin red: devuelve el fallo, no lo lanza', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await registerLead(submission, options(down as unknown as typeof fetch))).toEqual({ ok: false, reason: 'network' });
  });

  it('pasado el tiempo límite se corta y el cliente sigue a WhatsApp', async () => {
    vi.useFakeTimers();
    const hang = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const pending = registerLead(submission, options(hang as unknown as typeof fetch));
    await vi.advanceTimersByTimeAsync(3999);
    let settled = false;
    void pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ ok: false, reason: 'timeout' });
  });

  it('sin una dirección usable no hace ninguna llamada', async () => {
    const fetchImpl = reply({});
    expect(await registerLead(submission, { url: 'http://evil.example', timeoutMs: 4000, fetchImpl: fetchImpl as unknown as typeof fetch })).toEqual({ ok: false, reason: 'disabled' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('deliver: a la pestaña abierta o, si no hay, a esta', () => {
  const popup = (closed = false) => ({ closed, location: { href: '' } }) as unknown as Window;

  it('con la pestaña abierta, la dirige a WhatsApp', () => {
    const tab = popup();
    const navigate = vi.fn();
    deliver(tab, 'https://wa.me/1', navigate);
    expect(tab.location.href).toBe('https://wa.me/1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('si el navegador la bloqueó (null) o el cliente la cerró, navega en la misma pestaña', () => {
    for (const tab of [null, popup(true)]) {
      const navigate = vi.fn();
      deliver(tab, 'https://wa.me/1', navigate);
      expect(navigate).toHaveBeenCalledWith('https://wa.me/1');
    }
  });
});

describe('política de contenido con Turnstile', () => {
  const PAGE = '<html><head></head><body><script>var a=1</script></body></html>';
  const csp = (turnstile: boolean) => parseCsp(buildCsp(['x'], { connect: ['https://api.ejemplo.com'], turnstile }));

  it('es el mismo origen en el navegador y en el build', () => {
    expect(TURNSTILE_ORIGIN).toBe(CLIENT_TURNSTILE_ORIGIN);
    expect(TURNSTILE_ORIGIN).toBe('https://challenges.cloudflare.com');
  });

  it('apagado: sin marcos y ningún origen externo de scripts (como antes)', () => {
    const off = csp(false);
    expect(off['frame-src']).toEqual(["'none'"]);
    expect(off['script-src'].some((v) => v.startsWith('https:'))).toBe(false);
    expect(off['connect-src']).toEqual(["'self'", 'https://api.ejemplo.com']);
  });

  it('encendido: ese origen exacto en script-src, frame-src y connect-src, y nada más', () => {
    const on = csp(true);
    expect(on['script-src'].filter((v) => v.startsWith('https:'))).toEqual([TURNSTILE_ORIGIN]);
    expect(on['frame-src']).toEqual([TURNSTILE_ORIGIN]);
    expect(on['connect-src']).toEqual(["'self'", 'https://api.ejemplo.com', TURNSTILE_ORIGIN]);
    expect(on['script-src']).not.toContain("'unsafe-inline'");
    expect(on['script-src']).not.toContain("'unsafe-eval'");
    expect(on['worker-src']).toEqual(["'none'"]);
    expect(on['object-src']).toEqual(["'none'"]);
  });

  it('el verificador acepta la página endurecida con Turnstile, y sigue sin aceptar otros orígenes', async () => {
    const readAsset = () => null;
    const withTurnstile = hardenHtml(PAGE, readAsset, { connect: [], turnstile: true });
    expect(await checkHtml(withTurnstile, readAsset)).toEqual([]);
    expect(await checkHtml(hardenHtml(PAGE, readAsset), readAsset)).toEqual([]);

    const otherScript = withTurnstile.replace("script-src 'self'", "script-src 'self' https://evil.example");
    expect((await checkHtml(otherScript, readAsset)).join('\n')).toMatch(/origen externo/);

    const otherFrame = withTurnstile.replace(`frame-src ${TURNSTILE_ORIGIN}`, `frame-src ${TURNSTILE_ORIGIN} https://evil.example`);
    expect((await checkHtml(otherFrame, readAsset)).join('\n')).toMatch(/frame-src/);
    const wideFrame = withTurnstile.replace(`frame-src ${TURNSTILE_ORIGIN}`, 'frame-src *');
    expect((await checkHtml(wideFrame, readAsset)).join('\n')).toMatch(/frame-src/);
    const noFrame = withTurnstile.replace(`frame-src ${TURNSTILE_ORIGIN}; `, '');
    expect((await checkHtml(noFrame, readAsset)).join('\n')).toMatch(/frame-src/);
  });
});

describe('imágenes del CSS y la política img-src', () => {
  // El verificador de la CSP revisa el HTML, no las hojas de estilo: un `data:` URI en el CSS solo se descubre en un navegador
  // (así pasó con el fondo de grano). `img-src 'self'` solo admite archivos del propio sitio.
  const css = readFileSync('src/styles/globals.css', 'utf8');
  const urls = [...css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/g)].map((m) => m[2]);

  it('el CSS no usa data: URI ni orígenes externos', () => {
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url, url.slice(0, 60)).not.toMatch(/^(data:|blob:|https?:|\/\/)/i);
  });

  it('cada archivo que el CSS pide por ruta absoluta existe en public/', () => {
    const files = urls.filter((url) => url.startsWith('/'));
    expect(files).toContain('/grain.svg');
    for (const file of files) expect(existsSync(`public${file}`), file).toBe(true);
  });

  it('el grano es un SVG válido y chico', () => {
    const svg = readFileSync('public/grain.svg', 'utf8');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('feTurbulence');
    expect(svg).not.toMatch(/<script|on[a-z]+=|href=/i); // un SVG de imagen no lleva scripts ni enlaces
    expect(svg.length).toBeLessThan(1000);
  });
});
