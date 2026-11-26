/* Exporta el catálogo del relevamiento a un JSON para que el servidor (app `landing_crm` de Frappe) valide lo que recibe.
 * Lleva solo lo que el servidor necesita: ids, tipos, obligatoriedad, condiciones, ids de opciones (con su valor de Frappe
 * CRM y si son exclusivas), formatos, topes de largo y de opciones, la versión del formulario y los textos en español (con
 * sus variantes) para armar la nota legible del CRM. La fuente de verdad sigue siendo src/model/catalog.ts.
 *
 * Uso:  node scripts/export-catalog.mjs <catalog.json> [<catalog_cases.json>]
 * El segundo archivo, opcional, son casos calculados por el front (perfil × servicios × respuestas → preguntas visibles,
 * obligatorias y textos): las pruebas del servidor comprueban que su copia de la lógica (`intake/conditions.py`) calcule
 * exactamente lo mismo.
 *
 * Hay que volver a correrlo, y copiar el resultado a `landing_crm/data/catalog.json` (y los casos a
 * `landing_crm/tests/catalog_cases.json`) ANTES de desplegar el front, cada vez que cambian las preguntas o
 * `SURVEY_VERSION`: el servidor rechaza las versiones del formulario que no conoce. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [output, casesOutput] = process.argv.slice(2);
if (!output) {
  console.error('Uso: node scripts/export-catalog.mjs <catalog.json> [<catalog_cases.json>]');
  process.exit(2);
}

const server = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src') } },
});

function write(path, data) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), `${JSON.stringify(data, null, 2)}\n`);
}

try {
  const [catalog, message, types, config] = await Promise.all([
    server.ssrLoadModule('/src/model/catalog.ts'),
    server.ssrLoadModule('/src/model/message.ts'),
    server.ssrLoadModule('/src/model/types.ts'),
    server.ssrLoadModule('/src/config/site.ts'),
  ]);
  const { SERVICES, SECTIONS_BEFORE_SERVICES, SECTIONS_AFTER_SERVICES, serviceToSection, buildSections, allQuestions } = catalog;

  const option = (opt) => ({
    id: opt.id,
    label: opt.label.es,
    ...(opt.exclusive ? { exclusive: true } : {}),
    ...(opt.crm ? { crm: opt.crm } : {}),
  });
  const question = (q) => ({
    id: q.id,
    type: q.type,
    // `true`, `false` o una condición (misma forma que en el front).
    required: typeof q.required === 'object' ? q.required : Boolean(q.required),
    label: q.label.es,
    ...(q.showIf ? { show_if: q.showIf } : {}),
    ...(q.variants?.some((v) => v.label) ? { variants: q.variants.filter((v) => v.label).map((v) => ({ when: v.when, label: v.label.es })) } : {}),
    ...(q.format ? { format: q.format } : {}),
    ...(q.maxLength ? { max_length: q.maxLength } : {}),
    ...(q.maxChoices ? { max_choices: q.maxChoices } : {}),
    ...(q.options ? { options: q.options.map(option) } : {}),
  });
  const section = (s) => ({ title: s.title.es, questions: s.questions.map(question) });

  const common = [...SECTIONS_BEFORE_SERVICES, ...SECTIONS_AFTER_SERVICES];
  const sections = {};
  for (const s of common) sections[s.id] = section(s);
  for (const svc of SERVICES) sections[serviceToSection(svc).id] = section(serviceToSection(svc));

  const data = {
    survey_version: message.SURVEY_VERSION,
    locales: [...types.LOCALES],
    limits: { line: config.site.maxLineLength, text: config.site.maxTextLength },
    // Recorrido: estas secciones, luego una por servicio elegido (en orden del catálogo), luego estas otras.
    sections_before_services: SECTIONS_BEFORE_SERVICES.map((s) => s.id),
    sections_after_services: SECTIONS_AFTER_SERVICES.map((s) => s.id),
    services: SERVICES.map((svc) => ({ id: svc.id, title: svc.title.es, section: serviceToSection(svc).id })),
    sections,
  };
  write(output, data);
  const questions = Object.values(sections).reduce((n, s) => n + s.questions.length, 0);
  console.log(`Catálogo v${data.survey_version}: ${data.services.length} servicios, ${questions} preguntas → ${resolve(output)}`);

  if (casesOutput) {
    // Cada servicio solo, todos los pares y los seis juntos; para cada perfil; con respuestas que activan (A) o
    // desactivan (B) las condiciones, y con respuestas que quedaron de preguntas ahora ocultas (C). Cubren el diagnóstico
    // (impacto, intentos previos y su «qué falló»), la información registrada, la IA sin tarea clara y Soporte.
    const ids = SERVICES.map((s) => s.id);
    const combos = [...ids.map((id) => [id]), ...ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b])), ids];
    const profiles = catalog.INQUIRY_SECTION.questions[0].options.map((opt) => opt.id);
    const answerSets = {
      A: {
        x_impacto: ['tiempo'], x_intentos: 'proveedor', x_intentos_falla: ['otro'], x_herramientas: ['propio'], c_entregable: ['plan'],
        g_informacion: ['clientes'], a_objetivo: ['documentos'], s_tipo: 'emergencia', s_modalidad: 'presencial', s_equipo: ['pc'],
        x_integraciones: ['mensajeria'], d_funciones: ['reportes'], p_correo: '',
      },
      B: {
        x_impacto: ['otro'], x_intentos: 'no', x_herramientas: ['nada'], c_entregable: ['otro'], i_sintomas: ['otro'], a_objetivo: ['explorar'],
        s_tipo: 'puntual', s_modalidad: 'remota', s_equipo: ['otro'], x_integraciones: ['otro'], d_funciones: ['otro'], p_correo: 'a@b.com',
      },
      C: {
        p_tamano: '11-50', x_intentos: 'no', x_intentos_falla: ['otro'], x_intentos_falla_otro: 'queda de antes', x_herramientas: ['comercial'],
        x_sistema_actual: 'mejorar', g_informacion: ['nada'], g_calidad: 'ordenada', s_tipo: 'periodico', s_sintoma: 'queda de antes',
        s_modalidad: 'indistinto', p_telefono: '+5491112345678',
      },
    };
    const cases = [];
    for (const services of combos) {
      for (const profile of profiles) {
        for (const [name, extra] of Object.entries(answerSets)) {
          const answers = { p_perfil: profile, ...extra };
          const resolved = buildSections(services, answers).flatMap((s) => s.questions);
          const base = Object.fromEntries(allQuestions(services).map((q) => [q.id, q.label.es]));
          // Compacto: las respuestas son `p_perfil` = profile más el juego `answers_set`; las listas van separadas por espacios.
          cases.push({
            services,
            profile,
            answers_set: name,
            visible: resolved.map((q) => q.id).join(' '),
            required: resolved.filter((q) => q.required === true).map((q) => q.id).join(' '),
            labels: Object.fromEntries(resolved.filter((q) => q.label.es !== base[q.id]).map((q) => [q.id, q.label.es])),
          });
        }
      }
    }
    // Un caso por línea: liviano y con diferencias legibles cuando cambia el catálogo.
    mkdirSync(dirname(resolve(casesOutput)), { recursive: true });
    const body = cases.map((c) => `    ${JSON.stringify(c)}`).join(',\n');
    writeFileSync(
      resolve(casesOutput),
      `{\n  "survey_version": ${message.SURVEY_VERSION},\n  "answers_sets": ${JSON.stringify(answerSets)},\n  "cases": [\n${body}\n  ]\n}\n`,
    );
    console.log(`${cases.length} casos de paridad → ${resolve(casesOutput)}`);
  }
} finally {
  await server.close();
}
