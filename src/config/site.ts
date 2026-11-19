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
  /** Límite de caracteres de cada texto libre: mantiene el enlace de WhatsApp en un tamaño seguro. */
  maxTextLength: 600,
} as const;
