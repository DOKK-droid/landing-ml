// @vitest-environment jsdom
/* Revisión y envío con el CRM activo, en un DOM simulado (jsdom): consentimiento, widget de Turnstile (simulado), registro,
 * y que WhatsApp se abra SIEMPRE, con la referencia del servidor si hubo registro y con la local marcada si no.
 * No reemplaza una prueba en un navegador real: ni Turnstile, ni la CSP, ni el bloqueo de ventanas se pueden probar acá. */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { site } from '@/config/site';
import { STORAGE_KEY } from '@/controller/resume';
import { SURVEY_VERSION } from '@/model/message';
import { App } from '@/view/App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOCAL = 'ML-261124-AB3K';
const SERVER = 'ML-261124-0042';
const crmConfig = site.crm as { url: string; turnstileSiteKey: string };

let root: Root | null = null;
let container: HTMLElement;
let popup: { closed: boolean; opener: unknown; location: { href: string } };
let prevented: boolean | null;
/** Registra si el controlador canceló el comportamiento por defecto del enlace (distingue "registrar" de "enlace de siempre"). */
const observeClick = (e: Event) => {
  prevented = e.defaultPrevented;
  e.preventDefault(); // jsdom no navega
};
const fetchMock = vi.fn();
const turnstile = { render: vi.fn(), reset: vi.fn(), remove: vi.fn() };

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const text = (sel: string) => $(sel)?.textContent?.trim() ?? '';
const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const click = (el: Element | null) => {
  if (!el) throw new Error('No se encontró el elemento a tocar');
  return act(async () => { (el as HTMLElement).click(); });
};

/** Lo que llegó a WhatsApp: la dirección de la pestaña y el mensaje ya decodificado. */
const whatsapp = () => {
  const href = popup.location.href;
  return { href, message: href.startsWith('https://wa.me/') ? decodeURIComponent(href.split('?text=')[1] ?? '') : '' };
};

function reply(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

/**
 * Un widget que entrega su token al dibujarse (o nunca, con `token: null`). Con `reset` entrega otro, como el de verdad:
 * el token es de un solo uso y el controlador pide uno nuevo después de cada envío.
 */
function widgetGives(token: string | null, next = 'tok-2') {
  turnstile.render.mockImplementation((_el: HTMLElement, options: { callback: (t: string) => void }) => {
    if (token) options.callback(token);
    turnstile.reset.mockImplementation(() => options.callback(next));
    return 'widget-1';
  });
}

async function mountInReview() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    phase: 'review', selected: ['ia'], cursor: 0, errors: {}, reference: LOCAL, origin: 'tarjeta', draft: null,
    answers: { p_nombre: 'Ana Pérez', p_org: 'Acme', p_ubicacion: 'Posadas, Argentina' },
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(createElement(App, { locale: 'es' })); });
  await flush();
}

const consentBox = () => $<HTMLInputElement>('.consent__box');
const sendLink = () => $<HTMLAnchorElement>('a.btn--whatsapp');

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = () => {};

  popup = { closed: false, opener: 'esta-pagina', location: { href: '' } };
  vi.spyOn(window, 'open').mockImplementation(() => popup as unknown as Window);
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  turnstile.render.mockReset();
  turnstile.reset.mockReset();
  turnstile.remove.mockReset();
  window.turnstile = turnstile;

  prevented = null;
  document.addEventListener('click', observeClick);
});

afterEach(async () => {
  document.removeEventListener('click', observeClick);
  if (root) await act(async () => root!.unmount());
  root = null;
  container?.remove();
  sessionStorage.clear();
  crmConfig.url = '';
  crmConfig.turnstileSiteKey = '';
  delete window.turnstile;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sin la conexión con el CRM (como hoy)', () => {
  it('no hay casilla ni widget, el pie dice lo de siempre y el envío es el enlace a WhatsApp, sin ninguna llamada', async () => {
    await mountInReview();
    expect(consentBox()).toBeNull();
    expect(text('.footer__legal p')).toMatch(/no guarda sus datos/);
    expect(sendLink()!.href).toMatch(/^https:\/\/wa\.me\//);

    await click(sendLink());
    expect(prevented).toBe(false); // el navegador sigue el enlace: nada se interpuso
    expect(window.open).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(turnstile.render).not.toHaveBeenCalled();
    await flush(500);
    expect(text('.sent__ref')).toBe(''); // sin registro no hay referencia del servidor que mostrar
  });
});

describe('con la conexión activa', () => {
  beforeEach(() => {
    crmConfig.url = 'https://api.ejemplo.com';
    crmConfig.turnstileSiteKey = 'site-key';
  });

  it('ofrece el consentimiento, desmarcado y sin cargar nada de Cloudflare hasta que se marque; el pie lo refleja', async () => {
    await mountInReview();
    expect(consentBox()).not.toBeNull();
    expect(consentBox()!.checked).toBe(false);
    expect(text('.consent__note')).toMatch(/opcional/);
    expect($('.consent__widget')).toBeNull();
    expect(turnstile.render).not.toHaveBeenCalled();
    expect(text('.footer__legal p')).toMatch(/Solo si lo autoriza/);
  });

  it('sin consentimiento es el enlace de siempre: sin registro, sin widget y sin llamadas', async () => {
    await mountInReview();
    await click(sendLink());
    expect(prevented).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    expect(turnstile.render).not.toHaveBeenCalled();
  });

  it('al marcar el consentimiento se dibuja el widget (con la clave pública y el idioma) y se pide un token', async () => {
    widgetGives('tok-1');
    await mountInReview();
    await click(consentBox());
    await flush();
    expect($('.consent__widget')).not.toBeNull();
    expect(turnstile.render).toHaveBeenCalledTimes(1);
    expect(turnstile.render.mock.calls[0][1]).toMatchObject({ sitekey: 'site-key', language: 'es', appearance: 'interaction-only' });
  });

  it('registra y abre WhatsApp con la referencia del servidor, no con la local', async () => {
    widgetGives('tok-1');
    reply(200, { message: { reference: SERVER } });
    await mountInReview();
    await click(consentBox());
    await flush();

    await click(sendLink());
    await flush();

    expect(prevented).toBe(true);
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank'); // se abre en el gesto del clic, antes de esperar
    expect(popup.opener).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.ejemplo.com/api/method/landing_crm.api.submit_lead');
    expect(init.credentials).toBe('omit');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      locale: 'es', form_version: SURVEY_VERSION, origin: 'tarjeta', services: ['ia'], consent: true, turnstile: 'tok-1', website: '',
      answers: { p_nombre: 'Ana Pérez', p_org: 'Acme', p_ubicacion: 'Posadas, Argentina' },
    });
    expect(body.idempotency_key).toMatch(/^[0-9a-f-]{36}$/);

    const { href, message } = whatsapp();
    expect(href).toMatch(new RegExp(`^https://wa\\.me/${site.whatsapp}\\?text=`));
    expect(message).toContain(`Ref. ${SERVER}`);
    expect(message).not.toContain(LOCAL);
    expect(message).not.toMatch(/sin registro/);
    expect(turnstile.reset).toHaveBeenCalled(); // el token es de un solo uso

    await flush(500);
    expect(text('.sent__ref')).toContain(SERVER);
  });

  it('mantiene la referencia aunque el cliente haya editado el mensaje a mano', async () => {
    widgetGives('tok-1');
    reply(200, { message: { reference: SERVER } });
    await mountInReview();
    const area = $<HTMLTextAreaElement>('#msg')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, `Hola, mi consulta (${LOCAL}) es urgente.`);
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(consentBox());
    await flush();
    await click(sendLink());
    await flush();
    expect(whatsapp().message).toBe(`Hola, mi consulta (${SERVER}) es urgente.`);
  });

  it.each([[417], [403], [429], [500]])('si el servidor rechaza (%i), WhatsApp se abre igual con la referencia local marcada «sin registro»', async (status) => {
    widgetGives('tok-1');
    reply(status);
    await mountInReview();
    await click(consentBox());
    await flush();
    await click(sendLink());
    await flush();

    expect(whatsapp().message).toContain(`Ref. ${LOCAL} (sin registro)`);
    expect(whatsapp().message).not.toContain(SERVER);
    await flush(500);
    expect(text('.sent__ref')).toBe(''); // no hay referencia del servidor que mostrar
  });

  it('si no hay red, igual', async () => {
    widgetGives('tok-1');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await mountInReview();
    await click(consentBox());
    await flush();
    await click(sendLink());
    await flush();
    expect(whatsapp().message).toContain(`${LOCAL} (sin registro)`);
  });

  it('si el CRM no contesta, a los 4 s el cliente sigue a WhatsApp sin registro', async () => {
    widgetGives('tok-1');
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    await mountInReview();
    await click(consentBox());
    await flush();
    await click(sendLink());
    await flush(site.crm.timeoutMs - 1);
    expect(whatsapp().href).toBe(''); // todavía esperando
    expect(sendLink()!.getAttribute('aria-busy')).toBe('true');
    expect(sendLink()!.textContent).toMatch(/Registrando/);
    await flush(1);
    expect(whatsapp().message).toContain(`${LOCAL} (sin registro)`);
    expect(sendLink()!.getAttribute('aria-busy')).toBeNull();
  });

  it('si Turnstile no entrega un token a tiempo, no se llama al CRM y WhatsApp se abre igual', async () => {
    widgetGives(null);
    await mountInReview();
    await click(consentBox());
    await flush();
    await click(sendLink());
    await flush(site.crm.tokenWaitMs);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(whatsapp().message).toContain(`${LOCAL} (sin registro)`);
  });

  it('si el script de Turnstile no carga (bloqueado, sin red), igual se llega a WhatsApp', async () => {
    delete window.turnstile; // y el <script> que se agrega al <head> nunca llama a onload
    await mountInReview();
    await click(consentBox());
    await flush();
    expect(document.head.querySelector('script[src^="https://challenges.cloudflare.com/"]')).not.toBeNull();
    await click(sendLink());
    await flush(site.crm.tokenWaitMs);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(whatsapp().message).toContain(`${LOCAL} (sin registro)`);
  });

  it('un segundo clic mientras se registra no manda otra consulta', async () => {
    widgetGives('tok-1');
    let finish!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => { finish = resolve; }));
    await mountInReview();
    await click(consentBox());
    await flush();
    await click(sendLink());
    await click(sendLink());
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { finish(new Response(JSON.stringify({ message: { reference: SERVER } }), { status: 200 })); });
    await flush();
    expect(whatsapp().message).toContain(SERVER);
  });

  it('un reintento con el mismo contenido repite la clave de idempotencia (el servidor devuelve la misma consulta)', async () => {
    widgetGives('tok-1');
    reply(200, { message: { reference: SERVER } });
    await mountInReview();
    await click(consentBox());
    await flush();
    await click(sendLink());
    await flush();
    popup.location.href = '';
    await click(sendLink());
    await flush();
    const keys = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).idempotency_key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
});
