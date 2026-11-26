# Relevamiento v4: preguntas por concepto

Cómo está armado el formulario desde la versión 4 y por qué. La fuente de verdad es `src/model/catalog.ts`. Las reglas de
este documento están comprobadas en `tests/catalog-semantics.test.ts`, en los 5 perfiles y en las 63 combinaciones de
servicios.

## Por qué cambió

En la versión 3 cada servicio traía sus propias preguntas. Con varios servicios elegidos, el mismo dato se pedía dos
veces, con otra redacción y otros rangos. Además, el primer paso suponía que siempre había una empresa. Los primeros 5
leads reales (25/11/2026, de prueba pero respondidos por personas) lo mostraron:

| Respuesta en el CRM | Qué revela | Cómo se resolvió |
|---|---|---|
| Consultoría + Software: «test dev» en la situación de consultoría y «test org» en el problema del software | Ante dos preguntas abiertas de «problema» seguidas, la persona repartió la historia a ciegas | Una sola pregunta abierta de necesidad (`x_necesidad`). La descripción de la entidad va aparte (`p_descripcion`), y la ayuda aclara que la necesidad se pregunta después |
| «Otro» marcado en el motivo, sin detalle | «Otro» no dice nada | Toda opción «Otro» abre «¿cuál?», obligatoria |
| «cuantos» en «qué decisión necesita tomar» | La pregunta abierta no se entendía | `c_entregable`, de opciones (viabilidad, costos y plazos, tecnología, plan…) |
| «Reemplazar un sistema existente» trabajando con papel y WhatsApp | Contradicción entre servicios | `x_sistema_actual` solo aparece si marcó un sistema en `x_herramientas` |
| Organización de 2 a 10 personas y 6 a 20 usuarios | Rangos distintos en cada pregunta; además, puede contar visitantes web | Mismos rangos en todo el formulario (los de Frappe), y usuarios del equipo separados de los de afuera |
| «Solo yo» de tamaño y «Infraestructura: 21 a 50 puestos, más de 3 sedes» | El mismo concepto preguntado dos veces dio respuestas opuestas | Las sedes se preguntan una sola vez (`x_sedes`); los equipos se cuentan aparte de las personas (`x_equipos`) |
| Correo «nn» y sin teléfono | Un lead sin forma de contactarlo | Se valida el formato; teléfono nuevo, obligatorio si no hay correo |
| «no hay» en ciudad y país | No aplica a un proyecto online | Es para el horario; obligatoria solo si hay trabajo en el lugar; la zona horaria se envía sola |
| «si» en «¿Hay herramientas que deban conectarse?» | Una pregunta de sí o no en un campo de texto | `x_integraciones`, de opciones |
| «objetivos a largo plazo», «no se», «no se» en «dentro de 6 meses» | Una pregunta abierta y obligatoria junta relleno | `e_alcance` (opciones, incluye «Todavía no lo sé») + `e_objetivos` opcional, a 6–12 meses |
| La misma persona da otro rubro y otro tamaño en otra visita | Perfil contradictorio entre leads | La nota del lead nuevo lista las diferencias con el relacionado |
| `no_of_employees` = 1-10 en los 5 leads | Nadie lo cargaba: Frappe pone su primera opción | `p_tamano` usa las opciones de Frappe y se escribe en el campo |

## Principios

1. **Un concepto, un id, un lugar.** Lo que necesitan dos servicios o más vive en *Situación actual* (`CONTEXT_SECTION`),
   antes de los servicios. Cada pregunta compartida declara para qué servicios se hace y para cuáles es obligatoria
   (`shared`). Cada servicio trae solo lo propio.
2. **Cobertura.** Cada servicio tiene sus datos críticos (la matriz de abajo). Ninguno falta, se elija el servicio solo o
   combinado.
3. **Nada que se pueda deducir.** Si una respuesta anterior ya lo dice, la pregunta no se hace o cambia su texto.
4. **Cualquier perfil.** La primera pregunta es `p_perfil`: empresa, organización, independiente, proyecto o uso
   personal. Lo demás cambia de texto (`variants`) o no se hace (`showIf`).
5. **Opciones de Frappe.** Lo que va a un campo del CRM lleva el valor exacto de Frappe en el catálogo (`crm`).
6. **Las condiciones miran hacia atrás.** Responder cambia lo que sigue y nunca lo que ya pasó, así que el cursor no se
   mueve. Una respuesta que quedó de una pregunta ahora oculta no cuenta para nada y no se envía.

## El recorrido

1. **Su consulta**: `p_perfil` → `p_industria` → `p_descripcion` → `p_tamano` → `x_necesidad`. Un particular solo
   responde el perfil y la necesidad.
2. **Situación actual** (compartida): `x_herramientas`, `x_sistema_actual`, `x_areas`, `x_integraciones`,
   `x_usuarios_int`, `x_usuarios_ext`, `x_sedes`, `x_equipos`. Solo se ve lo que necesita alguno de los servicios
   elegidos; si no queda ninguna, la sección no aparece.
3. **Un paso por servicio**, solo con lo propio:
   - Consultoría: `c_motivo`, `c_entregable`.
   - Software: `d_funciones`, `d_dispositivos`.
   - Gestión: `g_migracion`.
   - Infraestructura: `i_necesidad`.
   - IA: `a_objetivo`, `a_volumen`, `a_datos`.
   - Soporte: `s_tipo`, `s_equipo`, `s_sintoma`, `s_modalidad`.
4. **Objetivos y reunión**: `e_alcance`, `e_objetivos`, `e_plazo`, `e_presupuesto`, `e_decisor`, `e_horario`,
   `e_plataforma`.
5. **Datos de contacto**: `p_nombre`, `p_org`, `p_web`, `p_ubicacion`, `p_correo`, `p_telefono`.

Largo: con los seis servicios, 37 a 39 preguntas (en v3 eran 38, y cubría menos). Una emergencia en uso personal son 9.

## Matriz: qué pregunta usa cada servicio

R = obligatoria para ese servicio · O = se pregunta pero es opcional · — = no se pregunta por ese servicio.

| Concepto | Consultoría | Software | Gestión | Infraestructura | IA | Soporte |
|---|---|---|---|---|---|---|
| `x_necesidad` qué necesita | R | R | R | R | R | R |
| `x_herramientas` con qué se organizan hoy | O | R | R | — | O | — |
| `x_sistema_actual` qué hacer con el sistema (solo si hay uno) | — | R | R | — | — | — |
| `x_areas` áreas que abarca | — | O | R | — | — | — |
| `x_integraciones` con qué otras herramientas se conecta | — | O | O | — | O | — |
| `x_usuarios_int` personas del equipo que lo usarían¹ | — | R | R | — | — | — |
| `x_usuarios_ext` gente de afuera por mes | — | R | O | — | — | — |
| `x_sedes` desde cuántos lugares¹ | — | — | O | R | — | O |
| `x_equipos` cuántos equipos¹ | — | — | — | R | — | O |
| `p_ubicacion` ciudad y país | O | O | O | R | O | R si presencial o indistinto |

¹ No se pregunta en uso personal.

Siempre obligatorias: `p_perfil`, `x_necesidad`, `p_nombre` y un medio de contacto (sin `p_correo`, `p_telefono`).
Según el perfil: `p_industria` y `p_descripcion` (todos menos uso personal) y `p_tamano` (empresa, organización y proyecto).

## Pares que se podían deducir uno del otro

| Antes (v3) | Ahora |
|---|---|
| `p_sucursales` y `i_sedes` | Un solo `x_sedes`, con «Ninguno fijo: trabajamos a distancia» |
| Tamaño, usuarios y puestos con rangos distintos | Los rangos de Frappe en los tres; usuarios del equipo y de afuera por separado; equipos ≠ personas |
| `c_situacion`, `d_problema`, `g_actual`, `i_problemas`, `a_tarea`, `s_sintoma` | Un solo `x_necesidad`. `s_sintoma` queda solo si Soporte va combinado con otro servicio y algo está roto |
| `p_rubro` (texto) y las preguntas de problema | Rubro de opciones (`p_industria`) + descripción de la entidad, separada de la necesidad |
| `c_herramientas`, `g_actual` y `g_conectar` | `x_herramientas` (qué usan hoy) ≠ `x_integraciones` (otras herramientas, sin planillas) ≠ `x_sistema_actual` (qué hacer con el sistema) |
| `d_tipo` «reemplazar uno existente» | `x_sistema_actual`, solo si hay un sistema |
| `c_motivo` «duda puntual» y lo que se lleva | `c_entregable` no se pregunta si el motivo es solo una duda |
| Migrar datos sin tener nada | `g_migracion` no se pregunta si hoy no usan nada |
| `a_objetivo` «qué le gustaría lograr» y `e_resultado` | `a_objetivo` es «qué haga la IA»; los objetivos van solo en el cierre |
| Alcance y tipo de soporte (puntual o mantenimiento) | `e_alcance` no se pregunta con solo Soporte |
| Plazo y emergencia | Con solo Soporte en emergencia no hay cierre; combinada, «además de la emergencia, ¿para cuándo…?» |
| Quién decide, para un independiente o un particular | No se pregunta |
| Pagos y avisos por WhatsApp en funciones y en integraciones; turnos en funciones y en áreas | Pagos y WhatsApp solo en `x_integraciones`; turnos solo en `x_areas` |

## Controles

- **Formato**: correo (el mismo patrón que el servidor), teléfono (8 a 15 dígitos, con o sin «+», con separadores; «00»
  pasa a «+») y web (dominio, con o sin `http(s)://`, o `@usuario`). Un texto opcional con otra forma tampoco deja pasar.
- **Sugerencia de correo** ante un error de tipeo conocido (`gmial.com`, `.con`…): «¿Quiso decir…?».
- **Opciones exclusivas** («Todavía nada», «No lo sé», «Con ninguna», «Nada: empezamos de cero»): desmarcan las demás.
- **Topes propios**: descripción 160, objetivos 400, web 100, ciudad 80, teléfono 25, «¿cuál?» 80. Son el tamaño de
  cada dato, y además mantienen el peor caso de un servicio por debajo del largo seguro del enlace de WhatsApp.
- **Zona horaria** del navegador, enviada sola: la franja «Mañana» se lee en el horario del cliente.

## Lo que recibe Frappe CRM

| Pregunta | Campo del `CRM Lead` |
|---|---|
| `p_nombre` | `first_name` |
| `p_correo` | `email` (solo si es válido; si no, va a la nota) |
| `p_telefono` | `mobile_no`, sin separadores (`+5491112345678`; si no es válido, va a la nota) |
| `p_org` | `organization` |
| `p_web` | `website`, solo una dirección http(s) (`https://` si no lo trae); un `@usuario` va a la nota |
| `p_descripcion` | `company_description` |
| `p_industria` | `industry`, el nombre de la `CRM Industry` (solo si existe) |
| `p_tamano` | `no_of_employees`, mismas opciones. Independiente → 1-10. Uso personal → vacío (no el 1-10 que Frappe pondría) |
| `p_perfil` | `landing_profile` (nuevo, con filtro en la lista) |
| `p_ubicacion` | `landing_location` |
| zona horaria | `landing_timezone` (nuevo) |
| `e_plazo`, `e_presupuesto`, `s_tipo` | `lead_temperature`, solo al crear: Hot si es una emergencia o si es «ya o en semanas» con presupuesto; Cold si «Estoy explorando»; Warm en el resto |

En un envío siguiente de la misma persona en la misma visita se aplican las correcciones de estos campos, salvo en uno
que Mariano haya editado; el 1-10 que Frappe pone solo no cuenta como edición. La nota del lead suma el perfil y la zona
horaria en el encabezado. También agrega un bloque **Revisar**, calculado sin IA:

- sin correo ni teléfono válidos;
- más usuarios del equipo que personas en la organización;
- diferencias de perfil con el lead relacionado (otra visita de la misma persona).

## Cómo se cambia una pregunta

1. Editar `src/model/catalog.ts`. Si cambia el sentido de una respuesta, subir `SURVEY_VERSION` (`src/model/message.ts`)
   y la clave de `sessionStorage` (`src/controller/resume.ts`).
2. `npx vitest run`: la semántica (`catalog-semantics.test.ts`) dice si algo quedó repetido, sin cubrir o mirando hacia
   adelante.
3. `node scripts/export-catalog.mjs <landing_crm>/landing_crm/data/catalog.json <landing_crm>/landing_crm/tests/catalog_cases.json`.
   Antes, la versión anterior pasa a `data/catalog.v<N>.json` mientras haya pestañas abiertas con ella.
4. Pruebas del servidor (`scripts/run-site-tests.py` desde `frappe-bench/sites`): la de paridad compara los 330 casos.
5. Desplegar primero el servidor y después el front.
