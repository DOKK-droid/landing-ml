# Landing ML — Relevamiento autoguiado a WhatsApp

Sitio de Mariano Lemos Barbaro. El cliente elige uno o varios servicios y responde un relevamiento corto en lenguaje de negocio. Al final envía por WhatsApp un mensaje estructurado, con una referencia para coordinar la videollamada.

- Next.js 16 · TypeScript · CSS puro · sin base de datos · export estático
- Español, portugués e inglés (`/es/`, `/pt/`, `/en/`)
- Arquitectura MVC: ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000/es/
npm test           # pruebas del modelo y del controlador
npm run build      # genera ./out
```

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
