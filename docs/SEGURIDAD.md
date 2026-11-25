# Seguridad — Landing de relevamiento (Mariano Lemos Barbaro)

Qué amenazas se consideran, qué controles hay hoy, cómo se comprueban y qué se planifica (incluida la posible conexión con un servidor Frappe/CRM). Complementa a [ESPECIFICACION.md](ESPECIFICACION.md) y [QA.md](QA.md).

Estado al 2026-11-20. Cada control dice si está **implementado y probado**, **implementado sin probar en un navegador real** o **planificado**. Nada de lo planificado existe todavía en el código.

## 1. Resumen

| Tema | Estado |
|---|---|
| Encabezados de seguridad (`vercel.json`) | Implementado y comprobado por prueba automática |
| CSP por página con hash de cada script en línea | Implementado; **sin probar en un navegador real** |
| SRI (`integrity`) en todos los scripts y estilos propios | Implementado y comprobado |
| Estilos sin `unsafe-inline` (cada `<style>` y `style="…"` por hash) | Implementado y contrastado con un lector de HTML real; sin probar en un navegador |
| Manifiesto de integridad y verificador del sitio publicado | Implementado y comprobado |
| CI (GitHub Actions): pruebas, build, manifiesto y verificación programada del sitio publicado | Escrito y ensayado en una copia limpia; **falta activarlo en GitHub** (sección 5.7) |
| Estado guardado en el navegador saneado | Implementado y probado |
| CSRF (`csurf`) | **No aplica hoy** (no hay cookies ni endpoints que cambien estado); especificado para cuando haya servidor (sección 6) |
| Conexión a Frappe, Cloudflare y la arquitectura completa | **Planificado**: [INTEGRACIONES.md](INTEGRACIONES.md) (arquitectura objetivo y qué hay que conseguir) y sección 7 (evaluación y contrato) |
| Cuentas y dominio (2FA, bloqueo, DNSSEC) | Planificado, es lo de mayor impacto (sección 8) |

Premisa que ordena todo: **lo que corre en el navegador lo controla quien lo usa**. El front no puede defenderse de su propio usuario; solo puede (a) no confiar en lo que viene del cliente, (b) impedir que un tercero altere lo que se le sirve, y (c) no filtrar datos. Los controles de este documento apuntan a (b) y (c); (a) pasa a ser obligación del servidor el día que exista uno.

## 2. Qué se protege y de quién

| Activo | Por qué importa |
|---|---|
| Número de WhatsApp y contenido del sitio | Si alguien lo cambia, los clientes le escriben a otra persona |
| Datos del cliente mientras completa el relevamiento | Nombre, correo y datos del negocio, en `sessionStorage` |
| El dominio y las cuentas (Vercel, GitHub, registrador) | Quien las controla controla el sitio |
| La reputación de la referencia `ML-…` como etiqueta de búsqueda | Hoy es solo una etiqueta; no autentica nada |

| Actor | Qué puede intentar |
|---|---|
| Visitante malintencionado | Editar el JavaScript o `sessionStorage` en su propio navegador; falsificar la referencia; mandar mensajes basura a tu WhatsApp |
| Quien clona el sitio | Copiarlo con otro número y atraer tráfico (QR, enlaces, buscadores) |
| Atacante de cadena de suministro | Comprometer una dependencia de npm, la cuenta de Vercel/GitHub o el DNS |
| Atacante en la red o en un CDN intermedio | Alterar un script o una hoja de estilos en tránsito o en el almacenamiento |
| Script de terceros (si se agrega analítica, chat, etc.) | Leer lo que hay en `sessionStorage` |

## 3. Amenazas, controles y evidencia

| Amenaza | Control | Estado | Evidencia |
|---|---|---|---|
| Un script o estilo propio alterado después del build | SRI `sha256` en cada `<script src>`, hoja de estilos y precarga local | Implementado | `tests/security.test.ts`, `npm run verify` |
| Inyección de un `<script>` en línea (XSS) | CSP: `script-src 'self'` + hash de cada script en línea; sin `'unsafe-inline'` ni `'unsafe-eval'` | Implementado, **no verificado en un navegador** | ídem |
| Inyección de estilos (ocultar el número, superponer un falso botón) | `style-src 'self'` y `style-src-attr` solo por hash: ni `<style>` ni `style="…"` ajenos se aplican | Implementado, **no verificado en un navegador** | `tests/security*.test.ts` |
| Manejadores `onclick=`, `javascript:`, `<iframe>`, `<base>`, `<object>` | Prohibidos por la CSP y detectados por el verificador | Implementado | ídem |
| Cargar scripts o conexiones de otros orígenes | `default-src 'self'`, `connect-src 'self'`, sin `data:` en imágenes | Implementado | ídem |
| Clickjacking (el sitio dentro de un `<iframe>` ajeno) | `frame-ancestors 'none'` y `X-Frame-Options: DENY` | Implementado | `vercel.json`, prueba de encabezados |
| Sniffing de tipos, fuga de URL, funciones del navegador | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP | Implementado | ídem |
| Tráfico sin cifrar | HSTS (1 año), `upgrade-insecure-requests` | Implementado | ídem |
| Lo publicado difiere de lo construido | Manifiesto de integridad + reconstrucción del commit publicado cada 6 h y comparación archivo por archivo | Escrito; falta activarlo en GitHub | sección 5.4 |
| `sessionStorage` manipulado o de otra versión | `sanitize()` valida tipos, ids, largos y referencia | Implementado | `tests/security.test.ts` |
| Referencia falsificada | **No se mitiga en el front** (no puede). Es una etiqueta, nunca una credencial | Aceptado | sección 4 |
| Spam a tu WhatsApp | Fuera del alcance del sitio (el número es público). Medidas de WhatsApp Business | Aceptado | sección 4 |
| Sitio clonado con otro número | Dominio propio, bloqueo del registrador, DNSSEC; el QR solo apunta a tu dominio | Planificado | sección 8 |
| Dependencia comprometida o con fallas conocidas | `npm audit` en cada CI, Dependabot, acciones fijadas por commit, `npm ci --ignore-scripts` | Escrito; falta activarlo en GitHub | sección 5.4 |
| Cuenta comprometida (Vercel, GitHub, registrador) | 2FA y bloqueo de transferencia | Planificado | sección 8 |
| Abuso de un futuro endpoint (spam, bots, duplicados) | Turnstile, límite de peticiones, validación en el servidor, idempotencia | Planificado | sección 7 |
| Datos personales guardados en el servidor | Consentimiento, política de privacidad, retención | Planificado (solo si hay CRM) | sección 7.7 |

## 4. Lo que el front no puede resolver

- **La referencia `ML-AAMMDD-XXXX` no es un secreto ni una prueba.** Se genera en el navegador con `Math.random()`: cualquiera puede mandar un mensaje con la referencia de otro. Úsela solo para buscar la conversación. **No la use como prueba de pago, de turno ni de identidad.** Si algún día se cobra la consulta, el identificador de la operación lo debe emitir el proveedor de pagos o un servidor.
- **El número de WhatsApp es público** (está en el código y en el pie del sitio). No hay API que saturar: cada cliente envía el mensaje desde su propia app. El spam llega por WhatsApp, y ahí ayudan bloquear/reportar, etiquetas, respuestas automáticas y filtros de WhatsApp Business. Cloudflare no lo ve.
- **Un clon del sitio** no se evita con encabezados. Lo que reduce el daño es controlar el dominio y que el QR de la tarjeta apunte siempre a él.
- **Datos en el navegador.** El relevamiento queda en `sessionStorage` hasta cerrar la pestaña. En una computadora compartida, quien use la pestaña después puede verlo si no se cerró. "Nuevo relevamiento" lo borra. La frase de privacidad del pie dice que el sitio no guarda datos: es cierta respecto del servidor; en el navegador sí quedan temporalmente.

## 5. Controles implementados

### 5.1 Encabezados (`vercel.json`)

Con `output: 'export'` los encabezados de `next.config.ts` no se aplican (la documentación de Next lo lista entre lo no soportado), por eso van en `vercel.json`, que Vercel aplica a todas las rutas.

| Encabezado | Valor | Para qué |
|---|---|---|
| `Content-Security-Policy` | `frame-ancestors 'none'; object-src 'none'; base-uri 'none'; upgrade-insecure-requests` | Lo que un `<meta>` no puede expresar (ver 5.2) |
| `X-Content-Type-Options` | `nosniff` | El navegador no adivina el tipo de un archivo |
| `X-Frame-Options` | `DENY` | Clickjacking en navegadores que no leen `frame-ancestors` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No filtra rutas ni parámetros a otros sitios |
| `Permissions-Policy` | cámara, micrófono, geolocalización, pagos, USB y FLoC desactivados | El sitio no usa esas funciones |
| `Cross-Origin-Opener-Policy` | `same-origin` | Aísla la ventana de otras pestañas |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Fuerza HTTPS durante un año |

Decisiones: se omite `preload` en HSTS (difícil de deshacer; activarlo cuando el dominio esté definitivo) y no se pone `Cross-Origin-Resource-Policy` (poco valor y riesgo de romper vistas previas de enlaces).

### 5.2 Política de contenido (CSP) con hashes

**Por qué hashes y no nonces.** Un nonce debe ser distinto en cada visita, y eso exige renderizar cada página en un servidor (así lo dice la guía de CSP de Next). El sitio es estático, así que no hay dónde generarlo. Con hashes, el build calcula el SHA-256 de cada script en línea de cada página y lo permite por nombre: un `<script>` que alguien inyecte no coincide con ningún hash y el navegador no lo ejecuta.

**Dos capas**, porque un `<meta http-equiv="Content-Security-Policy">` no admite `frame-ancestors`, `report-uri` ni `upgrade-insecure-requests`:
1. **`<meta>` por página** (lo escribe `scripts/harden-build.mjs` como primer hijo de `<head>`): scripts, estilos, imágenes, fuentes, conexiones, marcos, workers, formularios.
2. **Encabezado `Content-Security-Policy`** en `vercel.json`: `frame-ancestors`, `object-src`, `base-uri` y `upgrade-insecure-requests`.

El navegador aplica ambas a la vez, y gana la más restrictiva de cada directiva.

| Directiva | Valor | Motivo |
|---|---|---|
| `default-src` | `'self'` | Base: todo del propio sitio |
| `script-src` | `'self'` + un `'sha256-…'` por script en línea de esa página | Sin `unsafe-inline` ni `unsafe-eval` (el bundle no usa `eval`: se revisó) |
| `style-src` | `'self'` + un hash por cada `<style>` en línea (solo lo tiene la página 404 de Next) | Sin `unsafe-inline` |
| `style-src-attr` | `'unsafe-hashes'` + un hash por cada atributo `style="…"` de esa página (13 en la landing); `'none'` si no hay | React escribe `style="--c:#2fe6ff;--rd:90ms"` en el HTML. Cada valor se permite por su hash, ya con las entidades HTML resueltas, que es lo que el navegador hashea |
| `img-src`, `font-src`, `manifest-src` | `'self'` | Las fuentes salen de `@fontsource`, ya empaquetadas en `_next/static/media` |
| `connect-src` | `'self'` (+ lo que diga `CSP_CONNECT_SRC`, + el origen de `NEXT_PUBLIC_CRM_URL`, + Turnstile si está activo) | Sin la conexión con el CRM no hay llamadas externas |
| `frame-src` | `'none'`; con la conexión con el CRM activa, solo `https://challenges.cloudflare.com` | Es el widget de Turnstile. El verificador (`checkHtml`) admite ese origen exacto y rechaza cualquier otro |
| `worker-src`, `object-src`, `base-uri`, `form-action` | `'none'` | No se usan |

**Agregar un origen.** La API del CRM entra sola por `NEXT_PUBLIC_CRM_URL` (su origen va a `connect-src`; no hace falta repetirlo en `CSP_CONNECT_SRC`). Con esa variable **y** `NEXT_PUBLIC_TURNSTILE_SITEKEY` el build activa la conexión y admite el widget: `https://challenges.cloudflare.com` en `script-src`, `frame-src` y `connect-src`. Ese script **no lleva SRI** (el proveedor lo actualiza): es una concesión consciente, acotada a ese origen exacto, y solo existe en los builds con la conexión activa. Sin las variables, la política es la de antes. No se edita código.

**Probado en Chromium real (Chrome for Testing 159):** Turnstile carga, crea su marco y entrega el token bajo esta política, sin ninguna violación; el navegador además bloquea un `fetch` a otro origen, un script externo, uno en línea sin hash y un marco ajeno. **Pendiente:** Firefox y Safari. Si hiciera falta otra directiva, se agrega al origen exacto y con su prueba; no se afloja la política en general.

**`img-src 'self'` y el fondo de grano.** El grano de fondo era un `data:` URI en el CSS, y la política lo bloqueaba (el verificador de la CSP revisa el HTML, no las hojas de estilo, así que solo un navegador real lo mostró). Ahora es el archivo `public/grain.svg`, y una prueba (`tests/crm.test.ts`) falla si el CSS vuelve a usar un `data:` URI o un origen externo.

**Límites y riesgos conocidos**
- **No se probó en un navegador real.** En este entorno no hay navegador. Sí se comprobó que (a) cada script en línea tiene su hash, (b) no queda ningún manejador en línea, `eval` ni origen externo, y (c) el build endurecido hidrata y se opera sin errores en jsdom. jsdom **no aplica** CSP ni SRI, así que eso no prueba que el navegador acepte la política. Antes de publicar: abrir una vista previa de Vercel en Chrome, Firefox y Safari con la consola abierta y recorrer el relevamiento; cualquier bloqueo aparece como `Refused to …`.
- Un `<meta>` no puede ser `Report-Only`. No hay forma de "probar sin romper" desde el meta; la prueba es la vista previa.
- Si se agrega un script de terceros (analítica, Turnstile), hay que permitir su origen en `script-src`, y ese script **no podrá llevar SRI** (los proveedores lo cambian sin aviso). Cada origen permitido amplía lo que un compromiso de ese tercero podría hacer.
- **Estilos en línea: cómo funciona y qué asume.** Los `style="…"` que vienen en el HTML se permiten por hash. Los que React aplica **después** de cargar (la vista previa, el avance, la altura del campo de texto) usan la API de estilos del DOM (`elemento.style.x = …`), que la CSP no bloquea. Cualquier `style=` nuevo que se escriba en el HTML estático se hashea solo en el próximo build; el verificador falla si un atributo queda sin hash o si alguien vuelve a poner `unsafe-inline`.
- **Mensajes `style-src-attr` posibles en la consola.** Next crea un anunciador de rutas (`next-route-announcer`) y le asigna estilos con `style.cssText = "position:absolute…"`; los navegadores tratan `cssText` como el atributo y pueden bloquearlo. Es inofensivo aquí: el anunciador solo muestra texto al navegar entre rutas de Next y este sitio no navega así (cambiar de idioma recarga la página). Si aparece ese aviso en la prueba con navegadores reales, es esperado; si se quiere eliminar, se agregan al `style-src-attr` los hashes de esas dos cadenas (están en el JavaScript de Next y cambian con sus versiones).
- **Navegadores viejos.** `style-src-attr` y `'unsafe-hashes'` requieren aproximadamente Chrome 75+, Firefox 105+ y Safari 15.4+ (confirmar en caniuse). En uno anterior, los estilos en línea de la landing (colores por servicio) no se aplicarían; el resto del sitio, que usa hojas de estilo, no se afecta.
- Los hashes cubren los scripts **en línea**. Los archivos `.js` están permitidos por `'self'` más SRI. Una alternativa más estricta (permitirlos solo por hash en la CSP) queda como mejora; el soporte entre navegadores es menos parejo.

### 5.3 Integridad de subrecursos (SRI)

`harden-build.mjs` agrega `integrity="sha256-…"` a cada `<script src>`, hoja de estilos y precarga de script o estilo, calculado sobre los bytes de `out/`. Si el navegador recibe un archivo distinto del construido (CDN comprometido, almacenamiento alterado, caché envenenada), lo rechaza.

- **Qué no cubre:** si el atacante puede cambiar el propio HTML, cambia también el `integrity`. Para eso están la CSP y el manifiesto (5.4). Tampoco cubre scripts que el navegador cree en ejecución sin atributo `integrity`.
- **Por qué no se usó la opción de Next.** Next ofrece `experimental.sri`. Se la probó con este proyecto: funciona con la exportación estática, pero deja sin `integrity` dos scripts y la hoja de estilos. Además es experimental. El paso propio cubre todo y no depende de internos de Next. Si la opción madura, puede reemplazarlo.
- El build **falla** si un recurso referenciado no existe, en lugar de publicar algo sin verificar.

### 5.4 Manifiesto de integridad y verificación de lo publicado

`harden-build.mjs` escribe `.integrity/manifest.json` con la integridad y el tamaño de **cada archivo** de `out/` (78 hoy), después del endurecimiento. Está fuera de `out/` a propósito: un manifiesto servido por el mismo sitio que se quiere comprobar no probaría nada.

Para que el manifiesto sea comparable, `next.config.ts` fija el identificador de build (`generateBuildId`) al commit (`VERCEL_GIT_COMMIT_SHA` o `GITHUB_SHA`, o `local`). Sin eso Next lo sortea al azar. Se comprobó: dos builds del mismo código dan el mismo manifiesto.

**Cómo se usa**
```bash
npm run build          # construye, endurece y escribe .integrity/manifest.json
npm run verify         # revisa out/ (CSP, SRI, marcado, vercel.json) y lo compara con el manifiesto
node scripts/verify-site.mjs --url https://tu-dominio --manifest .integrity/manifest.json
```
El último comando descarga las páginas (`/`, `/es/`, `/pt/`, `/en/`) y sus scripts y estilos desde el sitio publicado, comprueba encabezados reales, CSP, SRI y que cada archivo coincida con el manifiesto. Sale con código 1 si algo difiere.

**Qué detecta** (probado con copias alteradas): un script modificado, un `<script>` inyectado, un script externo, un manejador `onerror=`, un `<iframe>`, un archivo cambiado, de más o que falta.

**Para que tenga valor** el manifiesto debe venir de un lugar que el atacante no controle. Por eso no sale de Vercel: lo produce el CI de GitHub reconstruyendo el commit publicado (5.7). Si el atacante tiene tu cuenta de Vercel pero no la de GitHub, lo detectás; si tiene ambas, no.

### 5.5 Estado en el navegador

`sanitize()` (`src/controller/surveyReducer.ts`) se ejecuta cada vez que se restaura el estado guardado:

| Regla | Efecto |
|---|---|
| Referencia con formato `ML-\d{6}-[A-HJ-NP-Z2-9]{4}` | Una referencia adulterada saca del relevamiento: se vuelve al inicio conservando la selección |
| Solo respuestas de preguntas que existen en el recorrido elegido | Se descartan ids inventados y respuestas de servicios no elegidos |
| Tipo correcto por pregunta (texto, opción única, lista) | Números, objetos y nulos se descartan |
| Largos: línea 120, texto largo 600, id de opción 64, lista ≤ cantidad de opciones, mensaje editado 20.000 | Se recorta |
| Servicios: solo ids conocidos, sin repetidos | |
| Origen: solo `[a-z0-9_-]{1,24}` | |

El script que evita el destello al cambiar de idioma (`resume.ts`) usa la misma condición de referencia válida, y una prueba exige que ambos coincidan.

Esto protege al propio usuario y mantiene acotado lo que llega al mensaje. **No es una defensa contra el usuario**: puede escribir lo que quiera en su mensaje. El texto sale por React como texto (nunca como HTML) y por `encodeURIComponent` hacia `wa.me`.

### 5.6 Comprobaciones automáticas

157 pruebas en total; las de seguridad están en dos archivos.

`tests/security.test.ts` (50): SRI contra un vector conocido; endurecimiento idempotente; el build corta si falta un recurso; la CSP no admite `unsafe-inline`/`unsafe-eval` ni en scripts ni en estilos; cada `<style>` y atributo `style` se permite por hash (con las entidades resueltas); detección de script alterado, inyectado, externo, sin `integrity`, estilo agregado, manejadores, iframes y `javascript:`; manifiesto (alterado, de más, ausente, descarga parcial); encabezados de `vercel.json`; lectura del identificador de build; las reglas de los flujos de GitHub (acciones fijadas por commit, permisos mínimos, el SHA se valida antes de usarse); y todo el saneamiento del estado.

`tests/security-dom.test.ts` (9): contraste **independiente**. El verificador lee el HTML con su propio código; esta prueba compara sus resultados con los de un analizador de HTML real (el DOM), que es lo que el navegador hashea. Se ejecuta sobre un documento con entidades, mayúsculas y comillas simples, y sobre cada página del build real si `out/` existe.

### 5.7 CI y vigilancia del sitio publicado

Dos flujos en `.github/workflows/`, escritos y ensayados en una copia limpia del repositorio (`npm ci --ignore-scripts`, tipos, pruebas, build, verificación y reproducibilidad del manifiesto entre directorios distintos). **Todavía no corrieron en GitHub**: eso requiere subir el repositorio y configurar lo de abajo.

| Flujo | Cuándo | Qué hace |
|---|---|---|
| `ci.yml` | Cada push a `main` y cada pull request | `npm ci --ignore-scripts` → tipos → pruebas → `npm run build` (endurece) → `npm run verify` → guarda `.integrity/manifest.json` como artefacto por 90 días. Un segundo trabajo corre `npm audit --omit=dev --audit-level=high` |
| `verify-live.yml` | Cada 6 horas y a pedido | (1) pregunta al sitio publicado qué commit es (`--build-id`); (2) **valida** que sea un SHA de 40 caracteres antes de usarlo; (3) descarga ese commit y lo reconstruye en un entorno limpio; (4) compara lo publicado con lo reconstruido (encabezados reales, CSP, SRI y cada archivo). Si falla, abre o actualiza una incidencia con la etiqueta `security-alert` |

Decisiones de diseño:
- **Reconstruir el commit publicado en lugar de confiar en un manifiesto guardado.** No depende de que un artefacto siga vivo (vencen a los 90 días y un sitio estable puede pasar más tiempo sin cambios), y la fuente de verdad es el código en GitHub.
- **El verificador sale de `main`, no del commit publicado**, para que un commit comprometido no pueda debilitar la verificación de sí mismo.
- **Lo que informa el sitio no se interpola en comandos.** El SHA solo entra por `ref:` y por una variable de entorno, después de validarse con una expresión estricta; una prueba lo exige.
- **Acciones de terceros fijadas por el SHA de un commit** (con la versión en un comentario) y permisos mínimos (`contents: read`; la verificación suma `issues: write`). Dependabot propone las actualizaciones semanalmente.
- **`--ignore-scripts`:** ningún script de instalación de una dependencia se ejecuta en el CI.

**Para activarlo** (una sola vez)
1. Subir el repositorio a GitHub (el CI y Vercel se disparan con el mismo push).
2. Variable de repositorio `SITE_URL` (Settings → Secrets and variables → Actions → Variables) = `https://tu-dominio`. Sin ella la verificación programada solo emite una advertencia y no verifica nada.
3. **Igualar el entorno de build de Vercel y el del CI**, o los manifiestos no coincidirán: variable de entorno `NEXT_PUBLIC_SITE_URL` en Vercel = `SITE_URL`; versión de Node en Vercel (Settings → Node.js Version) = la de `.nvmrc` (22); y, con el CRM, `NEXT_PUBLIC_CRM_URL` y `NEXT_PUBLIC_TURNSTILE_SITEKEY` iguales en ambos lados (en GitHub, como variables de repositorio `CRM_URL` y `TURNSTILE_SITEKEY`; entran en el JS del sitio, así que si difieren el manifiesto no coincide). `CSP_CONNECT_SRC` solo si hay otros orígenes.
4. **Calibrar:** ejecutar `verify-live.yml` a mano (Actions → Run workflow) después del primer despliegue real. Si falla por diferencias que no son una alteración (por ejemplo, una variable distinta), corregir el entorno hasta que pase. Recién entonces dejarlo correr solo.
5. Activar las incidencias del repositorio y las notificaciones por correo de GitHub para los fallos de Actions.

**Límites**
- Si el atacante controla **GitHub y Vercel**, no se detecta.
- Una reversión a una versión anterior legítima del sitio no es una alteración: el sitio informa un commit viejo y se compara contra ese commit. Detectarla requeriría comparar con el último commit de `main`; queda como mejora.
- GitHub **desactiva los flujos programados** de un repositorio sin actividad durante 60 días. El aviso llega por correo; reactivar desde Actions.
- Costo en minutos de Actions: unas 4 reconstrucciones por día. En repositorios públicos es gratis; en privados, revisar la cuota del plan.
- Un posible falso positivo es una diferencia de entorno (Node, variables) entre Vercel y el CI, no una alteración. Para eso está el paso de calibración.

## 6. CSRF y `csurf`

**Qué es CSRF.** Un sitio malicioso hace que el navegador de la víctima envíe una petición a *tu* sitio, y el navegador adjunta solo las cookies de sesión de la víctima. Solo es un problema si existe una **acción que cambia estado y se autoriza con una cookie**.

**Hoy no hay superficie.** El sitio no tiene cookies, sesiones ni endpoints; el único "envío" es un enlace `wa.me` que el cliente abre y confirma a mano. No hay nada que proteger con un token, y agregar uno solo sumaría complejidad.

**Sobre el paquete `csurf`:** es middleware de Express, está archivado y sin mantenimiento, y exige un servidor Express con sesión. No sirve para un sitio estático en Vercel y no debe incorporarse. Cuando haya servidor, la protección sale del propio servidor:

| Escenario futuro | Hay CSRF | Qué hacer |
|---|---|---|
| El front llama a un endpoint **de invitado** de Frappe sin cookies (`fetch(..., { credentials: 'omit' })`) | No: no hay sesión que aprovechar | El riesgo es el **abuso** (spam, bots), no CSRF: límite de peticiones, Turnstile, validación, idempotencia (sección 7) |
| Personal de Mariano usa el escritorio de Frappe con su sesión | Sí | Frappe exige su token (`X-Frappe-CSRF-Token`) en peticiones POST con sesión; mantenerlo activo, cookie `SameSite=Lax` o `Strict`, y **nunca** mezclar esa sesión con el sitio público |
| Una función de Vercel con cookie de sesión propia | Sí | Evitarlo; si fuera inevitable: cookie `HttpOnly; Secure; SameSite=Strict`, comprobar `Origin`/`Sec-Fetch-Site` en el servidor y token por doble envío |

Los detalles de Frappe (nombre del encabezado, qué peticiones lo exigen) dependen de la versión instalada: verificarlos en la documentación de esa versión antes de implementar.

## 7. Conexión con un servidor Frappe (CRM): evaluación y plan

### 7.1 ¿Conviene?

Hoy la decisión es **sin base de datos**: el registro es la conversación de WhatsApp. Conectar un Frappe cambia eso. Conviene **si y solo si** se quiere:

- un serial **real, secuencial y único** (no un código aleatorio),
- seguimiento: estados, recordatorios, historial por cliente, duplicados,
- una base para cobrar la consulta o agendar,
- métricas del embudo (de la tarjeta al cliente).

| A favor | En contra |
|---|---|
| Serial verdadero y atómico (serie de nombres) y trazabilidad de punta a punta | Se guardan **datos personales**: hay obligaciones legales (7.7) |
| Desduplicación y seguimiento en un CRM, no en el chat | Un servidor dedicado hay que **mantenerlo**: actualizaciones, copias de seguridad, monitoreo, certificados |
| El servidor valida lo que el front no puede | Más superficie de ataque: un endpoint público y una base con datos |
| Permite cobrar con un identificador de operación confiable | El sitio deja de ser 100 % estático y la CSP/`connect-src` se abre a un origen más |

**Recomendación:** mientras el volumen sea de pocas consultas por semana, WhatsApp alcanza y la referencia aleatoria cumple como etiqueta. Hacer la conexión cuando haga falta seguimiento o cobro, y hacerla como una **mejora progresiva**: WhatsApp sigue siendo el canal y el plan B, y el CRM suma registro y serial. Si el CRM no responde, el cliente igual envía su mensaje.

### 7.2 "Sesiones": los visitantes no necesitan una

Un visitante anónimo es `Guest` en Frappe. **No hay que darle sesión**: una sesión es una credencial, y repartirlas a desconocidos agranda el riesgo sin aportar nada. La sesión de Frappe corresponde solo a Mariano y su equipo (escritorio de Frappe), con 2FA, y no tiene relación con el sitio público. El front público llama a **un único método de invitado** sin cookies.

### 7.3 "Customer o CRM": un contacto nuevo es un `CRM Lead`

Se usa la app **Frappe CRM** (`crm` 16.3.0, rama `version-16`): una consulta que llega por primera vez es un **`CRM Lead`**, el DocType que lista `/crm/leads`. El `Lead` de ERPNext pertenece al escritorio clásico y **no se usa**: un registro creado ahí no aparece en la interfaz del CRM. Al convertir el `CRM Lead` (cuando hay una relación comercial) se crea un `CRM Deal`; el **Customer** de ERPNext es un paso posterior y opcional (*ERPNext CRM Settings*). Registrar cada consulta como Customer ensuciaría el maestro de clientes.

| Dato del relevamiento | Dónde va en Frappe |
|---|---|
| Nombre y apellido (`p_nombre`: un solo campo, obligatorio) | `first_name`, **completo y sin partir**: adivinar dónde termina el nombre falla con nombres compuestos. El CRM arma `lead_name` solo |
| Correo (`p_correo`, opcional en el formulario) | `email` (el CRM valida el formato) |
| Empresa u organización (`p_org`) | `organization` (texto; al convertir en `CRM Deal` el CRM crea la *CRM Organization*) |
| Ciudad y país (`p_ubicacion`: un solo campo de texto) | Campo propio `landing_location`. `territory` es un enlace a una lista cerrada y no sirve para texto libre |
| Servicios de interés | Campo propio `landing_services` (los títulos, legibles; los ids quedan en el JSON). No usar la tabla estándar `products`: es de productos con precio (cantidad, tarifa, descuento) |
| Respuestas del relevamiento | Un campo propio `landing_answers` (JSON: ids estables, no textos, más los servicios y el origen), **y** una *FCRM Note* con el resumen legible, que el CRM muestra en la ficha del `CRM Lead`. El contenido de la nota se escapa: viene del navegador |
| Referencia, versión del formulario, idioma | Campos propios `landing_reference`, `landing_form_version` y `landing_language` |
| Clave de idempotencia | Campo propio `landing_idempotency_key`, con índice único en la base: la del **último** envío del `CRM Lead` |
| Clave de visita | Campo propio `landing_visit_key` (oculto, con índice). Todos los envíos de una misma pestaña van al mismo `CRM Lead`: ver 7.5 |
| Origen (`tarjeta`) | Campo **estándar** `source`, un enlace a *CRM Lead Source*: `tarjeta` → *Tarjeta*, cualquier otro → *Landing*. No crear otro campo con ese nombre |
| Oferta vista (USD 54 la hora = USD 9 cada 10 min; tarifa por tramos de duración) | Campo propio `landing_offer` |
| Consentimiento | `landing_consent` y `landing_consent_date` (la fecha la pone el servidor) |

Los campos propios llevan el prefijo `landing_` para que un campo que Frappe CRM agregue en el futuro a `CRM Lead` no choque con ellos. Los crea la app `landing_crm` en cada `bench migrate` (`landing_crm/setup.py`).

**¿Y el `Contact`?** No se crea al recibir la consulta. El `CRM Lead` guarda los datos de la persona en sus propios campos; el `Contact` y la *CRM Organization* los crea el CRM al convertir el `CRM Lead` en `CRM Deal`. Crearlos antes llenaría la libreta de contactos con cada visitante, el mismo problema que con el Customer.

**Campos que `submit_lead` no completa:** `mobile_no` (el formulario no pide teléfono: la `reference` es el vínculo con la conversación de WhatsApp) y `website` (con el enriquecimiento automático del CRM activado, el CRM visita ese sitio, y el dato vendría de un desconocido). Los campos propios se agregan a *CRM Fields Layout* (panel lateral) para que se vean en la ficha *(confirmar en la interfaz)*.

### 7.4 Arquitectura: tres opciones

La arquitectura completa (componentes, zonas de confianza, DNS, secretos y qué hay que conseguir) está en [INTEGRACIONES.md](INTEGRACIONES.md). Acá solo la decisión:

| Opción | Cómo | Ventajas | Desventajas |
|---|---|---|---|
| **A. Directo a Frappe** | El navegador llama a un método de invitado de una app propia de Frappe | El sitio sigue 100 % estático; ningún secreto en el front; menos piezas | El dominio de Frappe queda expuesto; todo el control de abuso vive en Frappe y Cloudflare |
| B. Función intermedia en Vercel | El navegador llama a una función en Vercel, que llama a Frappe con una clave de API | Oculta Frappe; permite límite de peticiones en Vercel | Deja de ser estático (o suma funciones aparte); hay una clave de API que cuidar; una pieza más que mantener |
| C. Todo en Frappe | Servir la landing desde Frappe | Un solo sistema | Se pierde Vercel y su CDN; mezcla público y administración |

**Recomendación: A, detrás de Cloudflare.** Mantiene el modelo estático (y con él la CSP por hash), no deja secretos en el front y concentra las defensas en un lugar. Pasar a B solo si se necesita lógica que no deba vivir en Frappe.

### 7.5 Contrato del endpoint (servidor: `landing_crm.api`; front: `src/model/crm.ts` y `src/controller/registerLead.ts`)

`POST https://crm.tudominio.com/api/method/landing_crm.api.submit_lead` — sin cookies.

Entrada (JSON):

| Campo | Tipo | Regla en el servidor |
|---|---|---|
| `idempotency_key` | UUID generado por el navegador | Si ya existe, devuelve la referencia del `CRM Lead` previo **sin volver a verificar Turnstile** (el token de un reintento ya se gastó). La base tiene un índice único: dos envíos simultáneos con la misma clave no crean dos. No es una credencial |
| `visit_key` | UUID, opcional | Uno por pestaña (sessionStorage `ml-visit`; se crea recién al registrar). El envío se suma al `CRM Lead` de esa clave **solo si** ese lead sigue abierto (sin convertir y en un estado que no sea del tipo *Lost*: *Unqualified*, *Junk*) **y** es la misma persona: el nombre (sin distinguir mayúsculas ni acentos) o el correo coinciden con los del lead o con los del envío anterior. Una pestaña no es una persona (computadora compartida, el teléfono de Mariano pasando de mano en mano). Entonces no se crea otro lead: se suma una *FCRM Note* «Relevamiento ML-… · envío N» y se devuelve **la misma referencia**. Las correcciones de contacto se aplican al lead salvo en un campo que Mariano haya editado desde el último envío, y un dato vacío no borra nada; la nota lista cada cambio y si se aplicó. Las mismas respuestas otra vez no suman nota. Si no se cumplen las dos condiciones, se crea un lead nuevo cuya nota apunta al de la misma pestaña. Como solo esa pestaña conoce la clave, nadie más puede sumar envíos a ese lead ni enterarse de su referencia. Un valor que no es UUID se rechaza |
| `message` | texto, opcional | El mensaje de WhatsApp **solo si el cliente lo editó a mano** (puede decir algo que las respuestas no: otro correo, una aclaración). Hasta 8000 caracteres, limpiado como el resto, y escapado en la nota. Editarlo es otro envío (otra clave de idempotencia) |
| `locale` | `es`, `pt` o `en` | Lista cerrada |
| `form_version` | entero | Tiene que ser igual a la versión del catálogo que tiene el servidor (hoy 3); otra se rechaza |
| `origin` | texto | Solo `[a-z0-9_-]{1,24}`. Un origen conocido (`tarjeta`) va a su *CRM Lead Source*; cualquier otro, a *Landing* |
| `offer` | texto | Hasta 140 caracteres. Es lo que el cliente vio: no se usa para calcular nada |
| `services` | lista de ids | De 1 a 6, solo ids del catálogo |
| `answers` | mapa id → texto o lista de ids | **Incluye los datos de contacto** (`p_nombre`, `p_org`, `p_ubicacion`, `p_correo`): no hay un objeto `contact` aparte. Una pregunta o una opción que el catálogo no conoce se descarta; un tipo equivocado o un texto más largo que en el front (120 y 600 caracteres) se rechaza. El nombre es obligatorio; un correo inválido **no** hace perder la consulta (queda en la nota). **El servidor no confía en nada** |
| `consent` | booleano | Obligatorio; la fecha la pone el servidor |
| `turnstile` | token | Hasta 2048 caracteres; se verifica contra `https://challenges.cloudflare.com/turnstile/v0/siteverify` (tope de 4 s). Sin `turnstile_secret` en el sitio, o si Cloudflare no responde, se rechaza |
| `website` | texto | Campo señuelo (honeypot): con contenido, no se guarda nada y se responde como si todo hubiera ido bien, con la referencia `ML-AAMMDD-0000` (la serie real empieza en 0001) |

Salida: `{ "reference": "ML-261120-0042", "submission": 1 }` y nada más (sin ids internos ni datos del `CRM Lead`). `submission` es qué envío de ese lead fue: más de 1 solo para la misma persona desde la misma pestaña, que ya conocía la referencia. El front lo muestra junto a ella («ML-261120-0042 (envío 2)»), en WhatsApp y en la pantalla final, igual que el título de la nota en el CRM; y desde que hay respuesta, la consulta usa la referencia del servidor (arriba, en el mensaje y en un reenvío). Un reenvío sin consentimiento sale con esa referencia marcada «sin registro».

**La misma persona en otra visita** (otro día, otro dispositivo) no se junta sola: cualquiera puede escribir el correo o el nombre de otro, y juntar por eso permitiría sumar notas al `CRM Lead` ajeno o, por la referencia devuelta, enterarse de que esa persona ya consultó. Se crea un `CRM Lead` nuevo, y su nota avisa «Posible duplicado: mismo correo (o nombre) que ML-…», con el enlace al anterior, para que Mariano decida. La respuesta al visitante es la misma en los dos casos. Es lo mismo que hace Frappe: todo visitante es el usuario *Guest* (sin sesión ni identidad propia) y los formularios web del CRM crean un lead por envío; la clave de visita solo agrega la agrupación que se puede probar.

**Si el CRM rechaza la actualización** de un lead, el envío no se pierde: se guardan los campos `landing_*` sin los cambios de contacto y la nota dice qué no se aplicó y por qué. El caso conocido es una regla del propio Frappe CRM: un lead no puede tener como **correo del cliente** el mismo correo que su **responsable** (*lead owner*). Asignarse un lead no tiene ese problema mientras el cliente tenga otro correo; solo aparece si alguien envía el formulario con el correo de Mariano (por ejemplo, él mismo al probarlo). Por eso un reenvío que cambia el correo al del responsable no se aplica.

**Limpieza de lo que escribe el cliente.** En el navegador, cada campo tiene su largo máximo y el texto de WhatsApp pasa a forma NFC y sin caracteres de control ni invisibles que reordenan el texto (`cleanText`); `encodeURIComponent` impide que el texto cambie la dirección de `wa.me`. WhatsApp no interpreta HTML, así que no hay nada que escapar. En el servidor, `payload.parse` vuelve a hacer todo (la limpieza del navegador no cuenta: se puede saltear) y valida contra el catálogo. Las respuestas de una línea (las que pueden ser campos del lead) pierden `<` y `>`: Frappe CRM pone el nombre del lead sin escapar en el HTML de sus notificaciones, y su filtro (DOMPurify) quita scripts pero deja `<img src=…>`, que serviría de píxel de rastreo. La nota escapa cada valor (el texto largo y el mensaje editado conservan `<` y `>` como texto). SQL: todas las consultas pasan por el ORM de Frappe con parámetros; ningún valor del visitante se concatena en una consulta. Planillas: al exportar a CSV o Excel, Frappe antepone un apóstrofo a los valores que empiezan con `=`, `+`, `-` o `@`. Correo: uno con saltos de línea u otros caracteres raros no es válido y no llega al campo `email`, así que no puede inyectar encabezados. Para I-5: el Jinja de Frappe no escapa solo; los correos a Mariano tienen que escapar cada valor y nunca usarlo como plantilla.

**Orden de las comprobaciones** (lo barato primero; Turnstile, que ocupa un worker mientras espera a la red, al final): límite por IP → tamaño del cuerpo (64 KB) → honeypot → forma del cuerpo → clave ya registrada → token de Turnstile → alta.

**Límite por IP:** 10 envíos cada 10 minutos y 30 por día, además de la regla de Cloudflare. La IP sale de `CF-Connecting-IP`, que Cloudflare fija; `X-Forwarded-For` puede venir prellenado por el visitante y se ignora. Eso solo es cierto si el servidor acepta tráfico únicamente del túnel. Detrás de una red móvil con una IP compartida, 30 por día alcanza para el uso previsto, pero es un número a revisar con tráfico real.

**Errores:** siempre el mismo texto genérico («No se pudo registrar la consulta.»): 417 para un cuerpo inválido, 403 para un token que no verifica, 429 para el límite. El motivo real queda solo en el registro del servidor (`sites/<sitio>/logs/landing_crm.log`).

**Catálogo.** El servidor valida contra `landing_crm/data/catalog.json`, que se genera desde `src/model/catalog.ts` con `node scripts/export-catalog.mjs <salida>`. **Antes de desplegar un front con preguntas nuevas o un `SURVEY_VERSION` nuevo, hay que regenerarlo y hacer `bench migrate`/reiniciar en el servidor**: un front con otra versión es rechazado (el cliente igual llega a WhatsApp por el respaldo, pero la consulta no queda en el CRM).

**Referencia.** La emite el servidor con una **serie de nombres** de Frappe (`ML-.YY.MM.DD.-.####`: un contador por día), que incrementa de forma atómica: el serial es verdadero y no se repite. Ojo: el formato actual del front (`[A-HJ-NP-Z2-9]{4}`) excluye los dígitos 0 y 1, que un contador numérico sí usa; al integrar hay que **actualizar `REFERENCE_PATTERN`** (`src/model/message.ts`), la validación de `sanitize()` y el script de reanudación, y mantener una forma distinguible para las referencias locales de respaldo (por ejemplo, un prefijo propio).

**Respaldo.** Si la llamada falla o tarda más de unos 4 segundos, el front abre WhatsApp igual con una referencia local marcada como "sin registro". Mariano la ve y puede cargarla a mano. Así el CRM nunca es un punto único de falla para el cliente.

### 7.6 Refuerzo del lado de Frappe (lista de verificación)

- [ ] Una **app propia** con un único método `@frappe.whitelist(allow_guest=True, methods=["POST"])`. El invitado **no** recibe permisos de creación sobre `CRM Lead`: el método crea el registro con permisos elevados dentro del código, tras validar.
- [ ] Límite de peticiones por IP en el método (`frappe.rate_limiter.rate_limit`; confirmar que existe y cómo se usa en la versión instalada) **y** una regla de límite en Cloudflare delante.
- [ ] Verificación de Turnstile en el servidor; el secreto en `site_config.json`, nunca en el front.
- [ ] CORS cerrado al origen del sitio (`allow_cors` en la configuración del sitio de Frappe), sin comodines.
- [ ] Validación completa de todo lo recibido contra el catálogo; tope de tamaño del cuerpo.
- [ ] Respuestas mínimas y mensajes de error genéricos.
- [ ] Cloudflare delante del servidor: WAF, ocultar la IP de origen, y el cortafuegos del servidor solo admite tráfico desde Cloudflare.
- [ ] El escritorio de Frappe (`/app`) restringido (Cloudflare Access o lista de IP) y 2FA obligatoria para el personal.
- [ ] Registro de accesos y alertas; actualizaciones de Frappe y del sistema al día; copias de seguridad cifradas y probadas; usuario del sistema sin privilegios.
- [ ] Retención definida: cuánto tiempo se guardan los `CRM Lead` sin convertir.

**Efectos en este repositorio** (ya implementados, ver INTEGRACIONES.md I-4): `CSP_CONNECT_SRC` con el origen de Frappe; si se usa Turnstile, hay que permitir `https://challenges.cloudflare.com` en `script-src`, `frame-src` y `connect-src` (y ese script no puede llevar SRI); nuevo flujo "enviando…" y respaldo en `Chat`/`useSurvey`; la frase de privacidad del pie debe cambiar.

### 7.7 Privacidad y obligaciones legales

Guardar nombre, correo y datos del negocio convierte al sitio en un responsable de datos personales. Antes de activar el CRM: casilla de consentimiento (con texto claro y fecha registrada), política de privacidad enlazada, finalidad y plazo de retención, y forma de pedir acceso o borrado. Según el país del cliente pueden aplicar la ley argentina de protección de datos personales (Ley 25.326), la LGPD en Brasil (el sitio tiene versión en portugués) y el GDPR si hay clientes en la UE. Conviene revisarlo con un profesional; este documento no es asesoramiento legal.

## 8. Hoja de ruta

| Fase | Contenido | Estado |
|---|---|---|
| **0. Endurecimiento del front** | Encabezados, CSP por hash (scripts y estilos), SRI, manifiesto y verificador, `sanitize`, pruebas | **Hecho** (falta probar la CSP en navegadores reales) |
| **1a. CI y vigilancia** | `ci.yml`, `verify-live.yml`, Dependabot, `npm audit` | **Escrito y ensayado en local**; falta activarlo (5.7) |
| **1b. Operación segura** | Probar la CSP en una vista previa de Vercel en Chrome, Firefox y Safari. 2FA en Vercel, GitHub y el registrador. Bloqueo de transferencia y DNSSEC del dominio. Revisar el dominio en Mozilla Observatory y securityheaders.com. QR solo al dominio propio (`/?o=tarjeta`) | Pendiente |
| **2. Cloudflare, Frappe/CRM y arquitectura completa** | Ver [INTEGRACIONES.md](INTEGRACIONES.md): qué se integra, en qué orden, y qué hay que conseguir | **Próximas integraciones** (pendiente de decisión) |
| **3. Mejora continua** | Hash para los `.js` en la CSP, endpoint de reportes CSP, detección de reversiones a versiones viejas, rotación de dependencias | Futuro |

Criterio de "hecho" de la fase 1: la vista previa carga sin errores de la CSP en la consola (salvo el aviso esperado de `cssText`, ver 5.2); `verify-live.yml` pasa a mano contra el dominio real; y, alterando a propósito un archivo de prueba en un despliegue de vista previa, la verificación abre una incidencia.

## 9. Decisiones abiertas

1. **¿Se conecta el CRM?** Depende de si se quiere serial real y seguimiento (7.1). Mientras tanto, la referencia aleatoria es una etiqueta.
2. **Cloudflare delante de Vercel o no.** Ver [INTEGRACIONES.md](INTEGRACIONES.md): la recomendación es dividir, con el sitio en Vercel y Cloudflare delante del CRM.
3. **Quién recibe la alerta** de `verify-live.yml` (correo de GitHub por defecto) y si se suma otro canal.
4. **Cómo se cobra la consulta.** Si se cobra, el identificador de la operación lo emite el proveedor de pagos o el servidor, nunca el navegador (ver 4).

## 10. Dónde está cada cosa

| Qué | Archivo |
|---|---|
| Encabezados de producción | `vercel.json` |
| Lógica de endurecimiento y verificación (pura, probada) | `scripts/lib/harden.mjs` (tipos en `harden.d.mts`) |
| Paso posterior al build (SRI, CSP, manifiesto) | `scripts/harden-build.mjs` — se ejecuta con `npm run build` |
| Verificador de `out/` o del sitio publicado | `scripts/verify-site.mjs` — `npm run verify` |
| Identificador de build estable | `next.config.ts` (`generateBuildId`) |
| Saneamiento del estado guardado | `src/controller/surveyReducer.ts` (`sanitize`) |
| Formato de la referencia | `src/model/message.ts` (`REFERENCE_PATTERN`, `isValidReference`) |
| Flujos de GitHub Actions y Dependabot | `.github/workflows/ci.yml`, `.github/workflows/verify-live.yml`, `.github/dependabot.yml` |
| Versión de Node del CI (y a igualar en Vercel) | `.nvmrc` |
| Pruebas | `tests/security.test.ts`, `tests/security-dom.test.ts`, `tests/resume.test.ts` |
| Manifiesto del último build (no se publica ni se versiona) | `.integrity/manifest.json` |
