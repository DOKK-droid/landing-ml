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
| El paso 1 pregunta quién consulta y qué necesita; un particular, solo perfil y necesidad | `survey.test.ts` · "el paso 1 pregunta quién consulta…" |
| Nombre y contacto se piden al final; al menos un medio de contacto (sin correo, teléfono obligatorio) | `survey.test.ts`, `catalog-semantics.test.ts`, `chat-ui.test.ts` · "datos de contacto" |
| Orden: su consulta → situación actual → servicios → objetivos y reunión → contacto | `survey.test.ts`, `qa-flow.test.ts`, `chat-flow.test.ts` |
| Ningún dato se pregunta dos veces y a ningún servicio le falta lo crítico (5 perfiles × 63 combinaciones) | `catalog-semantics.test.ts` |
| Las condiciones solo miran preguntas anteriores; una respuesta de una pregunta oculta no cuenta ni se envía | `catalog-semantics.test.ts`, `survey.test.ts`, `crm.test.ts` |
| Los pares que se deducían uno del otro ya no conviven (sedes, sistema actual, entregable, migración, alcance, emergencia, decisor) | `catalog-semantics.test.ts` · "pares que se podían deducir…" |
| Tamaño, rubro y perfil con los valores exactos de Frappe CRM | `catalog-semantics.test.ts` · "alineado con Frappe CRM"; en el servidor, contra la base real |
| Formato de correo, teléfono y web; sugerencia de correo; opciones exclusivas | `validation.test.ts`, `chat-ui.test.ts` |
| El servidor resuelve el recorrido igual que el front | `landing_crm/tests/test_payload.py` · paridad con `catalog_cases.json` (330 casos) |
| Una pregunta obligatoria sin responder no deja avanzar y marca exactamente esa; una opcional se omite | `qa-flow.test.ts` (5 perfiles × 63 combinaciones), `survey.test.ts`, `chat-ui.test.ts` |
| Toda combinación de servicios y perfil llega a la revisión, pregunta por pregunta | `qa-flow.test.ts` |
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
| La oferta **por tramos de duración** (normal USD 12 por bloque de 10 min por debajo de 1 h; USD 9 desde 1 h; USD 8 desde 2 h; USD 7 desde 5 h; la tarifa del tramo rige para TODA la reunión), que el total baje a propósito al cruzar cada umbral y suba con cada bloque dentro de un tramo, y su registro en el mensaje | `offer-trace.test.ts` |
| El costo total sale por bloques con la tarifa del tramo: 30 min = USD 36 (tarifa normal), 1 h = USD 54, 1 h 59 min = USD 108, 2 h = USD 96, 4 h = USD 192, 5 h = USD 210, 5 h 30 min = USD 231; un tramo incompleto suma un bloque; el ahorro de cada ejemplo | `offer-trace.test.ts` |
| La consulta no se menciona en pedidos solo de Soporte | `offer-trace.test.ts` |
| Soporte 24/7 describe emergencias, reparación y mantenimiento, remoto o presencial | `offer-trace.test.ts` |
| Referencia, versión del formulario, idioma y origen en el pie del mensaje | `offer-trace.test.ts` |
| El origen se normaliza, el primero gana y sobrevive al reinicio | `offer-trace.test.ts` |
| Todo texto está traducido a es, pt y en | `survey.test.ts`, `offer-trace.test.ts` |
| El enlace de WhatsApp respeta el límite con un servicio y el aviso salta con los seis al máximo | `qa-flow.test.ts` |
| Cambiar de idioma a mitad del relevamiento no muestra la landing | `resume.test.ts` (el script que oculta la landing) |
| La oferta vive en su propia página (`/tarifas/`): el inicio ya no la trae, el menú marca *Tarifas*, los enlaces entre páginas son completos y el selector de idioma conserva la página; el script de reanudación no oculta las tarifas | `rates-page.test.ts` |
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
- [ ] *Tarifas*: con un relevamiento a medias, abrir `/es/tarifas/` (desde el menú o escribiendo la dirección) muestra la página de inmediato, sin quedar oculta unos segundos; *Solicitar consulta* vuelve al inicio y retoma el relevamiento. En el celular (sin menú) se llega con el aviso del precio del inicio.
- [ ] *Inicio ↔ Tarifas no recarga el sitio*: con la pestaña Network abierta (producción: `npm run build && npm start`, no `next dev`), pasar del inicio a Tarifas y volver por el menú, el aviso del precio, el logo o *Solicitar consulta* no pide un documento HTML nuevo ni muestra el banner de carga; solo aparecen el payload de la ruta (`__next.*.txt`) y, la primera vez, un script de pocos bytes. El selector de idioma, en cambio, sí carga la página entera (es a propósito).
- [ ] Editar el mensaje en la revisión y cambiar de idioma: el texto editado conserva el idioma en que se escribió (comportamiento actual).

**Landing**
- [ ] El aviso del inicio y la página *Tarifas* (`/es/tarifas/`, `/pt/tarifas/`, `/en/tarifas/`) muestran **el precio de la hora** (USD 54, con USD 72 tachado y −25 %) y su **equivalencia por bloque** ("Equivale a USD 9 cada 10 min (antes USD 12)"), la frase de la ventaja ("de USD 54 a USD 42 la hora, hasta −42 %"), la escalera de tramos con el precio por 10 min y por hora, el descuento y una barra que se acorta (menos de 1 h USD 12 / USD 72 · 1 h a 1 h 59 min USD 9 / USD 54, −25 % · 2 h a 4 h 59 min USD 8 / USD 48, −33 % · desde 5 h USD 7 / USD 42, −42 %) y los **cuatro ejemplos** 30 min / 2 h / 3 h / 5 h 30 min (USD 36 / 96 / 144 / 231, con su total normal tachado y su ahorro: USD 48 / 72 / 165), en los tres idiomas. Los 30 min no llevan tachado ni ahorro: dicen "la oferta empieza en 1 h". Las barras crecen al aparecer la tarjeta y con "reducir movimiento" se ven terminadas. En ningún texto aparece la palabra "referencia".
- [ ] La estela de la primera pata de la M: **sale de la pata**, que se tiñe de lila en su parte de abajo (el velo se mezcla con ella, sin costura), pasa al **violeta del logotipo** (`#8a3cff`) y, al final del pie, **gira con un corte seco —sin curva—** y **baja por una diagonal paralela a la segunda diagonal de la M**, por debajo del renglón de la base. Esa diagonal **sobresale del lienzo hacia el vacío** (el logo no cambia de tamaño) y se **oscurece y se apaga en punta**, con trazos al final. Es una **sombra** con un resplandor lila difuso a su alrededor: sin brillos blancos. El degradado es **uno solo y continuo** (pata → pie → diagonal → punta), sin salto de color ni de brillo en la esquina. No toca la L, que conserva su celeste. Mirarla en el hero, en el logo del banner y en el del encabezado.
- [ ] La **M es de cromo**: claro arriba, un horizonte oscuro bien marcado hacia la mitad de la pata y de cada diagonal, un reflejo más claro abajo y un filo blanco especular en el borde de la pata.
- [ ] **Barrido del logo** (en el banner de carga, en bucle; y en el logo plano del inicio, hasta que empieza el 3D): ML **aparece con un barrido y se borra con otro barrido que ARRANCA ANTES de que termine el primero**, y vuelve a empezar: es un solo movimiento seguido, **sin un rato quieto con el logo entero**. Los dos frentes **aceleran** (empiezan suaves y salen rápidos) y el borrado es algo más lento que la aparición (entra con decisión, se deshace con calma). Siguen los trazos del logo **empezando por la estela**: la punta de su diagonal de sombra, la esquina, su pie, la pata de la M, la primera diagonal, la segunda, el palo de la L y su pie hasta la punta. Cuando la punta de la L termina de aparecer, la punta de la estela ya se borró: en ese instante se ve **casi todo el logo (M y L enteras)** y enseguida se deshace en el mismo orden (la estela primero, la punta de la L al final). En el borde de cada barrido el logo brilla (lila en la estela y en la M, celeste claro en la L). Tras borrarse queda un respiro corto con todo apagado. Sin restos de un tramo fuera de su turno (p. ej. la punta del valle de la M o el palo de la L no aparecen antes de tiempo). Con "reducir movimiento" no hay barrido: el logo se ve entero y quieto. En el inicio, tras la última aparición el logo queda entero y no cambia nada al soltar las máscaras (sin saltos ni parpadeo), y la última aparición se hace sobre la marca ya inclinándose, sin desajustes entre la máscara y el dibujo.
- [ ] **Banner de carga**: el círculo de alrededor de ML es **el globo del inicio** girando (ya no el anillo de antes) y ML **aparece y se borra en bucle** (ciclo de 1,9 s: aparece en 0,8 s y se borra en 1 s, el borrado arrancando a los 0,5 s de la aparición, y un respiro corto). Mientras tanto la **estela lleva destellos**: por cada una de sus nueve líneas corre un trazo corto y claro, de la pata a donde se disuelve, cada línea a su ritmo y con descansos, y el polvo del final titila (solo en el banner; en el inicio la estela queda quieta, con su paralaje). **Antes de que llegue el JavaScript el banner ya muestra el logo entero** (con su respiración y los destellos de la estela, que son CSS), no una marca vacía; al arrancar el JavaScript el primer ciclo solo lo **borra** (sin salto a oculto) y después sigue el bucle. Verlo con la red limitada (DevTools → Network → «Slow 3G»): el logo se ve desde el primer pintado, mientras se descargan los scripts; en la primera visita el banner dura al menos 1,7 s **contados desde que empezó la carga** (no desde que arrancó el JavaScript), y si la carga tarda más se retira en cuanto está todo listo, sin sumar otro mínimo. El globo (el círculo de alrededor) sí aparece recién al arrancar el JavaScript.
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
- [ ] "Reducir movimiento" activado: no hay animaciones ni apariciones al hacer scroll, y todo el contenido se ve. El logo queda plano (2D), el banner de carga se retira sin transición y el diagrama aparece completo.
- [ ] Banner de carga: aparece desde el primer pintado **con el logo a la vista** (también en una carga lenta, con la red limitada), la barra avanza y se retira solo cuando todo cargó, sin esperar un mínimo extra después de la descarga; la entrada del inicio se ve después, no detrás del banner. Con JavaScript desactivado no se muestra.
- [ ] Logo: al retirarse el banner **no hay ningún destello** del logo (hay que mirar cuadro a cuadro, grabando la pantalla o con DevTools → Performance, en una carga con la red limitada y en una recarga con caché); el flujo es banner de carga → el logo plano (2D) empieza 1 s después de irse el banner **con el barrido**: aparece con un barrido de la estela a la L y se borra con otro que arranca antes de que el primero termine, **dos veces seguidas** (unos 3,6 s) → al borrarse del todo la segunda vez, **empieza el 3D con la marca oculta** (se ve el globo y los arcos moverse sin el logo) → 1 s después, justo cuando la marca empieza a inclinarse, **el logo aparece una última vez con el barrido, ya en 3D**, y queda entero (al volver al inicio con el banner ya retirado no hay bucles: aparece una sola vez, se queda entero y el 3D empieza a los 2,4 s) → transición lenta al 3D, pieza por pieza (primero gira el globo, luego se despliegan los arcos, se inclina la marca, se voltea el anillo y al final las perlas; unos 5 s en total) sin saltos; pasa por delante y por detrás de la marca; de canto los aros conservan su grosor; en celular no se traba. Los arcos de colores (rosa/violeta y cian) son cometas: cabeza brillante y cola que se afina y se desvanece hasta nada, sin escalones ni costuras visibles a lo largo del trazo.
- [ ] Barra de servicios seleccionados: al marcar un servicio baja desde detrás del menú y queda fija justo debajo de él (no abajo); el contenido no se corre; "Limpiar" la esconde; los saltos a un ancla (p. ej. *Servicios*) no dejan el título tapado por la barra; en celular el texto y los botones caben sin recortarse; el botón de emergencia no se mueve.
- [ ] Diagrama "su negocio": la línea punteada se cierra como un reloj mientras se sube por la página y estalla cuando el diagrama está entero a la vista (no cortado por el borde); al subir de nuevo antes de cerrarse retrocede; llegar desde un enlace ancla igual da la vuelta completa.
- [ ] Lighthouse y axe: contraste (revisar el gris `--dim`), foco y semántica.
- [ ] Scroll y escritura fluidos en un celular de gama media.

## 5. Trazabilidad de una consulta

| Dato | Dónde queda | Para qué sirve |
|---|---|---|
| Referencia `ML-AAMMDD-XXXX` | Título del mensaje y parte superior del relevamiento | Encontrar la conversación en WhatsApp: buscar `ML-` más la fecha o el código |
| Servicios de interés | Encabezado del mensaje | Saber qué áreas pidió |
| Oferta vista | Línea *Consulta* | Registrar el precio por bloque de 10 minutos y la oferta que vio el cliente al pedir |
| Idioma y dominio | Pie del mensaje | Saber qué versión del sitio usó |
| Versión del formulario (`vN`; hoy `v4`) | Pie del mensaje | Interpretar las respuestas si las preguntas o la oferta cambian |
| Origen (`origen: …`) | Pie del mensaje | Medir qué canal trae consultas (tarjeta, enlace, etc.) |

Cuando cambien las preguntas de forma que afecte la lectura de las respuestas, subir `SURVEY_VERSION`.

## 6. Hallazgos de QA de esta iteración

Encontrados por las pruebas nuevas y ya corregidos:

1. **Respuestas obsoletas contaban como completas.** Una opción cuyo id ya no existe en el catálogo pasaba la validación pero el mensaje la omitía, así que el cliente podía enviar sin saber que faltaba un dato crítico. Ahora no cuenta como respondida.
2. **Texto de la vista previa con secciones vacías.** Convertir a texto una lista con pendientes dejaba encabezados sin contenido. El mensaje enviado no se veía afectado, pero la conversión ahora es consistente.
3. **Límite de 600 caracteres en campos de una línea.** Nombre, correo y ciudad admitían lo mismo que un texto largo y empujaban el enlace de WhatsApp hacia el límite. Ahora son 120 (`site.maxLineLength`).
5. **(v4) Al escribir aparecía el «escribiendo…» y se perdían letras.** Desde v4 el recorrido se rearma con cada tecla, y la transición entre preguntas (`useSwap`) comparaba la pregunta por identidad del objeto: cada carácter parecía una pregunta nueva. Ahora la transición es por id de pregunta. Las pruebas no lo veían porque corren con «reducir movimiento»; `chat-ui.test.ts` tiene dos casos con animaciones que escriben letra por letra.
4. **El relevamiento guardado se pisaba en desarrollo** (Strict Mode ejecuta los efectos dos veces). Corregido en la iteración anterior: no se guarda nada hasta terminar de restaurar.

Límite conocido: con los seis servicios y todos los textos al máximo, el enlace supera los 6000 caracteres; la interfaz avisa y el cliente puede acortar o copiar el mensaje.

## 7. Riesgos de la conversación guiada y cómo se cubren

No son defectos hallados en producción sino riesgos previstos al diseñarla; cada uno tiene una prueba que lo fija:

1. **Doble avance con opción única.** Si el cliente cambia de opción durante la pausa de 320 ms, el temporizador de la pregunta se reinicia: avanza una sola vez, con la última elegida (prueba "cambiar de opción durante la pausa").
2. **Navegar durante la salida.** Mientras la pregunta anterior se desvanece, la zona de respuesta queda `inert`, para que no se pueda tocar *Siguiente* sobre una pregunta que ya cambió (prueba de la secuencia de transición).
3. **Saltos adelante.** Con una pregunta por vez, ir a un paso futuro dejaría obligatorias sin responder. La barra de progreso solo permite volver hacia atrás (o a cualquier sección desde la revisión) (`chat-flow.test.ts`).
4. **Estado guardado de otra versión.** El estado guarda `cursor` (la pregunta en curso) y la clave de almacenamiento pasó a `v4` (las respuestas de v3 tienen otros ids); `sanitize` ajusta un cursor fuera de rango, no numérico o ausente (`survey.test.ts`).

Limitaciones conocidas:
- El "escribiendo…" suma unos 550 ms por pregunta (salida 170 ms + indicador 380 ms); en un recorrido de 17 preguntas son unos 9 segundos de espera acumulada. Está en `EXIT_MS` y `TYPING_MS` (`Chat.tsx`) por si resulta lento.
- Al cambiar de idioma a mitad del relevamiento se vuelve a "escribir" la pregunta en curso (el cambio recarga la página).

