'use client';
/* ============================================================
 * CONTROLADOR — Clave de visita: un UUID al azar que identifica esta pestaña ante el CRM.
 *
 * Viaja en cada registro, y el servidor junta todos los envíos con la misma clave en un solo `CRM Lead` (con una nota por
 * envío y la misma referencia), en vez de crear uno por envío. Como solo esta pestaña la conoce, nadie más puede sumar
 * envíos a ese `CRM Lead` ni enterarse de su referencia.
 *
 * Vive en sessionStorage, como el relevamiento: sobrevive al cambio de idioma y a «Nuevo relevamiento», y se pierde al
 * cerrar la pestaña. Se crea recién al registrar (con consentimiento): quien no consiente no guarda nada nuevo.
 * ============================================================ */
import { newIdempotencyKey } from '@/model/crm';

export const VISIT_STORAGE_KEY = 'ml-visit';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Sin almacenamiento disponible, la clave dura lo que dure la página. */
let fallback: string | null = null;

export function visitKey(): string {
  try {
    const stored = sessionStorage.getItem(VISIT_STORAGE_KEY);
    if (stored && UUID.test(stored)) return stored;
    const key = newIdempotencyKey();
    sessionStorage.setItem(VISIT_STORAGE_KEY, key);
    return key;
  } catch {
    return (fallback ??= newIdempotencyKey());
  }
}
