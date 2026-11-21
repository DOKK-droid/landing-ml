# QA y trazabilidad

Cómo se verifica el sitio, qué cubren las pruebas automáticas, qué hay que mirar a mano y cómo seguir el rastro de una consulta. Complementa a [ESPECIFICACION.md](ESPECIFICACION.md).

## 1. Comandos

| Comando | Qué comprueba |
|---|---|
| `npm test` | Pruebas del modelo, el controlador, la vista previa, la conversación operada en un DOM simulado y la seguridad (157 al 2026-11-20; las de interfaz y las de seguridad contra el DOM usan `jsdom`, dependencia de desarrollo) |
| `npm run lint` | Tipado estricto (`tsc --noEmit`) |
| `npm run build` | Que el sitio estático se genere para `es`, `pt` y `en`, y lo endurece: SRI, CSP por página y manifiesto de integridad (`scripts/harden-build.mjs`) |
| `npm run verify` | Revisa `out/` contra la política de seguridad: CSP con hash de cada script en línea, `integrity` correcto en cada recurso, sin manejadores en línea ni orígenes externos, `vercel.json` y comparación con el manifiesto. Correr después de `npm run build` |
| `node scripts/verify-site.mjs --url https://tu-dominio --manifest .integrity/manifest.json` | Lo mismo sobre el sitio **publicado**, con sus encabezados reales |
| `npm run build && npm start` | El sitio como se publica. **Usar este, no `next dev`, para probar el cambio de idioma a mitad del relevamiento**: en desarrollo el Strict Mode borra la marca que evita el destello de la landing |

## 2. Matriz requisito → prueba automática

| Requisito | Prueba |
|---|---|
| La primera sección pregunta solo actividad, personas y sucursales, todas obligatorias | `survey.test.ts` · "el paso 1 pregunta solo…" |
| Nombre y contacto se piden al final | `survey.test.ts` · "el nombre y los datos de contacto…" |
| Orden: actividad → servicios → expectativas → contacto | `survey.test.ts`, `qa-flow.test.ts`, `chat-flow.test.ts` |
| Una pregunta obligatoria sin responder no deja avanzar y marca exactamente esa; una opcional se omite | `qa-flow.test.ts` (63 combinaciones), `survey.test.ts`, `chat-ui.test.ts` |
| Toda combinación de servicios llega a la revisión, pregunta por pregunta | `qa-flow.test.ts` |
| Una pregunta por vez, con la sección en curso, su avance y la introducción solo en la primera pregunta | `chat-ui.test.ts` · "una pregunta por vez" |
| Opción única: elige y pasa sola tras una pausa; cambiar de opción durante la pausa avanza una sola vez | `chat-ui.test.ts` · "responder con chips" |
| Opción múltiple: no avanza sola; se sigue con *Siguiente* | `chat-ui.test.ts` |
| Texto: lo escrito aparece en la vista previa; Enter envía y Mayús+Enter no (solo con teclado físico) | `chat-ui.test.ts` |
| Atrás conserva lo respondido; no se puede saltar a secciones futuras | `chat-ui.test.ts`, `chat-flow.test.ts` |
| La transición: sale la anterior, "escribiendo…", entra la nueva; atrás no simula escribir; sin animación con "reducir movimiento" | `chat-ui.test.ts` · "la transición entre preguntas" |
| Foco: a la pregunta en táctil, al campo con mouse; chips accesibles y campos rotulados | `chat-ui.test.ts` · "foco y teclado" |
| Recorrido completo por la interfaz hasta la revisión con el mensaje listo | `chat-ui.test.ts` · "recorrido completo por la interfaz" |
| El estado guarda la pregunta en curso y se retoma al volver a montar | `chat-ui.test.ts` · "persistencia", `survey.test.ts` (`sanitize`) |
| La vista previa es exactamente el mensaje que se envía | `qa-flow.test.ts` · "vista previa fiel" |
| Los datos críticos faltantes aparecen como pendientes, y solo esos | `qa-flow.test.ts`, `preview.test.ts` |
| Una opción obsoleta no cuenta como respondida | `qa-flow.test.ts` |
| Lo que escribe el cliente no inyecta HTML en la vista previa | `preview.test.ts` |
| La vista previa resalta la pregunta en curso (aunque sea opcional) sin alterar el texto enviado | `preview.test.ts`, `chat-flow.test.ts` |
| La oferta (USD 9 **cada 10 min**, antes USD 12, −25 %) y su registro en el mensaje | `offer-trace.test.ts` |
| El costo total sale por bloques: 30 min = USD 27, 1 h = USD 54, 3 h = USD 162; un tramo incompleto suma un bloque | `offer-trace.test.ts` |
| La consulta no se menciona en pedidos solo de Soporte | `offer-trace.test.ts` |
| Soporte 24/7 describe emergencias, reparación y mantenimiento, remoto o presencial | `offer-trace.test.ts` |
| Referencia, versión del formulario, idioma y origen en el pie del mensaje | `offer-trace.test.ts` |
| El origen se normaliza, el primero gana y sobrevive al reinicio | `offer-trace.test.ts` |
| Todo texto está traducido a es, pt y en | `survey.test.ts`, `offer-trace.test.ts` |
| El enlace de WhatsApp respeta el límite con un servicio y el aviso salta con los seis al máximo | `qa-flow.test.ts` |
| Cambiar de idioma a mitad del relevamiento no muestra la landing | `resume.test.ts` (el script que oculta la landing) |
| Cada script en línea tiene su hash en la CSP; cada recurso propio lleva `integrity`; el build falla si falta un recurso | `security.test.ts` · "endurecimiento de una página", "política CSP" |
| Los estilos no admiten `unsafe-inline`: cada `<style>` y `style="…"` se permite por hash, con las entidades HTML resueltas | `security.test.ts` · "estilos en línea sin unsafe-inline" |
| Los hashes del verificador coinciden con lo que lee un analizador de HTML real, también en el build completo | `security-dom.test.ts` |
| Las acciones del CI están fijadas por commit, con permisos mínimos y el SHA publicado se valida antes de usarse | `security.test.ts` · "flujos de GitHub Actions" |
| Se detecta un script alterado o inyectado, uno externo, manejadores en línea, iframes y `javascript:` | `security.test.ts` · "detección de alteraciones" |
| El manifiesto detecta archivos alterados, de más o ausentes | `security.test.ts` · "manifiesto de integridad" |
| `vercel.json` trae los encabezados exigidos | `security.test.ts` · "encabezados de vercel.json" |
| El estado guardado manipulado no entra: referencia, tipos, ids, largos | `security.test.ts` · "saneamiento del estado" |

## 3. Lo que las pruebas automáticas **no** cubren

Se verifica a mano (sección 4): **que la CSP no bloquee nada en un navegador real** (jsdom no aplica CSP ni SRI), **cómo se ve** (estilos, altura de la tarjeta de conversación, el contorno y el hover de los servicios), fluidez de las animaciones, diseño responsivo, hidratación real en el navegador, teclado del celular, cómo se ve el mensaje en WhatsApp, lectores de pantalla y contraste. Las pruebas de interfaz usan un DOM simulado: comprueban qué elementos hay y en qué orden, no el aspecto ni el rendimiento. No se pudo ejecutar un navegador en el entorno de desarrollo, así que nada de esto está medido todavía.

## 4. Lista de verificación manual

**Recorrido**
- [ ] Un servicio, celular: se completa en menos de 3 minutos; el teclado correcto aparece en correo y nombre.
- [ ] La tarjeta entra en la pantalla (celular chico, 360×640, y escritorio): la banda de la sección, la vista previa y la zona de respuesta se ven a la vez sin tapar la pregunta. Con 8 chips la zona de respuesta no aplasta la vista previa.
- [ ] Transición entre preguntas: se siente suave (sale, \"escribiendo…\", entra); no hay saltos de altura notorios de la vista previa; el indicador no se siente lento en un recorrido largo (si molesta, bajar `TYPING_MS` en `Chat.tsx`).
- [ ] Opción única: al tocar un chip se ve la elección y pasa sola; en celular no se toca dos veces sin querer. Opción múltiple: *Siguiente* siempre a mano.
- [ ] Texto largo: el campo crece hasta un tope; en escritorio Enter envía y Mayús+Enter agrega línea; en celular Enter agrega línea.
- [ ] Seis servicios, escritorio: la vista previa se desplaza sola hasta la pregunta en curso y el indicador de datos clave sube al responder.
- [ ] Atrás y la barra de progreso: se vuelve a una pregunta o sección anterior sin perder respuestas.
- [ ] Soporte: la modalidad (remoto o presencial) es obligatoria.
- [ ] Revisión: se puede editar el mensaje, copiar y enviar. Después de enviar, "Nuevo relevamiento" vuelve a empezar.

**Cambio de idioma** (con el build de producción)
- [ ] En cada paso, cambiar es → pt → en: no se ve la landing y no se pierden respuestas.
- [ ] Editar el mensaje en la revisión y cambiar de idioma: el texto editado conserva el idioma en que se escribió (comportamiento actual).

**Landing**
- [ ] El aviso del inicio y la sección *Relevamiento técnico* muestran USD 9, USD 12 tachado, −25 % y \"cada 10 min\", y los ejemplos 30 min / 1 h / 3 h (USD 27 / 54 / 162), en los tres idiomas. Se lee claro que el precio es por bloque y no por reunión.
- [ ] La tarjeta de Soporte 24/7 habla de emergencias, reparación y mantenimiento, remoto o presencial.
- [ ] Con mouse no hay botón *Ver detalle*; el detalle se abre al pasar el cursor y al enfocar con Tab. En táctil el botón está.
- [ ] Servicios, hover: el contorno degradado del color aparece suave, la tarjeta sube un poco, el ícono se inclina, el detalle entra escalonado y al salir se cierra sin saltos. En una tarjeta ya agregada el contorno no se atenúa al pasar el mouse.
- [ ] El contorno degradado usa `mask-composite`: comprobar que se ve bien en Chrome, Safari y Firefox actuales (en un navegador sin soporte solo cambia el color del borde).
- [ ] El botón de Emergencia abre WhatsApp con la plantilla (incluye "Remoto o presencial").

**WhatsApp real** (Android, iPhone y WhatsApp Web)
- [ ] El mensaje llega completo, con acentos y viñetas, y se ve el formato (*negrita*, _cursiva_).
- [ ] Un mensaje de seis servicios no se trunca.
- [ ] El QR con `?o=tarjeta` deja `origen: tarjeta` en el pie.

**Seguridad** (ver [SEGURIDAD.md](SEGURIDAD.md))
- [ ] Vista previa de Vercel en Chrome, Firefox y Safari con la consola abierta: recorrer landing, relevamiento completo, revisión y cambio de idioma. No debe aparecer ningún `Refused to …` ni error de `integrity`. El único aviso esperado es `style-src-attr` por el anunciador de rutas de Next (`cssText`; ver SEGURIDAD.md, 5.2).
- [ ] **Los colores de cada servicio y los retardos de aparición se ven** (son los `style=` por hash). Si la landing se ve sin color por servicio, algún hash no coincide: avisar.
- [ ] CI activado en GitHub: variable `SITE_URL`, Node de Vercel = `.nvmrc`, `NEXT_PUBLIC_SITE_URL` igual en ambos lados; `ci.yml` pasa en el primer push.
- [ ] `verify-live.yml` ejecutado a mano (Actions → Run workflow) tras el primer despliegue real; pasa o se corrige el entorno hasta que pase (calibración).
- [ ] `node scripts/verify-site.mjs --url https://<vista-previa> --manifest .integrity/manifest.json` termina bien.
- [ ] Los encabezados llegan: revisar el dominio en securityheaders.com y en Mozilla Observatory.
- [ ] El sitio no se deja incrustar en un `<iframe>` ajeno.
- [ ] Alterar a propósito un archivo de prueba en un despliegue y comprobar que la verificación programada avisa.

**Accesibilidad y rendimiento**
- [ ] Recorrer todo solo con teclado (Tab/Shift+Tab/Enter/Espacio): los chips se activan con Espacio o Enter; la región de la vista previa se desplaza con teclado.
- [ ] Lector de pantalla (VoiceOver o TalkBack): al llegar una pregunta se lee la pregunta; se anuncian \"Preparando la siguiente pregunta\", los errores y el avance de datos clave.
- [ ] "Reducir movimiento" activado: no hay animaciones ni apariciones al hacer scroll, y todo el contenido se ve.
- [ ] Lighthouse y axe: contraste (revisar el gris `--dim`), foco y semántica.
- [ ] Scroll y escritura fluidos en un celular de gama media.

## 5. Trazabilidad de una consulta

| Dato | Dónde queda | Para qué sirve |
|---|---|---|
| Referencia `ML-AAMMDD-XXXX` | Título del mensaje y parte superior del relevamiento | Encontrar la conversación en WhatsApp: buscar `ML-` más la fecha o el código |
| Servicios de interés | Encabezado del mensaje | Saber qué áreas pidió |
| Oferta vista | Línea *Consulta* | Registrar el precio por bloque de 10 minutos y la oferta que vio el cliente al pedir |
| Idioma y dominio | Pie del mensaje | Saber qué versión del sitio usó |
| Versión del formulario (`vN`; hoy `v3`) | Pie del mensaje | Interpretar las respuestas si las preguntas o la oferta cambian |
| Origen (`origen: …`) | Pie del mensaje | Medir qué canal trae consultas (tarjeta, enlace, etc.) |

Cuando cambien las preguntas de forma que afecte la lectura de las respuestas, subir `SURVEY_VERSION`.

## 6. Hallazgos de QA de esta iteración

Encontrados por las pruebas nuevas y ya corregidos:

1. **Respuestas obsoletas contaban como completas.** Una opción cuyo id ya no existe en el catálogo pasaba la validación pero el mensaje la omitía, así que el cliente podía enviar sin saber que faltaba un dato crítico. Ahora no cuenta como respondida.
2. **Texto de la vista previa con secciones vacías.** Convertir a texto una lista con pendientes dejaba encabezados sin contenido. El mensaje enviado no se veía afectado, pero la conversión ahora es consistente.
3. **Límite de 600 caracteres en campos de una línea.** Nombre, correo y ciudad admitían lo mismo que un texto largo y empujaban el enlace de WhatsApp hacia el límite. Ahora son 120 (`site.maxLineLength`).
4. **El relevamiento guardado se pisaba en desarrollo** (Strict Mode ejecuta los efectos dos veces). Corregido en la iteración anterior: no se guarda nada hasta terminar de restaurar.

Límite conocido: con los seis servicios y todos los textos al máximo, el enlace supera los 6000 caracteres; la interfaz avisa y el cliente puede acortar o copiar el mensaje.

## 7. Riesgos de la conversación guiada y cómo se cubren

No son defectos hallados en producción sino riesgos previstos al diseñarla; cada uno tiene una prueba que lo fija:

1. **Doble avance con opción única.** Si el cliente cambia de opción durante la pausa de 320 ms, el temporizador de la pregunta se reinicia: avanza una sola vez, con la última elegida (prueba "cambiar de opción durante la pausa").
2. **Navegar durante la salida.** Mientras la pregunta anterior se desvanece, la zona de respuesta queda `inert`, para que no se pueda tocar *Siguiente* sobre una pregunta que ya cambió (prueba de la secuencia de transición).
3. **Saltos adelante.** Con una pregunta por vez, ir a un paso futuro dejaría obligatorias sin responder. La barra de progreso solo permite volver hacia atrás (o a cualquier sección desde la revisión) (`chat-flow.test.ts`).
4. **Estado guardado de otra versión.** El estado guarda `cursor` (la pregunta en curso) y la clave de almacenamiento pasó a `v3`; `sanitize` ajusta un cursor fuera de rango, no numérico o ausente (`survey.test.ts`).

Limitaciones conocidas:
- El "escribiendo…" suma unos 550 ms por pregunta (salida 170 ms + indicador 380 ms); en un recorrido de 17 preguntas son unos 9 segundos de espera acumulada. Está en `EXIT_MS` y `TYPING_MS` (`Chat.tsx`) por si resulta lento.
- Al cambiar de idioma a mitad del relevamiento se vuelve a "escribir" la pregunta en curso (el cambio recarga la página).

