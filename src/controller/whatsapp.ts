'use client';
/* ============================================================
 * CONTROLADOR — Abrir WhatsApp después de una espera.
 *
 * Registrar la consulta es asíncrono, y un navegador solo deja abrir una pestaña en el mismo gesto del clic: después de un
 * `await` la tomaría por una ventana emergente no pedida y la bloquearía. Por eso la pestaña se abre YA, en blanco, y se la
 * dirige a WhatsApp cuando hay respuesta o se agotó el tiempo. Si el navegador no la deja abrir, se navega en la misma pestaña.
 * ============================================================ */

/** Abre una pestaña en blanco, sin vínculo con esta página (`opener` en null: lo que haría `rel="noopener"`). `null` si el navegador la bloqueó. */
export function openPending(): Window | null {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  return popup;
}

/** Lleva al cliente a `url`: a la pestaña ya abierta, o a esta misma si no hay (bloqueada o cerrada mientras tanto). */
export function deliver(popup: Window | null, url: string, navigate: (url: string) => void = (target) => window.location.assign(target)): void {
  if (popup && !popup.closed) popup.location.href = url;
  else navigate(url);
}
