/* Exporta el catálogo del relevamiento a un JSON para que el servidor (app `landing_crm` de Frappe) valide lo que recibe.
 * Lleva solo lo que el servidor necesita: ids, tipos, obligatoriedad, ids de opciones, topes de largo, la versión del
 * formulario y los textos en español (para armar la nota legible del CRM). La fuente de verdad sigue siendo src/model/catalog.ts.
 *
 * Uso:  node scripts/export-catalog.mjs <salida.json>
 * Hay que volver a correrlo, y copiar el resultado a `landing_crm/data/catalog.json` ANTES de desplegar el front, cada vez
 * que cambian las preguntas o `SURVEY_VERSION`: el servidor rechaza las versiones del formulario que no conoce. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2];
if (!output) {
  console.error('Uso: node scripts/export-catalog.mjs <salida.json>');
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

try {
  const [catalog, message, types, config] = await Promise.all([
    server.ssrLoadModule('/src/model/catalog.ts'),
    server.ssrLoadModule('/src/model/message.ts'),
    server.ssrLoadModule('/src/model/types.ts'),
    server.ssrLoadModule('/src/config/site.ts'),
  ]);
  const { SERVICES, ACTIVITY_SECTION, CLOSING_SECTION, CONTACT_SECTION, serviceToSection } = catalog;

  const question = (q) => ({
    id: q.id,
    type: q.type,
    required: Boolean(q.required),
    label: q.label.es,
    ...(q.options ? { options: q.options.map((opt) => ({ id: opt.id, label: opt.label.es })) } : {}),
  });
  const section = (s) => ({ title: s.title.es, questions: s.questions.map(question) });

  const sections = {};
  for (const s of [ACTIVITY_SECTION, CLOSING_SECTION, CONTACT_SECTION]) sections[s.id] = section(s);
  for (const svc of SERVICES) sections[serviceToSection(svc).id] = section(serviceToSection(svc));

  const data = {
    survey_version: message.SURVEY_VERSION,
    locales: [...types.LOCALES],
    limits: { line: config.site.maxLineLength, text: config.site.maxTextLength },
    // Secciones que siempre forman parte del recorrido; las de servicios se suman según lo elegido.
    common_sections: [ACTIVITY_SECTION.id, CLOSING_SECTION.id, CONTACT_SECTION.id],
    services: SERVICES.map((svc) => ({ id: svc.id, title: svc.title.es, section: serviceToSection(svc).id })),
    sections,
  };

  mkdirSync(dirname(resolve(output)), { recursive: true });
  writeFileSync(resolve(output), `${JSON.stringify(data, null, 2)}\n`);
  const questions = Object.values(sections).reduce((n, s) => n + s.questions.length, 0);
  console.log(`Catálogo v${data.survey_version}: ${data.services.length} servicios, ${questions} preguntas → ${resolve(output)}`);
} finally {
  await server.close();
}
