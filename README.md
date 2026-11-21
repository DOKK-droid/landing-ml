# Landing ML — Relevamiento autoguiado a WhatsApp

Sitio de Mariano Lemos Barbaro. El cliente elige uno o varios servicios y responde un relevamiento corto en lenguaje de negocio. Al final envía por WhatsApp un mensaje estructurado, con una referencia para coordinar la videollamada.

- Next.js 16 · TypeScript · CSS puro · ilustraciones SVG propias (`src/view/components/ServiceArt.tsx`) · sin base de datos · export estático
- Español, portugués e inglés (`/es/`, `/pt/`, `/en/`)
- Arquitectura MVC: ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000/es/
npm test           # pruebas del modelo, el controlador, la interfaz y la seguridad
npm run build      # genera ./out y lo endurece (SRI, CSP por página, manifiesto de integridad)
npm run verify     # comprueba ./out contra la política de seguridad
```

La política de seguridad, los encabezados de `vercel.json`, el CI y la verificación del sitio publicado están en [docs/SEGURIDAD.md](docs/SEGURIDAD.md); las próximas integraciones (Cloudflare, Frappe/CRM) y la arquitectura completa, en [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md). Antes de publicar, probar el sitio en una vista previa de Vercel con la consola del navegador abierta: la política de contenido no se pudo probar en un navegador real.

## Publicar en Vercel

1. Subí este repositorio a GitHub:
   ```bash
   git remote add origin git@github.com:<usuario>/landing-ml.git
   git push -u origin main
   ```
2. En Vercel elegí **Add New → Project**, importá el repo y aceptá los valores detectados (Next.js). No hace falta configurar nada más.
3. Cuando tengas dominio: **Settings → Domains** para agregarlo, y **Settings → Environment Variables** para definir `NEXT_PUBLIC_SITE_URL=https://tu-dominio`. Luego, redeploy.
4. Generá el QR de la tarjeta apuntando a `https://tu-dominio/`, que redirige al idioma del visitante.

## Configuración

Los datos de contacto están en `src/config/site.ts`. Las preguntas y los servicios están en `src/model/catalog.ts`.
