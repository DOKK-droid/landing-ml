/**
 * Configuración del sitio. Es el único archivo a tocar para cambiar datos de contacto.
 * NEXT_PUBLIC_SITE_URL se define en Vercel (Settings → Environment Variables) cuando haya dominio.
 */
export const site = {
  owner: 'Mariano Lemos Barbaro',
  /** Número en formato internacional sin "+" ni espacios (requisito de wa.me). */
  whatsapp: '5493764712518',
  whatsappDisplay: '+54 9 376 471-2518',
  email: 'mjcl1995@gmail.com',
  linkedin: 'https://www.linkedin.com/in/mariano-jose-correa-lemos-466b49120/',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://landing-ml.vercel.app',
  /**
   * Conexión con el CRM (docs/INTEGRACIONES.md, I-4). Sin las dos variables de build el sitio se comporta como antes:
   * no hay casilla de consentimiento, ni widget, ni llamadas de red, y el mensaje sale solo por WhatsApp.
   * Las dos son públicas (terminan en el navegador) y tienen que ser iguales en Vercel y en el CI, o el manifiesto no coincide.
   */
  crm: {
    /** Origen de la API, sin ruta (por ejemplo `https://api.atlasdigi.org`). La ruta del método está fija en `controller/registerLead.ts`. */
    url: process.env.NEXT_PUBLIC_CRM_URL ?? '',
    /** Clave pública (Site key) del widget de Turnstile. La secreta vive solo en el servidor de Frappe. */
    turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? '',
    /** Tope de la llamada al CRM: pasado este tiempo el cliente sigue a WhatsApp sin registro. */
    timeoutMs: 4000,
    /** Cuánto se espera el token de Turnstile al enviar, si todavía no llegó (el botón ya espera a que esté). */
    tokenWaitMs: 3000,
    /**
     * Si Cloudflare sigue verificando por su cuenta pasado este tiempo, se da por fallida la verificación y el botón deja
     * enviar sin registro. No corre mientras Cloudflare espera una acción del cliente: ahí decide él (completarla o desmarcar).
     */
    verifyTimeoutMs: 15000,
  },
  /** Límite de caracteres de cada texto libre largo: mantiene el enlace de WhatsApp en un tamaño seguro. */
  maxTextLength: 600,
  /** Límite de los campos de una línea (nombre, correo, ciudad, rubro). */
  maxLineLength: 120,
  /**
   * Oferta del relevamiento técnico, con tarifa por TRAMOS DE DURACIÓN. La reunión se mide en bloques de `minutes` minutos
   * (un bloque incompleto cuenta como uno entero) y su duración total define el precio de TODOS los bloques:
   * - menos de `promoFrom` minutos: tarifa normal, `originalPrice` por bloque (USD 12 = USD 72 la hora);
   * - desde `promoFrom` y hasta el primer tramo: `price` por bloque (USD 9 = USD 54 la hora);
   * - desde `tiers[].from` minutos (inclusive): `tiers[].price` por bloque en toda la reunión (2 h o más: USD 8 = USD 48 la
   *   hora; 5 h o más: USD 7 = USD 42 la hora). Ejemplos: 1 h 59 min = USD 108, 2 h = USD 96, 4 h = USD 192.
   * Como la tarifa del tramo rige para toda la reunión, el total baja al cruzar un umbral (1 h 59 min cuesta más que 2 h):
   * es a propósito, premia reunirse más tiempo.
   * Lo que se muestra es el precio de la HORA (`price` × bloques por hora: USD 9 cada 10 min = USD 54 la hora) y su
   * equivalencia por bloque, con la tarifa normal tachada; lo que se cobra es el total que da `meetingCost`.
   * Todo lo que se muestra (hora, equivalencia, tachado, tramos, ejemplos de total) y lo que viaja en el mensaje
   * sale de acá: para cambiar o terminar la oferta se edita solo este bloque.
   */
  consulta: {
    minutes: 10, price: 9, originalPrice: 12, currency: 'USD', promoFrom: 60,
    tiers: [{ from: 120, price: 8 }, { from: 300, price: 7 }],
  },
} as const;
