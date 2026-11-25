# SEO

Qué hace el sitio para que los buscadores lo entiendan, y qué queda por hacer a mano después de publicar.

## Lo que ya está en el código

| Pieza | Dónde | Qué hace |
|---|---|---|
| `robots.txt` | `src/app/robots.ts` | Permite todo y apunta al sitemap. La raíz `/` no se bloquea: solo redirige y lleva `noindex` en su propia página, y un robot bloqueado no llegaría a leerlo. |
| `sitemap.xml` | `src/app/sitemap.ts` | Una entrada por página e idioma (el inicio `/es/`, `/pt/`, `/en/` y las tarifas `/es/tarifas/`, `/pt/tarifas/`, `/en/tarifas/`), cada una con todas las versiones de *esa* página. Sin fechas: una fecha que cambiara en cada build rompería el manifiesto de integridad. |
| `hreflang` | `src/app/[locale]/pageMeta.ts` + `src/model/seo.ts` | `es`, `pt`, `en` y `x-default` (el español) en el HTML de cada página y en el sitemap. |
| Canónico | `src/app/[locale]/pageMeta.ts` | Cada página en cada idioma es su propia página canónica. Next combina los metadatos de layout y página de forma superficial, así que cada página (inicio, tarifas) declara los suyos completos con `pageMeta()`. |
| Open Graph | `src/app/[locale]/pageMeta.ts` | Título, descripción, nombre del sitio y código de idioma con territorio (`es_LA`, `pt_BR`, `en_US`), más los idiomas alternativos. |
| Datos estructurados | `src/model/seo.ts` → `src/app/[locale]/page.tsx` | JSON-LD de schema.org con el sitio, la página, la persona y el servicio. Dice solo lo que la página ya muestra (nombre, cargo, servicios, teléfono, LinkedIn). Solo el inicio lo lleva; las tarifas no tienen datos estructurados propios. |

Todo sale de **una sola dirección base**, `NEXT_PUBLIC_SITE_URL`. Si no está definida el sitio usa `https://landing-ml.vercel.app`, que **no es el sitio publicado**: el canónico, el sitemap y los datos estructurados apuntarían a otra página. Definirla en Vercel (Settings → Environment Variables) con la dirección real, sin barra final, y hacer un redeploy. Hay una prueba que comprueba que robots.txt, sitemap, canónico y JSON-LD usan la misma base.

Los datos estructurados son un bloque de datos (`type="application/ld+json"`): el navegador no lo ejecuta, por eso la política de contenido no lo restringe ni hace falta un hash.

## Después de publicar (manual)

1. **Definir `NEXT_PUBLIC_SITE_URL`** y redeploy (ver arriba). Comprobar `https://tu-dominio/robots.txt` y `/sitemap.xml`.
2. **Google Search Console**: agregar la propiedad (de tipo "Dominio" si tienes dominio propio), verificarla por DNS y enviar `https://tu-dominio/sitemap.xml`. Es lo que acelera la indexación y muestra qué páginas se descartan y por qué.
3. **Bing Webmaster Tools**: importar la propiedad desde Search Console.
4. **Probar los datos estructurados** en <https://validator.schema.org/> pegando la dirección. `ProfessionalService` puede avisar de que falta la dirección postal: es una advertencia, no un error, y no se inventa una.
5. **Perfil de Google Business** (si hay un domicilio o zona de servicio que declarar) y **LinkedIn**: los enlaces desde perfiles reales pesan más que cualquier etiqueta.
6. **Probar la vista previa** al compartir el enlace (WhatsApp, LinkedIn). Hoy no hay imagen de vista previa (`og:image`): los enlaces se ven solo con texto.

## Lo que aún no está

- **Imagen para compartir (`og:image`, 1200×630).** Mejora mucho cómo se ve el enlace en WhatsApp y LinkedIn.
- **Título con palabras clave primero.** Hoy empieza por el nombre (`Mariano Lemos Barbaro — Arquitecto & Consultor Senior IT`), bueno para quien busca a la persona. Para búsquedas genéricas ("consultor ERP CRM") conviene encabezar con el servicio. Es una decisión de marca; se cambia en `meta.title` de `src/model/i18n.ts`.
- **Contenido propio por servicio** (una página por servicio, o artículos): es lo que más mueve el posicionamiento a largo plazo y hoy todo está en una sola página.
