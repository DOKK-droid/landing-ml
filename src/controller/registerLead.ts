/* ============================================================
 * CONTROLADOR — Llamada al CRM: registra la consulta y devuelve la referencia del servidor.
 *
 * Regla de oro: esta función NUNCA lanza ni deja la promesa colgada. Cualquier falla (sin red, tiempo agotado, rechazo
 * del servidor, respuesta rara) vuelve como `{ ok: false }` y el cliente sigue a WhatsApp con su referencia local. El CRM
 * suma registro y serial, pero nunca es un punto único de falla (docs/INTEGRACIONES.md, principio 1).
 * ============================================================ */
import { isServerReference } from '@/model/message';
import { crmOrigin, type LeadSubmission } from '@/model/crm';

/** Ruta del método de invitado de la app `landing_crm`. Está escrita también en la regla de la WAF de Cloudflare. */
export const SUBMIT_PATH = '/api/method/landing_crm.api.submit_lead';

export type RegisterFailure = 'disabled' | 'timeout' | 'network' | 'rejected' | 'invalid';
/**
 * `submission`: qué envío del `CRM Lead` fue este. 1 lo creó; más de 1 es la misma persona, desde la misma pestaña, que
 * volvió a enviar (el servidor lo sumó como nota al mismo `CRM Lead`, con la misma referencia).
 */
export type RegisterResult = { ok: true; reference: string; submission: number } | { ok: false; reason: RegisterFailure };

/** Un número de envío razonable, o 1 si el servidor no lo manda (versión anterior) o manda algo raro. */
function submissionNumber(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 999 ? value : 1;
}

export interface RegisterOptions {
  /** Origen de la API (`site.crm.url`). */
  url: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export function submitUrl(url: string): string {
  const origin = crmOrigin(url);
  return origin ? `${origin}${SUBMIT_PATH}` : '';
}

export async function registerLead(submission: LeadSubmission, { url, timeoutMs, fetchImpl }: RegisterOptions): Promise<RegisterResult> {
  const endpoint = submitUrl(url);
  if (!endpoint) return { ok: false, reason: 'disabled' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (fetchImpl ?? fetch)(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(submission),
      // El visitante es un invitado: ninguna cookie viaja (ni se acepta una de vuelta) y no se sigue ninguna redirección.
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: 'rejected' };
    // El cuerpo también cuenta para el tiempo: sigue bajo el mismo `signal` hasta que se termina de leer.
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      // Un corte o un tiempo agotado a mitad del cuerpo no es una respuesta rara: se cuenta como lo que es.
      if (controller.signal.aborted || (error as { name?: string })?.name === 'AbortError') throw error;
      return { ok: false, reason: 'invalid' };
    }
    const answer = (body as { message?: { reference?: unknown; submission?: unknown } } | null)?.message;
    const reference = answer?.reference;
    return isServerReference(reference)
      ? { ok: true, reference, submission: submissionNumber(answer?.submission) }
      : { ok: false, reason: 'invalid' };
  } catch (error) {
    return { ok: false, reason: controller.signal.aborted || (error as { name?: string })?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}
