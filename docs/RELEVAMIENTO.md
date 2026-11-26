# Relevamiento v5: un diagnóstico, no un pedido técnico

Cómo está armado el formulario desde la versión 5 y por qué. La fuente de verdad es `src/model/catalog.ts`. Las reglas de
este documento se comprueban en `tests/catalog-semantics.test.ts`, en los 5 perfiles y en las 63 combinaciones de
servicios.

## Qué cambió en v5

El cliente consulta porque **no sabe** qué solución técnica necesita, o la tiene muy vaga. Por eso v4 todavía fallaba en
algunas preguntas. «¿Qué necesita?» en Infraestructura ofrecía instalar la red, pasar a la nube o poner un servidor, y
pedía funciones técnicas del software. Así obligaba al cliente a elegir una solución que no puede evaluar, y no le daba
al consultor lo que sí necesita: el contexto.

v5 pregunta lo que el cliente **sí sabe**, aunque no sepa nada de tecnología. La solución la propone el consultor en la
reunión. Cada pregunta nueva responde a una de estas preguntas del consultor:

| Lo que necesita saber el consultor | Pregunta |
|---|---|
| Qué pasa hoy (con las palabras del cliente) | `x_necesidad`, «¿Qué está pasando que lo lleva a consultar?» |
| **Puntos débiles**: qué le cuesta y qué pesa más | `x_impacto` (hasta 3): horas perdidas, errores, falta de información, ventas perdidas, dependencia de una persona, trabajo frenado, riesgo, no alcanza para crecer |
| **Fortalezas**: qué funciona y conviene cuidar | `x_fortalezas` (hasta 3); en un proyecto, `x_avance`: con qué cuenta (idea probada, interesados, equipo, experiencia, financiamiento) |
| Dónde está el problema | `x_areas` (hasta 3, las más urgentes) |
| **Qué ya se intentó** y qué falló (señales de riesgo) | `x_intentos` y, si hubo intento, `x_intentos_falla` |
| A dónde quiere llegar | `x_objetivos`, a 6–12 meses (opcional) |
| **Capacidad propia**: quién sostiene la solución después | `x_responsable`, «¿Quién se ocupa hoy de la tecnología?» |
| **Viabilidad**: tiempo propio y riesgos que ve el cliente | `e_dedicacion` y `e_preocupaciones` (hasta 3) |

Además, cada servicio pasó a hablar en el idioma del cliente:

| Servicio | v4 (pedía una solución) | v5 (pregunta lo que el cliente sabe) |
|---|---|---|
| Infraestructura | `i_necesidad`: red, nube, servidor, copias, seguridad | `i_sintomas` (qué problemas notan, hasta 3), `i_respaldo` («si se rompe la computadora más importante, ¿qué pasa con la información?»), `i_caida` («si se corta todo, ¿cuánto pueden seguir trabajando?») |
| Software | `d_funciones`: permisos, reportes, archivos… | `d_definicion` (¿es una idea o está definido?), `d_funciones` como lo que la gente tiene que poder hacer (las 3 imprescindibles), `d_referencia` (algo parecido que conozca) |
| Gestión | `g_migracion`: qué datos pasar | `g_informacion` (qué tienen registrado) y `g_calidad` (qué tan confiable es) |
| IA | `a_objetivo`: qué haga la IA | Qué tarea quiere sacarse de encima, con «No lo tengo claro: quiero saber qué se puede hacer»; `a_error` (qué tan grave sería que se equivoque) |
| Integraciones | «¿Con qué otras herramientas tendría que conectarse?» | «¿Hay datos que se cargan dos veces o se pasan a mano?» (dónde pasa más, hasta 3) |
| Consultoría | `c_motivo` y `c_entregable` | El motivo se cuenta una vez en el diagnóstico; queda `c_entregable` (qué espera llevarse, con diagnóstico y respuesta a una duda puntual) |

### Antecedente: v4 y los primeros 5 leads

v4 (25/11/2026) pasó de preguntas por servicio a preguntas **por concepto**, después de leer los primeros 5 leads reales:
- dos preguntas abiertas de «problema» seguidas, y la persona repartió la historia a ciegas;
- «Otro» sin detalle;
- reemplazar un sistema trabajando con papel;
- rangos distintos para lo mismo;
- sedes contradictorias entre servicios;
- un correo «nn» sin teléfono;
- relleno en un «dentro de 6 meses» obligatorio;
- `no_of_employees` siempre en 1-10.

Todas esas soluciones siguen vigentes: un solo `x_necesidad`, «¿cuál?» obligatorio, `x_sistema_actual` solo si hay
sistema, los rangos de Frappe, un solo `x_sedes`, el control de formato y el teléfono obligatorio sin correo, los
objetivos opcionales y el tamaño en el campo de Frappe.

## Principios

1. **Diagnóstico antes que solución.** Primero qué pasa, cómo lo afecta, qué funciona, qué intentó y qué quiere lograr.
   Después con qué cuenta hoy. Recién al final lo propio de cada servicio, siempre en lenguaje de negocio.
2. **Priorizar.** En el diagnóstico se elige lo que más pesa (`maxChoices`, «Elija hasta 3»). Al consultor le dice por
   dónde empezar, y además mantiene legible el mensaje.
3. **Un concepto, un id, un lugar.** Lo que necesitan dos servicios o más vive en las secciones comunes. Cada pregunta
   compartida declara para qué servicios se hace y para cuáles es obligatoria (`shared`).
4. **Nada que se pueda deducir.** Si una respuesta anterior ya lo dice, la pregunta no se hace o cambia su texto.
5. **Cualquier perfil.** La primera pregunta es `p_perfil`: empresa, organización, independiente, proyecto o uso
   personal. Lo demás cambia de texto (`variants`) o no se hace (`showIf`).
6. **Opciones de Frappe.** Lo que va a un campo del CRM lleva el valor exacto de Frappe en el catálogo (`crm`).
7. **Las condiciones miran hacia atrás.** Responder cambia lo que sigue y nunca lo que ya pasó. Una respuesta que quedó
   de una pregunta ahora oculta no cuenta para nada y no se envía.

## El recorrido

1. **Su consulta**: `p_perfil` → `p_industria` → `p_descripcion` → `p_tamano`. Un particular solo responde el perfil.
2. **Qué está pasando** (diagnóstico):
   - `x_necesidad`, la situación de hoy;
   - `x_impacto`, o `x_avance` en un proyecto;
   - `x_fortalezas`;
   - `x_areas`;
   - `x_intentos` → `x_intentos_falla`;
   - `x_objetivos`.

   Con Soporte solo, el pedido es concreto (un equipo, una falla): queda únicamente `x_necesidad`. A un particular no se
   le pregunta por su operación.
3. **Cómo trabajan hoy**: `x_herramientas`, `x_sistema_actual`, `x_integraciones`, `x_usuarios_int`, `x_usuarios_ext`,
   `x_sedes`, `x_equipos`, `x_responsable`. Solo se ve lo que necesita alguno de los servicios elegidos.
4. **Un paso por servicio**, solo con lo propio:
   - Consultoría: `c_entregable`.
   - Software: `d_definicion`, `d_funciones`, `d_dispositivos`, `d_referencia`.
   - Gestión: `g_informacion`, `g_calidad`.
   - Infraestructura: `i_sintomas`, `i_respaldo`, `i_caida`.
   - IA: `a_objetivo`, `a_volumen`, `a_datos`, `a_error`.
   - Soporte: `s_tipo`, `s_equipo`, `s_sintoma`, `s_modalidad`.
5. **Alcance y reunión**: `e_alcance`, `e_plazo`, `e_presupuesto`, `e_decisor`, `e_dedicacion`, `e_preocupaciones`,
   `e_horario`, `e_plataforma`.
6. **Datos de contacto**: `p_nombre`, `p_org`, `p_web`, `p_ubicacion`, `p_correo`, `p_telefono`.

Largo:
- IA para una empresa: 30 preguntas, unas 12 obligatorias; el resto se omite con un toque.
- Los seis servicios: 47.
- Una emergencia en uso personal: 9.

## Matriz: qué pregunta usa cada servicio

R = obligatoria para ese servicio · O = se pregunta pero es opcional · — = no se pregunta por ese servicio.

| Concepto | Consultoría | Software | Gestión | Infraestructura | IA | Soporte |
|---|---|---|---|---|---|---|
| `x_necesidad` qué está pasando | R | R | R | R | R | R |
| `x_impacto` / `x_avance` cómo lo afecta / con qué cuenta¹ ² | R | R | R | R | R | — |
| `x_fortalezas` qué funciona bien¹ ² | O | O | O | O | O | — |
| `x_areas` dónde es más urgente¹ | O | O | R | — | — | — |
| `x_intentos` qué intentó antes¹ | R | R | R | R | R | — |
| `x_objetivos` a 6–12 meses¹ | O | O | O | O | O | — |
| `x_herramientas` con qué se organizan hoy | O | R | R | — | O | — |
| `x_sistema_actual` qué hacer con el sistema (solo si hay uno) | — | R | R | — | — | — |
| `x_integraciones` datos cargados dos veces | — | O | O | — | O | — |
| `x_usuarios_int` personas del equipo que lo usarían¹ | — | R | R | — | — | — |
| `x_usuarios_ext` gente de afuera por mes | — | R | O | — | — | — |
| `x_sedes` desde cuántos lugares¹ | — | — | O | R | — | O |
| `x_equipos` cuántos equipos¹ | — | — | — | R | — | O |
| `x_responsable` quién se ocupa de la tecnología¹ | O | R | R | R | O | O |
| `e_dedicacion` tiempo de su lado¹ | — | O | O | — | O | — |
| `e_preocupaciones` qué le preocupa¹ | O | O | O | O | O | — |
| `p_ubicacion` ciudad y país | O | O | O | R | O | R si presencial o indistinto |

¹ No se pregunta en uso personal. ² `x_impacto` y `x_fortalezas` para empresa, organización e independiente; `x_avance`
para un proyecto. Con Soporte solo no hay diagnóstico: va directo a sus preguntas.

Siempre obligatorias: `p_perfil`, `x_necesidad`, `p_nombre` y un medio de contacto (sin `p_correo`, `p_telefono`).
Según el perfil: `p_industria` y `p_descripcion` (todos menos uso personal) y `p_tamano` (empresa, organización y proyecto).

## Pares que se podían deducir uno del otro

| Par | Cómo se evita |
|---|---|
| Lo que pasa hoy y lo que quiere lograr | `x_necesidad` habla de hoy; `x_objetivos`, de 6–12 meses (y su texto no dice «lograr») |
| Motivo de la consultoría y necesidad | El motivo se cuenta una vez, en `x_necesidad`; Consultoría solo pregunta qué espera llevarse |
| Impacto en un proyecto que todavía no opera | `x_avance` (con qué cuenta) reemplaza a `x_impacto` y `x_fortalezas` |
| «Información ordenada» como fortaleza y la calidad de la información | Solo `g_calidad`; las fortalezas no la repiten (tampoco «un sistema que funciona»: es `x_sistema_actual`) |
| Qué no funcionó, sin haberlo intentado | `x_intentos_falla` solo si `x_intentos` dice que hubo un intento |
| Información registrada sin usar nada | `g_informacion` no se pregunta si hoy no usan nada; `g_calidad`, solo si hay algo registrado |
| Frecuencia y gravedad del error sin una tarea de IA | `a_volumen` y `a_error` no se preguntan con «No lo tengo claro» |
| `p_sucursales` y `i_sedes` (v3) | Un solo `x_sedes` |
| Tamaño, usuarios y puestos | Los rangos de Frappe; usuarios del equipo y de afuera por separado; equipos ≠ personas |
| Sistema actual sin tener uno | `x_sistema_actual` solo si marcó un sistema |
| Alcance y tipo de soporte | `e_alcance` no se pregunta con solo Soporte |
| Plazo y emergencia | Con solo Soporte en emergencia no hay cierre; combinada, «además de la emergencia, ¿para cuándo…?» |
| Quién decide, para un independiente o un particular | No se pregunta |
| Funciones del software y áreas o canales | Las funciones no repiten turnos, facturación ni WhatsApp (son `x_areas` y `x_integraciones`) |

## Controles

- **Formato**: correo (el mismo patrón que el servidor), teléfono (8 a 15 dígitos, con o sin «+», con separadores; «00»
  pasa a «+») y web (dominio, con o sin `http(s)://`, o `@usuario`). Un texto opcional con otra forma tampoco deja pasar.
- **Sugerencia de correo** ante un error de tipeo conocido (`gmial.com`, `.con`…): «¿Quiso decir…?».
- **Opciones exclusivas** («Todavía no nos afecta», «Todavía nada», «No lo sé», «No lo tengo claro», «Nada en
  particular»…): desmarcan las demás.
- **Tope de opciones** («Elija hasta 3»): alcanzado el tope, las demás se ven inactivas hasta desmarcar una; la exclusiva
  siempre se puede elegir. Al sanear el estado guardado y en el servidor se conservan las primeras.
- **Topes de texto**: necesidad 500, objetivos 250, descripción 160, referencia 100, web 100, ciudad 80, teléfono 25,
  «¿cuál?» 80.
- **Rótulos cortos** en el mensaje y la vista previa («Impacto», «Fortalezas», «Intentos anteriores»…). Se lee de un
  vistazo, y el peor caso de cada servicio queda por debajo del largo seguro del enlace de WhatsApp en los tres idiomas
  (`tests/qa-flow.test.ts`). La nota del CRM usa la pregunta completa.
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
| `p_perfil` | `landing_profile` (con filtro en la lista) |
| `p_ubicacion` | `landing_location` |
| zona horaria | `landing_timezone` |
| `e_plazo`, `e_presupuesto`, `s_tipo` | `lead_temperature`, solo al crear: Hot si es una emergencia o si es «ya o en semanas» con presupuesto; Cold si «Estoy explorando»; Warm en el resto |

El diagnóstico (impacto, fortalezas, intentos, objetivos, preocupaciones) va completo a la nota del lead, con el texto
de cada pregunta.

En un envío siguiente de la misma persona en la misma visita se aplican las correcciones de estos campos, salvo en uno
que Mariano haya editado; el 1-10 que Frappe pone solo no cuenta como edición. La nota suma el perfil y la zona horaria
en el encabezado. También agrega un bloque **Revisar**, calculado sin IA:

- sin correo ni teléfono válidos;
- más usuarios del equipo que personas en la organización;
- diferencias de perfil con el lead relacionado (otra visita de la misma persona).

## Cómo se cambia una pregunta

1. Editar `src/model/catalog.ts`. Si cambia el sentido de una respuesta, subir `SURVEY_VERSION` (`src/model/message.ts`)
   y la clave de `sessionStorage` (`src/controller/resume.ts`).
2. Correr las pruebas afectadas, de a una, por ejemplo `npx vitest run tests/catalog-semantics.test.ts`. La semántica
   dice si algo quedó repetido, sin cubrir o mirando hacia adelante. `qa-flow.test.ts` dice si el mensaje se pasa de
   largo.
3. Exportar el catálogo:
   ```
   node scripts/export-catalog.mjs <landing_crm>/landing_crm/data/catalog.json <landing_crm>/landing_crm/tests/catalog_cases.json
   ```
   Antes, la versión anterior pasa a `data/catalog.v<N>.json` mientras haya pestañas abiertas con ella. Hoy se aceptan
   v3, v4 y v5.
4. Correr las pruebas del servidor (`scripts/run-site-tests.py` desde `frappe-bench/sites`). La de paridad compara los
   330 casos.
5. Desplegar primero el servidor y después el front.
