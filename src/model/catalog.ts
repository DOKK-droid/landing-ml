/* ============================================================
 * MODELO — Catálogo de servicios y preguntas del relevamiento (v5).
 * Agregar o editar un servicio/pregunta = editar este archivo. Lenguaje de stakeholder: sin tecnicismos.
 *
 * Cómo está pensado (detalle y matriz en docs/RELEVAMIENTO.md):
 *   · Es un diagnóstico, no un pedido técnico. El cliente consulta porque no sabe qué solución necesita: se le pregunta
 *     lo que sí sabe (qué pasa, cómo lo afecta, qué funciona, qué intentó, qué quiere lograr, con qué cuenta) y la
 *     solución la propone el consultor. Nada de «¿qué red necesita?» ni «¿qué funciones técnicas?».
 *   · Orden: quién consulta → qué está pasando (`DIAGNOSIS_SECTION`) → cómo trabajan hoy (`CONTEXT_SECTION`) → lo propio
 *     de cada servicio → alcance y viabilidad → contacto.
 *   · Un concepto, un id, un lugar. Lo que necesitan dos servicios o más está en las secciones comunes y dice para qué
 *     servicios se pregunta y para cuáles es obligatorio (`shared`). Nada se pregunta dos veces ni se deduce de otra respuesta.
 *   · Sirve para cualquier perfil (empresa, organización, independiente, proyecto, uso personal): la primera pregunta es
 *     `p_perfil` y las demás cambian de texto (`variants`) o no se hacen (`showIf`) según la respuesta.
 *   · Las preguntas de diagnóstico piden lo que MÁS pesa (`maxChoices`): obliga a priorizar y deja un mensaje legible.
 *   · Las opciones que van a un campo de Frappe CRM llevan su valor exacto en `crm` (tamaño, rubro, perfil).
 *   · Una condición solo mira preguntas anteriores; `buildSections` resuelve todo en orden.
 * ============================================================ */
import { evaluate, type ConditionContext } from './conditions';
import type { Answers, Condition, L10n, Option, Question, Section, Service, ServiceId } from './types';

const o = (id: string, es: string, pt: string, en: string, extra: Partial<Option> = {}): Option => ({ id, label: { es, pt, en }, ...extra });
const t = (es: string, pt: string, en: string): L10n => ({ es, pt, en });

const OTHER = o('otro', 'Otro', 'Outro', 'Other');
const DONT_KNOW = o('nose', 'No lo sé', 'Não sei', "I don't know");
/** «No lo sé» en una pregunta de varias respuestas: no se combina con otras. */
const DONT_KNOW_ALONE: Option = { ...DONT_KNOW, exclusive: true };
const SOMETHING_ELSE = t('Otra cosa: ¿cuál?', 'Outra coisa: qual?', 'Something else: what is it?');

/* ---------------------------- Condiciones de uso frecuente ---------------------------- */

export const PROFILE_QUESTION = 'p_perfil';
const is = (answer: string, ...values: string[]): Condition => ({ answer, in: values });
const profileIs = (...profiles: string[]): Condition => is(PROFILE_QUESTION, ...profiles);
const NOT_PERSONAL: Condition = { not: profileIs('personal') };
/** Algo que ya funciona: empresa, organización o independiente (un proyecto nuevo todavía no opera). */
const OPERATING: Condition = profileIs('empresa', 'organizacion', 'independiente');
const ONLY_SUPPORT: Condition = { onlyServices: ['soporte'] };
/** Hay algo que diagnosticar: no es solo un pedido de soporte técnico (eso se resuelve con sus propias preguntas). */
const DIAGNOSIS: Condition = { not: ONLY_SUPPORT };
/** Solo eligió Soporte y es una emergencia: no hay reunión que preparar, se atiende por WhatsApp. */
const SUPPORT_EMERGENCY_ONLY: Condition = { all: [ONLY_SUPPORT, is('s_tipo', 'emergencia')] };

/**
 * Pregunta compartida entre servicios: se hace si eligió alguno de `services` (y se cumple `showIf`), y es obligatoria si
 * eligió alguno de `requiredFor`. Vive en una sola sección, así que nunca se repite.
 */
function shared(question: Question, rule: { services: ServiceId[]; requiredFor?: ServiceId[]; showIf?: Condition }): Question {
  const chosen: Condition = { services: rule.services };
  return {
    ...question,
    showIf: rule.showIf ? { all: [chosen, rule.showIf] } : chosen,
    required: rule.requiredFor?.length ? { services: rule.requiredFor } : false,
  };
}

/** Tope de «¿cuál?»: un nombre o unas palabras. Mantiene el peor caso de un servicio dentro del largo seguro del enlace. */
const OTHER_MAX_LENGTH = 80;

/** La pregunta y, justo después, «¿cuál?» para quien elige «Otro» (obligatoria: un «Otro» sin detalle no dice nada). */
function withOther(question: Question, label: L10n): Question[] {
  return [
    question,
    { id: `${question.id}_otro`, type: 'text', required: true, showIf: is(question.id, OTHER.id), maxLength: OTHER_MAX_LENGTH, label },
  ];
}

/* ---------------------------- Rangos (los de Frappe CRM) ---------------------------- */

/** Las opciones de `CRM Lead.no_of_employees`, en el mismo orden. Se usan para todo lo que cuenta personas. */
export const FRAPPE_EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;

const PEOPLE_RANGES: Option[] = [
  o('1-10', '1 a 10', '1 a 10', '1 to 10'),
  o('11-50', '11 a 50', '11 a 50', '11 to 50'),
  o('51-200', '51 a 200', '51 a 200', '51 to 200'),
  o('201-500', '201 a 500', '201 a 500', '201 to 500'),
  o('501-1000', '501 a 1000', '501 a 1000', '501 to 1000'),
  o('1000+', 'Más de 1000', 'Mais de 1000', 'More than 1000'),
];

/* ---------------------------- Servicios ---------------------------- */

export const SERVICES: Service[] = [
  {
    id: 'consultoria',
    color: '#2fe6ff',
    short: t('Consultoría', 'Consultoria', 'Consulting'),
    tagline: t('Asesoría tecnológica, de una consulta a un proyecto', 'Assessoria tecnológica, de uma consulta a um projeto', 'Technology advice, from a quick question to a project'),
    title: t('Consultoría & Gestión', 'Consultoria & Gestão', 'Consulting & Management'),
    summary: t(
      'Asesoría tecnológica para empresas y para proyectos individuales: desde una consulta puntual sobre sistemas, integraciones o inteligencia artificial hasta el diagnóstico de una operación o la evaluación de una inversión antes de realizarla.',
      'Assessoria tecnológica para empresas e para projetos individuais: desde uma consulta pontual sobre sistemas, integrações ou inteligência artificial até o diagnóstico de uma operação ou a avaliação de um investimento antes de realizá-lo.',
      'Technology advice for companies and for individual projects: from a one-off question about systems, integrations or artificial intelligence to the diagnosis of an operation or the assessment of an investment before it is made.',
    ),
    includes: [
      t('Consultas puntuales sobre sistemas, integraciones o inteligencia artificial', 'Consultas pontuais sobre sistemas, integrações ou inteligência artificial', 'One-off questions on systems, integrations or artificial intelligence'),
      t('Diagnóstico de procesos y puntos de pérdida', 'Diagnóstico de processos e pontos de perda', 'Process diagnosis and loss points'),
      t('Estudio de viabilidad y retorno', 'Estudo de viabilidade e retorno', 'Feasibility and return study'),
      t('Auditoría de sistemas e información existentes', 'Auditoria de sistemas e informações existentes', 'Audit of existing systems and information'),
      t('Plan de automatización por prioridades', 'Plano de automação por prioridades', 'Prioritized automation plan'),
    ],
    needs: t(
      'Para preparar la reunión es útil conocer qué está pasando, cómo lo afecta y qué espera llevarse de la consultoría. No hace falta saber de tecnología.',
      'Para preparar a reunião, ajuda saber o que está acontecendo, como isso afeta você e o que espera levar da consultoria. Não é preciso entender de tecnologia.',
      'To prepare the meeting, it helps to know what is going on, how it affects you and what you hope to get from the consultation. No technical knowledge needed.',
    ),
    stepIntro: t(
      'Para preparar la reunión: qué espera llevarse.',
      'Para preparar a reunião: o que espera levar.',
      'To prepare the meeting: what you hope to get out of it.',
    ),
    questions: [
      ...withOther(
        {
          // El motivo ya lo contó en el diagnóstico (`x_necesidad`, `x_impacto`): acá solo qué resultado espera.
          id: 'c_entregable', type: 'multi', required: true,
          short: t('Qué espera llevarse', 'O que espera levar', 'Expected outcome'),
          label: t('¿Qué le gustaría llevarse de la consultoría?', 'O que gostaria de levar da consultoria?', 'What would you like to get out of the consultation?'),
          options: [
            o('diagnostico', 'Entender qué está fallando y por qué', 'Entender o que está falhando e por quê', "Understand what's going wrong and why"),
            o('viabilidad', 'Saber si lo que tengo en mente es viable y conviene', 'Saber se o que tenho em mente é viável e vale a pena', 'Find out whether what I have in mind is feasible and worth it'),
            o('costos', 'Una estimación de costos y plazos', 'Uma estimativa de custos e prazos', 'An estimate of cost and timeline'),
            o('recomendacion', 'Una recomendación de qué herramientas o tecnología usar', 'Uma recomendação de quais ferramentas ou tecnologia usar', 'A recommendation on which tools or technology to use'),
            o('plan', 'Un plan con prioridades: por dónde empezar', 'Um plano com prioridades: por onde começar', 'A prioritized plan: where to start'),
            o('revisar', 'Una segunda opinión sobre una propuesta o un sistema', 'Uma segunda opinião sobre uma proposta ou um sistema', 'A second opinion on a proposal or a system'),
            o('duda', 'La respuesta a una duda puntual', 'A resposta a uma dúvida pontual', 'An answer to a specific question'),
            OTHER,
          ],
        },
        t('Otro resultado: ¿cuál?', 'Outro resultado: qual?', 'Other outcome: what is it?'),
      ),
    ],
  },
  {
    id: 'desarrollo',
    color: '#9d86ff',
    short: t('Software', 'Software', 'Software'),
    tagline: t('Sistemas a medida de su forma de trabajar', 'Sistemas sob medida para o seu jeito de trabalhar', 'Systems built around the way you work'),
    title: t('Desarrollo de Software', 'Desenvolvimento de Software', 'Software Development'),
    summary: t(
      'Diseño y desarrollo de un sistema a la medida de su forma de trabajar, con la información ordenada y controles de calidad en cada etapa.',
      'Projeto e desenvolvimento de um sistema sob medida para sua forma de trabalhar, com informações organizadas e controle de qualidade em cada etapa.',
      'Design and development of a system tailored to the way you work, with well-organized information and quality checks at every stage.',
    ),
    includes: [
      t('Relevamiento y modelado de su negocio', 'Levantamento e modelagem do seu negócio', 'Discovery and modeling of your business'),
      t('Sistema web, móvil o de escritorio a medida', 'Sistema web, mobile ou desktop sob medida', 'Custom web, mobile or desktop system'),
      t('Información centralizada y reportes', 'Informações centralizadas e relatórios', 'Centralized information and reports'),
      t('Entregas por etapas validadas por su equipo', 'Entregas por etapas validadas pela sua equipe', 'Staged deliveries validated by your team'),
    ],
    needs: t(
      'Es útil conocer qué problema debe resolver, quién lo usaría y qué tan definida está la idea. Si es solo una idea, la ordenamos juntos.',
      'Ajuda saber que problema deve resolver, quem o usaria e quão definida está a ideia. Se é só uma ideia, organizamos juntos.',
      'It helps to know what problem it must solve, who would use it and how defined the idea is. If it is only an idea, we shape it together.',
    ),
    stepIntro: t(
      'Sobre lo que imagina: qué tan definido está y qué tendría que poder hacer la gente. Sin tecnicismos.',
      'Sobre o que você imagina: quão definido está e o que as pessoas deveriam poder fazer. Sem termos técnicos.',
      'About what you have in mind: how defined it is and what people should be able to do. No jargon.',
    ),
    questions: [
      {
        // Madurez de la idea: define si la primera etapa es darle forma o construir. Cualquier respuesta es válida.
        id: 'd_definicion', type: 'single', required: true,
        short: t('Definición', 'Definição', 'How defined'),
        label: t('¿Qué tan definido está lo que necesita?', 'Quão definido está o que você precisa?', 'How clearly defined is what you need?'),
        help: t(
          'Cualquier punto de partida sirve: si es una idea, la ordenamos juntos.',
          'Qualquer ponto de partida serve: se é uma ideia, organizamos juntos.',
          'Any starting point works: if it is an idea, we shape it together.',
        ),
        options: [
          o('idea', 'Es una idea: necesito ayuda para darle forma', 'É uma ideia: preciso de ajuda para dar forma', 'It is an idea: I need help shaping it'),
          o('claro', 'Sé lo que tiene que hacer, falta el detalle', 'Sei o que precisa fazer, falta o detalhe', 'I know what it must do; the details are missing'),
          o('definido', 'Está definido: hay documentos, bocetos o ejemplos', 'Está definido: há documentos, esboços ou exemplos', 'It is defined: there are documents, sketches or examples'),
        ],
      },
      ...withOther(
        {
          // Lo que la gente HACE, no funciones técnicas. Las áreas del negocio son `x_areas`; los datos que se cargan dos
          // veces, `x_integraciones`.
          id: 'd_funciones', type: 'multi', maxChoices: 3,
          short: t('Imprescindible', 'Imprescindível', 'Must do'),
          label: t('¿Qué tendría que poder hacer la gente con el sistema?', 'O que as pessoas deveriam poder fazer com o sistema?', 'What should people be able to do with the system?'),
          help: t(
            'Las imprescindibles, pensando en el día a día y no en la tecnología.',
            'As imprescindíveis, pensando no dia a dia e não na tecnologia.',
            'The essential ones, thinking of the day to day rather than the technology.',
          ),
          options: [
            o('registrar', 'Registrar pedidos, ventas o trabajos', 'Registrar pedidos, vendas ou serviços', 'Record orders, sales or jobs'),
            o('seguimiento', 'Ver en el momento cómo va algo (pedidos, stock, avance)', 'Ver na hora como algo está (pedidos, estoque, andamento)', 'See how things stand right now (orders, stock, progress)'),
            o('avisos', 'Recibir avisos cuando pasa algo importante', 'Receber avisos quando algo importante acontece', 'Get alerts when something important happens'),
            o('reportes', 'Sacar números e informes para decidir', 'Tirar números e relatórios para decidir', 'Get figures and reports to make decisions'),
            o('permisos', 'Que cada persona vea solo lo que le corresponde', 'Que cada pessoa veja só o que lhe cabe', 'Each person sees only what concerns them'),
            o('archivos', 'Subir fotos, archivos o firmas', 'Enviar fotos, arquivos ou assinaturas', 'Upload photos, files or signatures'),
            o('cobrar', 'Cobrar online', 'Cobrar online', 'Take payments online'),
            OTHER,
          ],
        },
        SOMETHING_ELSE,
      ),
      {
        id: 'd_dispositivos', type: 'multi', required: true,
        label: t('¿Desde dónde lo usarían?', 'De onde o usariam?', 'Where would it be used from?'),
        options: [
          o('pc', 'Computadora', 'Computador', 'Computer'),
          o('celular', 'Celular', 'Celular', 'Phone'),
          o('tablet', 'Tablet', 'Tablet', 'Tablet'),
          o('offline', 'También donde no hay internet', 'Também onde não há internet', 'Also where there is no internet'),
        ],
      },
      {
        // Una referencia conocida explica una idea mejor que una lista de funciones.
        id: 'd_referencia', type: 'text', maxLength: 100, autoComplete: 'off',
        short: t('Algo parecido', 'Algo parecido', 'Something similar'),
        label: t('¿Conoce alguna aplicación o sistema parecido a lo que imagina?', 'Conhece algum aplicativo ou sistema parecido com o que imagina?', 'Do you know any app or system similar to what you have in mind?'),
        help: t(
          'Nos ayuda a entender la idea. Por ejemplo: «como la app de un banco, pero para pedir turnos».',
          'Ajuda a entender a ideia. Por exemplo: «como o app de um banco, mas para agendar horários».',
          'It helps us understand the idea. For example: "like a banking app, but for booking appointments".',
        ),
        placeholder: t('Nombre o descripción', 'Nome ou descrição', 'Name or description'),
      },
    ],
  },
  {
    id: 'gestion',
    color: '#ff6fbf',
    short: t('Gestión', 'Gestão', 'Management'),
    tagline: t('Ventas, stock y clientes en una sola plataforma', 'Vendas, estoque e clientes em uma só plataforma', 'Sales, stock and customers in one platform'),
    title: t('Gestión & Integraciones', 'Gestão & Integrações', 'Management & Integrations'),
    summary: t(
      'Unificación de la gestión de su empresa (ventas, clientes, stock, compras y facturación) en una sola plataforma, conectada con las herramientas que ya utiliza.',
      'Unificação da gestão da sua empresa (vendas, clientes, estoque, compras e faturamento) em uma só plataforma, conectada às ferramentas que você já utiliza.',
      'Unification of company management (sales, customers, stock, purchasing and invoicing) on a single platform, connected to the tools you already use.',
    ),
    includes: [
      t('Plataforma de gestión integral (ERP / CRM)', 'Plataforma de gestão integrada (ERP / CRM)', 'Integrated management platform (ERP / CRM)'),
      t('Seguimiento de clientes y comunicación', 'Acompanhamento de clientes e comunicação', 'Customer follow-up and communication'),
      t('Conexión con tienda online, facturación, bancos o WhatsApp', 'Conexão com loja online, faturamento, bancos ou WhatsApp', 'Connection to online store, invoicing, banks or WhatsApp'),
      t('Migración de la información y capacitación', 'Migração das informações e treinamento', 'Data migration and training'),
    ],
    needs: t(
      'Es útil conocer qué áreas se desea ordenar, cómo se trabaja hoy y qué información ya tienen registrada.',
      'Ajuda saber quais áreas quer organizar, como trabalham hoje e que informações já têm registradas.',
      'It helps to know which areas you want to organize, how you work today and what information you already have on record.',
    ),
    stepIntro: t(
      'Sobre la información que ya tienen: qué hay registrado y qué tan confiable es.',
      'Sobre as informações que vocês já têm: o que está registrado e quão confiável é.',
      'About the information you already have: what is on record and how reliable it is.',
    ),
    questions: [
      {
        // Si hoy no usan nada, no hay nada registrado: no se pregunta.
        id: 'g_informacion', type: 'multi',
        short: t('Información registrada', 'Informações registradas', 'Information on record'),
        showIf: { not: { answer: 'x_herramientas', only: ['nada'] } },
        label: t(
          '¿Qué información tienen registrada hoy, aunque sea en planillas o en papel?',
          'Que informações vocês têm registradas hoje, mesmo que em planilhas ou papel?',
          'What information do you have on record today, even in spreadsheets or on paper?',
        ),
        help: t('Es lo que se podría pasar al sistema nuevo.', 'É o que poderia ir para o sistema novo.', 'It is what could move into the new system.'),
        options: [
          o('clientes', 'Clientes', 'Clientes', 'Customers'),
          o('productos', 'Productos y precios', 'Produtos e preços', 'Products and prices'),
          o('stock', 'Stock', 'Estoque', 'Stock'),
          o('historial', 'Ventas o facturas anteriores', 'Vendas ou notas anteriores', 'Past sales or invoices'),
          o('proveedores', 'Proveedores', 'Fornecedores', 'Suppliers'),
          o('nada', 'Casi nada: está en la cabeza de las personas', 'Quase nada: está na cabeça das pessoas', "Hardly anything: it's in people's heads", { exclusive: true }),
        ],
      },
      {
        // Calidad de lo que hay: decide si se migra tal cual o primero hay que ordenarlo (un punto débil frecuente).
        id: 'g_calidad', type: 'single',
        short: t('Calidad de la información', 'Qualidade das informações', 'Information quality'),
        showIf: { all: [{ answered: 'g_informacion' }, { not: { answer: 'g_informacion', only: ['nada'] } }] },
        label: t('¿Qué tan confiable es esa información?', 'Quão confiável é essa informação?', 'How reliable is that information?'),
        options: [
          o('ordenada', 'Ordenada y al día', 'Organizada e em dia', 'Organized and up to date'),
          o('desordenada', 'Está, pero desordenada, repetida o incompleta', 'Existe, mas desorganizada, repetida ou incompleta', "It's there, but messy, duplicated or incomplete"),
          o('vieja', 'Bastante desactualizada', 'Bem desatualizada', 'Quite out of date'),
          DONT_KNOW,
        ],
      },
    ],
  },
  {
    id: 'infraestructura',
    color: '#3b9bff',
    short: t('Infraestructura', 'Infraestrutura', 'Infrastructure'),
    tagline: t('Redes, servidores y nube estables y seguros', 'Redes, servidores e nuvem estáveis e seguros', 'Reliable, secure networks, servers and cloud'),
    title: t('Infraestructura & Redes', 'Infraestrutura & Redes', 'Infrastructure & Networks'),
    summary: t(
      'Planificación e implementación de la base técnica (servidores, nube, red y seguridad) para que todo funcione de forma estable y protegida.',
      'Planejamento e implantação da base técnica (servidores, nuvem, rede e segurança) para que tudo funcione de forma estável e protegida.',
      'Planning and implementation of the technical foundation (servers, cloud, network and security) so everything runs reliably and securely.',
    ),
    includes: [
      t('Servidores propios o en la nube', 'Servidores próprios ou na nuvem', 'On-site or cloud servers'),
      t('Cableado y redes Wi-Fi', 'Cabeamento e redes Wi-Fi', 'Cabling and Wi-Fi networks'),
      t('Copias de seguridad y protección de la información', 'Backups e proteção das informações', 'Backups and information protection'),
      t('Puesta en marcha y documentación', 'Implantação e documentação', 'Setup and documentation'),
    ],
    needs: t(
      'Es útil conocer qué problemas notan hoy, cuántos equipos y lugares hay y qué pasaría si se pierde la información. No hace falta saber de redes ni servidores.',
      'Ajuda saber que problemas notam hoje, quantos equipamentos e locais existem e o que aconteceria se as informações se perdessem. Não é preciso entender de redes nem servidores.',
      'It helps to know what problems you notice today, how many devices and locations there are and what would happen if information were lost. No knowledge of networks or servers needed.',
    ),
    stepIntro: t(
      'Sobre su tecnología de hoy: qué problemas notan y qué pasaría si algo falla. No hace falta saber de redes ni servidores.',
      'Sobre a sua tecnologia hoje: que problemas notam e o que aconteceria se algo falhasse. Não é preciso entender de redes nem servidores.',
      "About your technology today: what problems you notice and what would happen if something failed. You don't need to know about networks or servers.",
    ),
    questions: [
      ...withOther(
        {
          // Síntomas, no soluciones: el cliente no sabe si necesita «un servidor» o «pasar a la nube»; sí sabe qué le pasa.
          id: 'i_sintomas', type: 'multi', required: true, maxChoices: 3,
          short: t('Problemas', 'Problemas', 'Problems'),
          label: t('¿Qué problemas notan hoy?', 'Que problemas vocês notam hoje?', 'What problems do you notice today?'),
          variants: [{ when: profileIs('independiente', 'personal'), label: t('¿Qué problemas nota hoy?', 'Que problemas você nota hoje?', 'What problems do you notice today?') }],
          help: t('Los que más molestan en el día a día.', 'Os que mais atrapalham no dia a dia.', 'The ones that get in the way most, day to day.'),
          options: [
            o('internet', 'Internet lento o que se corta', 'Internet lenta ou que cai', 'Slow or dropping internet'),
            o('equipos', 'Computadoras lentas o que fallan seguido', 'Computadores lentos ou que falham com frequência', 'Slow computers or frequent failures'),
            o('compartir', 'Cuesta compartir archivos o impresoras', 'É difícil compartilhar arquivos ou impressoras', 'Sharing files or printers is hard'),
            o('remoto', 'No se puede trabajar bien desde afuera', 'Não dá para trabalhar bem de fora', "You can't work well from outside"),
            o('seguridad', 'Hubo virus, estafas o accesos indebidos', 'Houve vírus, golpes ou acessos indevidos', 'There have been viruses, scams or unauthorized access'),
            o('nuevo', 'Hay que equipar un lugar nuevo (mudanza o sucursal)', 'É preciso equipar um lugar novo (mudança ou filial)', 'A new place needs setting up (a move or a branch)'),
            o('ninguno', 'Ninguno: quiero prevenir o mejorar', 'Nenhum: quero prevenir ou melhorar', 'None: I want to prevent or improve', { exclusive: true }),
            OTHER,
          ],
        },
        t('Otro problema: ¿cuál?', 'Outro problema: qual?', 'Other problem: what is it?'),
      ),
      {
        // Cómo están las copias de seguridad, preguntado como consecuencia: el riesgo más común y el que menos se ve.
        id: 'i_respaldo', type: 'single', required: true,
        short: t('Si se pierde la computadora principal', 'Se o computador principal se perder', 'If the main computer is lost'),
        label: t(
          'Si mañana se rompe o se roban la computadora más importante, ¿qué pasa con la información?',
          'Se amanhã o computador mais importante quebrar ou for roubado, o que acontece com as informações?',
          'If the most important computer broke or was stolen tomorrow, what would happen to the information?',
        ),
        options: [
          o('copia', 'Hay una copia en otro lado y se recupera', 'Há uma cópia em outro lugar e se recupera', "There's a copy elsewhere and it can be recovered"),
          o('parte', 'Se recuperaría una parte', 'Daria para recuperar uma parte', 'Part of it could be recovered'),
          o('perdida', 'Se perdería', 'Seria perdida', 'It would be lost'),
          DONT_KNOW,
        ],
      },
      {
        // Cuánto depende el trabajo de que todo funcione: dice qué tan crítica es la continuidad (y cuánto conviene invertir).
        id: 'i_caida', type: 'single', required: true, showIf: NOT_PERSONAL,
        short: t('Si se corta todo', 'Se tudo cair', 'If everything goes down'),
        label: t(
          'Si se cortan internet o los sistemas, ¿cuánto tiempo pueden seguir trabajando?',
          'Se a internet ou os sistemas caem, quanto tempo conseguem continuar trabalhando?',
          'If the internet or systems go down, how long can you keep working?',
        ),
        variants: [{
          when: profileIs('independiente'),
          label: t(
            'Si se cortan internet o los sistemas, ¿cuánto tiempo puede seguir trabajando?',
            'Se a internet ou os sistemas caem, quanto tempo consegue continuar trabalhando?',
            'If the internet or systems go down, how long can you keep working?',
          ),
        }],
        options: [
          o('nada', 'Nada: se frena todo', 'Nada: tudo para', 'Not at all: everything stops'),
          o('horas', 'Unas horas', 'Algumas horas', 'A few hours'),
          o('dias', 'Un día o más', 'Um dia ou mais', 'A day or more'),
          o('poco', 'Casi no afecta', 'Quase não afeta', 'It barely matters'),
        ],
      },
    ],
  },
  {
    id: 'ia',
    color: '#ffb23e',
    short: t('IA', 'IA', 'AI'),
    tagline: t('Automatizar lo que hoy se hace a mano', 'Automatizar o que hoje é feito à mão', 'Automate what is done by hand today'),
    title: t('Inteligencia Artificial', 'Inteligência Artificial', 'Artificial Intelligence'),
    summary: t(
      'Aplicación de inteligencia artificial donde genera un ahorro real: lectura de documentos e imágenes, respuesta a consultas, clasificación de información o asistencia a su equipo.',
      'Aplicação de inteligência artificial onde ela gera economia real: leitura de documentos e imagens, resposta a dúvidas, classificação de informações ou apoio à sua equipe.',
      'Application of artificial intelligence where it creates real savings: reading documents and images, answering inquiries, sorting information or assisting your team.',
    ),
    includes: [
      t('Lectura automática de imágenes y documentos', 'Leitura automática de imagens e documentos', 'Automatic reading of images and documents'),
      t('Asistentes para clientes o para el equipo', 'Assistentes para clientes ou para a equipe', 'Assistants for customers or for your team'),
      t('Modelos entrenados con su propia información', 'Modelos treinados com suas próprias informações', 'Models trained on your own information'),
      t('Evaluación previa de factibilidad', 'Avaliação prévia de viabilidade', 'Up-front feasibility assessment'),
    ],
    needs: t(
      'Es útil conocer qué tarea le quita tiempo hoy, cada cuánto se hace y si hay ejemplos guardados. Si no sabe qué puede hacer la IA en su caso, lo vemos juntos.',
      'Ajuda saber que tarefa toma tempo hoje, com que frequência é feita e se há exemplos guardados. Se não sabe o que a IA pode fazer no seu caso, vemos juntos.',
      'It helps to know which task takes up time today, how often it is done and whether examples have been kept. If you are not sure what AI could do for you, we look at it together.',
    ),
    stepIntro: t(
      'Sobre la inteligencia artificial: qué tarea le gustaría sacarse de encima. Si no sabe qué se puede hacer, también sirve.',
      'Sobre a inteligência artificial: que tarefa gostaria de tirar das suas costas. Se não sabe o que dá para fazer, também serve.',
      "About artificial intelligence: which task you'd like off your plate. If you don't know what's possible, that's fine too.",
    ),
    questions: [
      ...withOther(
        {
          id: 'a_objetivo', type: 'multi', required: true,
          short: t('Tarea para la IA', 'Tarefa para a IA', 'Task for the AI'),
          label: t('¿Qué tarea le gustaría sacarse de encima?', 'Que tarefa gostaria de tirar das suas costas?', 'Which task would you like off your plate?'),
          help: t(
            'Si no sabe qué puede hacer la IA en su caso, elija «No lo tengo claro»: lo vemos juntos.',
            'Se não sabe o que a IA pode fazer no seu caso, escolha «Não tenho claro»: vemos juntos.',
            'If you\'re not sure what AI could do for you, choose "I\'m not sure": we will look at it together.',
          ),
          options: [
            o('consultas', 'Responder una y otra vez las mismas preguntas de clientes', 'Responder sempre as mesmas perguntas de clientes', 'Answering the same customer questions over and over'),
            o('documentos', 'Copiar datos de facturas, formularios u otros documentos', 'Copiar dados de notas, formulários ou outros documentos', 'Copying data from invoices, forms or other documents'),
            o('revisar', 'Revisar o clasificar fotos, documentos o mensajes', 'Revisar ou classificar fotos, documentos ou mensagens', 'Reviewing or sorting photos, documents or messages'),
            o('redactar', 'Escribir textos, resúmenes o informes', 'Escrever textos, resumos ou relatórios', 'Writing texts, summaries or reports'),
            o('buscar', 'Encontrar información que está desparramada', 'Encontrar informações espalhadas', 'Finding information scattered across places'),
            o('prever', 'Anticipar ventas, demanda o problemas', 'Antecipar vendas, demanda ou problemas', 'Forecasting sales, demand or problems'),
            o('explorar', 'No lo tengo claro: quiero saber qué se puede hacer', 'Não tenho claro: quero saber o que dá para fazer', "I'm not sure: I want to know what's possible", { exclusive: true }),
            OTHER,
          ],
        },
        t('Otra tarea: ¿cuál?', 'Outra tarefa: qual?', 'Other task: what is it?'),
      ),
      {
        // Sin una tarea elegida no hay frecuencia que medir.
        id: 'a_volumen', type: 'single', showIf: { not: { answer: 'a_objetivo', only: ['explorar'] } },
        short: t('Frecuencia', 'Frequência', 'Frequency'),
        label: t('¿Cada cuánto se hace esa tarea?', 'Com que frequência essa tarefa é feita?', 'How often is that task done?'),
        options: [
          o('mes', 'Algunas veces al mes', 'Algumas vezes por mês', 'A few times a month'),
          o('dia', 'Todos los días', 'Todos os dias', 'Every day'),
          o('cientos', 'Cientos de veces por día', 'Centenas de vezes por dia', 'Hundreds of times a day'),
          DONT_KNOW,
        ],
      },
      {
        id: 'a_datos', type: 'single',
        short: t('Ejemplos guardados', 'Exemplos guardados', 'Saved examples'),
        label: t('¿Tienen ejemplos o historial guardado (documentos, fotos, conversaciones)?', 'Têm exemplos ou histórico guardado (documentos, fotos, conversas)?', 'Do you have examples or a history saved (documents, photos, conversations)?'),
        options: [
          o('muchos', 'Sí, bastantes', 'Sim, bastante', 'Yes, plenty'),
          o('algunos', 'Algunos', 'Alguns', 'Some'),
          o('no', 'No', 'Não', 'No'),
          DONT_KNOW,
        ],
      },
      {
        // Cuánto control humano hace falta: decide si la IA puede actuar sola o solo sugerir (viabilidad y riesgo).
        id: 'a_error', type: 'single', showIf: { not: { answer: 'a_objetivo', only: ['explorar'] } },
        short: t('Si la IA se equivoca', 'Se a IA errar', 'If the AI gets it wrong'),
        label: t(
          'Si la IA se equivocara alguna vez en esa tarea, ¿qué tan grave sería?',
          'Se a IA errasse alguma vez nessa tarefa, quão grave seria?',
          'If the AI got that task wrong now and then, how serious would it be?',
        ),
        options: [
          o('leve', 'Poco: alguien lo revisa antes', 'Pouco: alguém revisa antes', 'Not much: someone checks it first'),
          o('delicado', 'Delicado: hay dinero, salud o temas legales en juego', 'Delicado: há dinheiro, saúde ou questões legais em jogo', 'Serious: money, health or legal matters are at stake'),
          DONT_KNOW,
        ],
      },
    ],
  },
  {
    id: 'soporte',
    color: '#3fe0a0',
    short: t('Soporte 24/7', 'Suporte 24/7', '24/7 Support'),
    tagline: t(
      'Emergencias, reparación y mantenimiento de equipos',
      'Emergências, conserto e manutenção de equipamentos',
      'Emergencies, repair and maintenance of equipment',
    ),
    title: t('Soporte & Hardware 24/7', 'Suporte & Hardware 24/7', 'Support & Hardware 24/7'),
    summary: t(
      'Atención de emergencias las 24 horas, reparación y mantenimiento de equipos, de forma remota o presencial, para que su operación no se detenga.',
      'Atendimento a emergências 24 horas, conserto e manutenção de equipamentos, de forma remota ou presencial, para que sua operação não pare.',
      'Round-the-clock emergency response, equipment repair and maintenance, remote or on-site, so your operation never stops.',
    ),
    includes: [
      t('Emergencias 24/7, en remoto o presencial', 'Emergências 24/7, remotas ou presenciais', '24/7 emergencies, remote or on-site'),
      t('Diagnóstico y reparación de equipos', 'Diagnóstico e conserto de equipamentos', 'Equipment diagnosis and repair'),
      t('Mantenimiento preventivo y correctivo', 'Manutenção preventiva e corretiva', 'Preventive and corrective maintenance'),
      t('Optimización de sistemas operativos', 'Otimização de sistemas operacionais', 'Operating system optimization'),
    ],
    needs: t(
      'Es útil conocer si se trata de una emergencia o de un mantenimiento, qué equipo está involucrado, qué ocurre y si prefiere atención remota o presencial.',
      'Ajuda saber se é uma emergência ou uma manutenção, qual equipamento está envolvido, o que está acontecendo e se prefere atendimento remoto ou presencial.',
      'It helps to know whether it is an emergency or maintenance, which equipment is involved, what is happening and whether you prefer remote or on-site service.',
    ),
    stepIntro: t(
      'Sobre la atención técnica: qué tipo de ayuda necesita, con qué equipo y si la prefiere presencial o a distancia.',
      'Sobre o atendimento técnico: que tipo de ajuda precisa, com qual equipamento e se prefere presencial ou remoto.',
      'About technical support: what kind of help you need, with which equipment, and whether on-site or remote.',
    ),
    questions: [
      {
        id: 's_tipo', type: 'single', required: true,
        label: t('¿Qué tipo de atención necesita?', 'Que tipo de atendimento precisa?', 'What kind of service do you need?'),
        options: [
          o('emergencia', 'Una emergencia ahora', 'Uma emergência agora', 'An emergency right now'),
          o('puntual', 'Reparar un equipo', 'Consertar um equipamento', 'Repair a piece of equipment'),
          o('periodico', 'Mantenimiento (preventivo o periódico)', 'Manutenção (preventiva ou periódica)', 'Maintenance (preventive or regular)'),
        ],
      },
      ...withOther(
        {
          id: 's_equipo', type: 'multi', required: true,
          label: t('¿Qué equipo está involucrado?', 'Qual equipamento está envolvido?', 'Which equipment is involved?'),
          options: [
            o('pc', 'Computadora o notebook', 'Computador ou notebook', 'Computer or laptop'),
            o('servidor', 'Servidor', 'Servidor', 'Server'),
            o('impresora', 'Impresora', 'Impressora', 'Printer'),
            o('red', 'Red o internet', 'Rede ou internet', 'Network or internet'),
            o('movil', 'Celular o tablet', 'Celular ou tablet', 'Phone or tablet'),
            OTHER,
          ],
        },
        t('Otro equipo: ¿cuál?', 'Outro equipamento: qual?', 'Other equipment: what is it?'),
      ),
      {
        // Con Soporte solo, lo que pasa ya lo contó en `x_necesidad`. Combinado con otro servicio, esa respuesta habla de
        // todo junto: la falla del equipo se pide aparte, y solo si hay algo roto (no para un mantenimiento).
        id: 's_sintoma', type: 'textarea', required: true,
        showIf: { all: [{ not: ONLY_SUPPORT }, is('s_tipo', 'emergencia', 'puntual')] },
        label: t('¿Qué le pasa al equipo?', 'O que está acontecendo com o equipamento?', 'What is wrong with the equipment?'),
        placeholder: t('Ej.: la computadora de caja no enciende desde ayer', 'Ex.: o computador do caixa não liga desde ontem', "E.g.: the checkout computer hasn't turned on since yesterday"),
      },
      {
        id: 's_modalidad', type: 'single', required: true,
        label: t('¿Cómo prefiere la atención?', 'Como prefere o atendimento?', 'How would you prefer the service?'),
        options: [
          o('presencial', 'Presencial', 'Presencial', 'On-site'),
          o('remota', 'Remota', 'Remoto', 'Remote'),
          o('indistinto', 'Indistinto', 'Tanto faz', 'Either'),
        ],
      },
    ],
  },
];

/* ------------------------ Secciones comunes ------------------------ */

/** Paso 1: quién consulta. Lo mínimo para ubicar el contexto, para cualquier perfil. */
export const INQUIRY_SECTION: Section = {
  id: 'consulta',
  color: '#e8edf4',
  title: t('Su consulta', 'Sua consulta', 'Your inquiry'),
  intro: t(
    'Primero, quién consulta. Son pocas preguntas.',
    'Primeiro, quem está consultando. São poucas perguntas.',
    'First, who is asking. Just a few questions.',
  ),
  questions: [
    {
      id: PROFILE_QUESTION, type: 'single', required: true,
      label: t('¿Para quién es la consulta?', 'Para quem é a consulta?', 'Who is this inquiry for?'),
      help: t(
        '¿Es un proyecto nuevo de una empresa que ya funciona? Elija «Una empresa o comercio en marcha».',
        'É um projeto novo de uma empresa que já funciona? Escolha «Uma empresa ou comércio em funcionamento».',
        'Is it a new project of a company that already operates? Choose "A company or business already operating".',
      ),
      options: [
        o('empresa', 'Una empresa o comercio en marcha', 'Uma empresa ou comércio em funcionamento', 'A company or business already operating', { crm: 'Empresa' }),
        o('organizacion', 'Una institución, ONG u organismo público', 'Uma instituição, ONG ou órgão público', 'An institution, nonprofit or public body', { crm: 'Organización' }),
        o('independiente', 'Mi actividad como profesional independiente', 'Minha atividade como profissional autônomo', 'My work as an independent professional', { crm: 'Independiente' }),
        o('proyecto', 'Un proyecto o emprendimiento nuevo', 'Um projeto ou empreendimento novo', 'A new project or startup', { crm: 'Proyecto' }),
        o('personal', 'Uso personal o del hogar', 'Uso pessoal ou doméstico', 'Personal or home use', { crm: 'Personal' }),
      ],
    },
    {
      // Sin «¿cuál?» para «Otro»: la descripción que sigue ya dice a qué se dedica.
      id: 'p_industria', type: 'single', required: true, showIf: NOT_PERSONAL,
      label: t('¿En qué rubro trabaja?', 'Em que setor atua?', 'What industry are you in?'),
      variants: [{ when: profileIs('proyecto'), label: t('¿En qué rubro está el proyecto?', 'Em que setor está o projeto?', 'What industry is the project in?') }],
      options: [
        o('comercio', 'Comercio minorista o mayorista', 'Comércio varejista ou atacadista', 'Retail or wholesale', { crm: 'Retail & Wholesale' }),
        o('ecommerce', 'Venta online', 'Venda online', 'Online sales', { crm: 'Ecommerce' }),
        o('alimentos', 'Alimentos, bebidas o gastronomía', 'Alimentos, bebidas ou gastronomia', 'Food, drinks or restaurants', { crm: 'Food & Beverage' }),
        o('industria', 'Industria o fabricación', 'Indústria ou fabricação', 'Manufacturing', { crm: 'Manufacturing' }),
        o('logistica', 'Transporte o logística', 'Transporte ou logística', 'Transport or logistics', { crm: 'Logistics' }),
        o('construccion', 'Construcción o inmobiliaria', 'Construção ou imobiliária', 'Construction or real estate', { crm: 'Real Estate' }),
        o('salud', 'Salud o bienestar', 'Saúde ou bem-estar', 'Health or wellness', { crm: 'Health Care' }),
        o('educacion', 'Educación', 'Educação', 'Education', { crm: 'Education' }),
        o('profesionales', 'Servicios profesionales (contable, legal, consultoría)', 'Serviços profissionais (contábil, jurídico, consultoria)', 'Professional services (accounting, legal, consulting)', { crm: 'Service' }),
        o('tecnologia', 'Tecnología o software', 'Tecnologia ou software', 'Technology or software', { crm: 'Technology' }),
        o('finanzas', 'Finanzas o seguros', 'Finanças ou seguros', 'Finance or insurance', { crm: 'Financial Services' }),
        o('agro', 'Agro', 'Agronegócio', 'Agriculture', { crm: 'Agriculture' }),
        o('turismo', 'Turismo u hotelería', 'Turismo ou hotelaria', 'Tourism or hospitality', { crm: 'Travel' }),
        o('marketing', 'Marketing, medios o comunicación', 'Marketing, mídia ou comunicação', 'Marketing, media or communications', { crm: 'Marketing' }),
        OTHER,
      ],
    },
    {
      // Qué es la empresa o el proyecto, no qué le pasa: eso es `x_necesidad`, y la ayuda lo aclara para que no se mezclen.
      id: 'p_descripcion', type: 'text', required: true, showIf: NOT_PERSONAL, maxLength: 160, autoComplete: 'off',
      short: t('Descripción', 'Descrição', 'Description'),
      label: t('En una frase: ¿a qué se dedica la empresa y para quién?', 'Em uma frase: o que a empresa faz e para quem?', 'In one sentence: what does the company do, and for whom?'),
      help: t(
        'Por ejemplo: «Distribuidora de alimentos para almacenes de zona norte». Lo que necesita resolver se lo preguntamos enseguida.',
        'Por exemplo: «Distribuidora de alimentos para mercados da zona norte». O que precisa resolver perguntamos em seguida.',
        'For example: "Food distributor supplying corner shops in the north side". We will ask what you need to solve next.',
      ),
      placeholder: t('Escriba una frase', 'Escreva uma frase', 'Write one sentence'),
      variants: [
        {
          when: profileIs('organizacion'),
          label: t('En una frase: ¿qué hace la organización y para quién?', 'Em uma frase: o que a organização faz e para quem?', 'In one sentence: what does the organization do, and for whom?'),
          help: t(
            'Por ejemplo: «Fundación que da apoyo escolar a 300 chicos del barrio». Lo que necesita resolver se lo preguntamos enseguida.',
            'Por exemplo: «Fundação que dá reforço escolar a 300 crianças do bairro». O que precisa resolver perguntamos em seguida.',
            'For example: "A foundation that tutors 300 local kids". We will ask what you need to solve next.',
          ),
        },
        {
          when: profileIs('independiente'),
          label: t('En una frase: ¿a qué se dedica y para quién trabaja?', 'Em uma frase: o que você faz e para quem trabalha?', 'In one sentence: what do you do, and who do you work for?'),
          help: t(
            'Por ejemplo: «Arquitecta, hago reformas para particulares». Lo que necesita resolver se lo preguntamos enseguida.',
            'Por exemplo: «Arquiteta, faço reformas para clientes particulares». O que precisa resolver perguntamos em seguida.',
            'For example: "Architect doing home renovations for private clients". We will ask what you need to solve next.',
          ),
        },
        {
          when: profileIs('proyecto'),
          label: t('En una frase: ¿de qué se trata el proyecto y para quién es?', 'Em uma frase: do que se trata o projeto e para quem é?', 'In one sentence: what is the project, and who is it for?'),
          help: t(
            'Por ejemplo: «Una app para reservar turnos en peluquerías de barrio». En qué punto está se lo preguntamos enseguida.',
            'Por exemplo: «Um app para agendar horários em salões de bairro». Em que ponto está perguntamos em seguida.',
            'For example: "An app to book appointments at local hair salons". We will ask where it stands next.',
          ),
        },
      ],
    },
    {
      // Independiente: es una persona (el CRM recibe 1-10). Uso personal: no aplica.
      id: 'p_tamano', type: 'single', required: true, showIf: profileIs('empresa', 'organizacion', 'proyecto'),
      label: t('¿Cuántas personas trabajan en la empresa?', 'Quantas pessoas trabalham na empresa?', 'How many people work at the company?'),
      variants: [
        { when: profileIs('organizacion'), label: t('¿Cuántas personas trabajan en la organización?', 'Quantas pessoas trabalham na organização?', 'How many people work at the organization?') },
        { when: profileIs('proyecto'), label: t('¿Cuántas personas participan del proyecto?', 'Quantas pessoas participam do projeto?', 'How many people are involved in the project?') },
      ],
      options: PEOPLE_RANGES.map((opt) => ({ ...opt, crm: opt.id })),
    },
  ],
};

/**
 * Paso 2: el diagnóstico. Lo que el cliente SÍ sabe aunque no sepa nada de tecnología: qué pasa, cómo lo afecta, qué
 * funciona bien (fortalezas), qué intentó y qué falló (puntos débiles), y qué quiere lograr. Con Soporte solo, el pedido
 * es concreto (un equipo, una falla): queda la pregunta abierta y lo demás lo resuelven las preguntas de Soporte.
 */
export const DIAGNOSIS_SECTION: Section = {
  id: 'diagnostico',
  color: '#c9f27a',
  title: t('Qué está pasando', 'O que está acontecendo', 'What is going on'),
  intro: t(
    'Lo más importante. No hace falta saber de tecnología ni qué solución necesita: cuéntenos qué pasa y qué le gustaría lograr. La solución la buscamos nosotros.',
    'O mais importante. Não é preciso entender de tecnologia nem saber que solução precisa: conte o que acontece e o que gostaria de alcançar. A solução, buscamos nós.',
    "The most important part. You don't need to know about technology or which solution you need: tell us what is happening and what you would like to achieve. Finding the solution is our job.",
  ),
  questions: [
    {
      // La única pregunta abierta sobre la situación, para todos los servicios: si se eligen varios, se cuenta una vez.
      // Habla de HOY; lo que quiere lograr va en `x_objetivos`, así no se cuentan dos veces lo mismo.
      id: 'x_necesidad', type: 'textarea', required: true, maxLength: 500,
      short: t('Situación', 'Situação', 'Situation'),
      label: t('¿Qué está pasando que lo lleva a consultar?', 'O que está acontecendo que leva você a consultar?', 'What is going on that brings you here?'),
      help: t(
        'Con sus palabras, como se lo contaría a un colega: qué pasa hoy, qué le preocupa o qué idea tiene. No hace falta saber qué solución técnica necesita.',
        'Com suas palavras, como contaria a um colega: o que acontece hoje, o que preocupa ou que ideia tem. Não é preciso saber que solução técnica precisa.',
        "In your own words, as you would tell a colleague: what happens today, what worries you or what idea you have. You don't need to know which technical solution you need.",
      ),
      variants: [
        {
          when: ONLY_SUPPORT,
          label: t('¿Qué está fallando o qué necesita?', 'O que está falhando ou do que precisa?', 'What is failing, or what do you need?'),
          help: t('Qué equipo, desde cuándo y qué hace (o qué no hace).', 'Qual equipamento, desde quando e o que faz (ou não faz).', 'Which equipment, since when, and what it does (or does not do).'),
        },
        {
          when: profileIs('proyecto'),
          label: t('¿En qué punto está el proyecto y qué necesita para avanzar?', 'Em que ponto está o projeto e do que precisa para avançar?', 'Where does the project stand, and what does it need to move forward?'),
          placeholder: t(
            'Ej.: tengo la idea y algunos interesados; necesito saber cuánto cuesta hacer la app y por dónde empezar',
            'Ex.: tenho a ideia e alguns interessados; preciso saber quanto custa fazer o app e por onde começar',
            'E.g.: I have the idea and a few interested people; I need to know what the app would cost and where to start',
          ),
        },
        {
          when: { minServices: 2 },
          help: t(
            'Eligió varios servicios: cuéntelo todo junto, como una sola historia. No hace falta saber qué solución técnica necesita.',
            'Escolheu vários serviços: conte tudo junto, como uma só história. Não é preciso saber que solução técnica precisa.',
            "You chose several services: tell it all together, as one story. You don't need to know which technical solution you need.",
          ),
        },
        // Ejemplo según el primer servicio elegido (en el orden del catálogo).
        { when: { services: ['consultoria'] }, placeholder: t('Ej.: vendemos bien pero no sabemos si ganamos plata, y cada uno anota las cosas a su manera', 'Ex.: vendemos bem mas não sabemos se temos lucro, e cada um anota as coisas do seu jeito', "E.g.: sales are good but we don't know if we make money, and everyone records things their own way") },
        { when: { services: ['desarrollo'] }, placeholder: t('Ej.: no sabemos qué stock tenemos y perdemos ventas', 'Ex.: não sabemos o estoque que temos e perdemos vendas', "E.g.: we don't know our stock and we lose sales") },
        { when: { services: ['gestion'] }, placeholder: t('Ej.: cada sucursal lleva su planilla y a fin de mes los números no cierran', 'Ex.: cada filial tem sua planilha e no fim do mês os números não batem', "E.g.: each branch keeps its own spreadsheet and the numbers don't add up at month end") },
        { when: { services: ['infraestructura'] }, placeholder: t('Ej.: internet se corta, se pierden archivos y los equipos andan lentos', 'Ex.: a internet cai, arquivos se perdem e os equipamentos estão lentos', 'E.g.: the internet drops, files get lost and computers are slow') },
        { when: { services: ['ia'] }, placeholder: t('Ej.: cargamos a mano 200 facturas de proveedores por semana', 'Ex.: digitamos manualmente 200 notas de fornecedores por semana', 'E.g.: we manually enter 200 supplier invoices a week') },
        { when: { services: ['soporte'] }, placeholder: t('Ej.: la computadora de caja no enciende desde ayer', 'Ex.: o computador do caixa não liga desde ontem', "E.g.: the checkout computer hasn't turned on since yesterday") },
      ],
    },
    ...withOther(
      {
        // Puntos débiles en lenguaje de negocio: lo que le cuesta hoy. Hasta 3, para saber qué pesa más.
        id: 'x_impacto', type: 'multi', required: true, maxChoices: 3, showIf: { all: [DIAGNOSIS, OPERATING] },
        short: t('Impacto', 'Impacto', 'Impact'),
        label: t('¿Cómo los afecta hoy esta situación?', 'Como essa situação afeta vocês hoje?', 'How does this affect you today?'),
        variants: [{ when: profileIs('independiente'), label: t('¿Cómo lo afecta hoy esta situación?', 'Como essa situação afeta você hoje?', 'How does this affect you today?') }],
        help: t('Las que más pesan: así sabemos por dónde empezar.', 'As que mais pesam: assim sabemos por onde começar.', 'The ones that matter most, so we know where to start.'),
        options: [
          o('tiempo', 'Se pierden horas en tareas a mano o repetidas', 'Perdem-se horas em tarefas manuais ou repetitivas', 'Hours go into manual or repetitive tasks'),
          o('errores', 'Hay errores, olvidos o datos que no coinciden', 'Há erros, esquecimentos ou dados que não batem', "There are mistakes, things forgotten or figures that don't match"),
          o('informacion', 'Falta información a tiempo para decidir', 'Faltam informações a tempo para decidir', 'Information to decide arrives late or not at all'),
          o('clientes', 'Se pierden ventas o clientes, o se tarda en responder', 'Perdem-se vendas ou clientes, ou demora-se para responder', 'Sales or customers are lost, or replies take too long'),
          o('dependencia', 'Todo depende de una o dos personas que saben cómo funciona', 'Tudo depende de uma ou duas pessoas que sabem como funciona', 'Everything depends on one or two people who know how it works'),
          o('fallas', 'El trabajo se frena cuando algo falla', 'O trabalho para quando algo falha', 'Work stops when something fails'),
          o('riesgo', 'Hay riesgo de perder información o de sufrir un ataque', 'Há risco de perder informações ou de sofrer um ataque', 'There is a risk of losing information or being attacked'),
          o('crecer', 'Lo de hoy no va a alcanzar para crecer', 'O que temos hoje não vai dar conta do crescimento', "What we have today won't be enough to grow"),
          o('ninguno', 'Todavía no nos afecta: es para mejorar o prevenir', 'Ainda não nos afeta: é para melhorar ou prevenir', "It doesn't affect us yet: it's to improve or prevent", { exclusive: true }),
          OTHER,
        ],
      },
      SOMETHING_ELSE,
    ),
    {
      // Un proyecto nuevo no tiene «cómo lo afecta»: tiene con qué cuenta. Es su fortaleza y dice qué tan maduro está.
      id: 'x_avance', type: 'multi', required: true, showIf: { all: [DIAGNOSIS, profileIs('proyecto')] },
      short: t('Con qué cuenta', 'Com o que conta', 'What it already has'),
      label: t('¿Con qué cuenta ya el proyecto?', 'Com o que o projeto já conta?', 'What does the project already have?'),
      help: t('Lo que ya tiene pesa tanto como lo que falta.', 'O que já existe pesa tanto quanto o que falta.', 'What you already have matters as much as what is missing.'),
      options: [
        o('probada', 'La idea ya se probó: alguien la usó o la pagó', 'A ideia já foi testada: alguém usou ou pagou', 'The idea has been tested: someone used it or paid for it'),
        o('interesados', 'Clientes o usuarios interesados', 'Clientes ou usuários interessados', 'Interested customers or users'),
        o('equipo', 'Un equipo armado', 'Uma equipe formada', 'A team in place'),
        o('experiencia', 'Experiencia en el rubro', 'Experiência no setor', 'Experience in the industry'),
        o('financiamiento', 'Financiamiento propio o de inversores', 'Financiamento próprio ou de investidores', 'Own funding or investors'),
        o('nada', 'Todavía nada: estoy empezando', 'Ainda nada: estou começando', "Nothing yet: I'm just starting", { exclusive: true }),
      ],
    },
    ...withOther(
      {
        // Fortalezas: lo que conviene cuidar. Sin «información ordenada» (es `g_calidad`) ni «un sistema que funciona» (es
        // `x_sistema_actual`): cada cosa se pregunta una vez.
        id: 'x_fortalezas', type: 'multi', maxChoices: 3, showIf: { all: [DIAGNOSIS, OPERATING] },
        short: t('Fortalezas', 'Pontos fortes', 'Strengths'),
        label: t('¿Qué funciona bien hoy y conviene cuidar?', 'O que funciona bem hoje e vale a pena preservar?', 'What works well today and is worth keeping?'),
        help: t(
          'Lo que ya funciona también cuenta: así no se cambia lo que no hace falta.',
          'O que já funciona também conta: assim não se muda o que não precisa.',
          "What already works counts too: that way we don't change what doesn't need changing.",
        ),
        options: [
          o('experiencia', 'Experiencia y conocimiento del rubro', 'Experiência e conhecimento do setor', 'Experience and knowledge of the industry'),
          o('equipo', 'Un equipo que conoce bien su trabajo', 'Uma equipe que conhece bem o trabalho', 'A team that knows its job well'),
          o('clientes', 'Clientes fieles o conformes con la atención', 'Clientes fiéis ou satisfeitos com o atendimento', 'Loyal customers, happy with the service'),
          o('procesos', 'Procesos claros, aunque se hagan a mano', 'Processos claros, mesmo que feitos à mão', 'Clear processes, even if done by hand'),
          o('cambio', 'Ganas de cambiar la forma de trabajar', 'Vontade de mudar a forma de trabalhar', 'Willingness to change the way we work'),
          OTHER,
        ],
      },
      t('Otra fortaleza: ¿cuál?', 'Outro ponto forte: qual?', 'Other strength: what is it?'),
    ),
    shared(
      {
        // Dónde está el problema, en áreas del negocio (no módulos de un sistema).
        id: 'x_areas', type: 'multi', maxChoices: 3,
        short: t('Áreas', 'Áreas', 'Areas'),
        label: t('¿En qué partes del trabajo es más urgente resolver o mejorar algo?', 'Em que partes do trabalho é mais urgente resolver ou melhorar algo?', 'In which parts of your work is it most urgent to solve or improve something?'),
        help: t('Por ahí empezamos; el resto lo vemos en la reunión.', 'Começamos por aí; o resto vemos na reunião.', 'That is where we start; the rest we cover in the meeting.'),
        variants: [{ when: profileIs('proyecto'), label: t('¿Qué partes del negocio tiene que resolver primero el proyecto?', 'Que partes do negócio o projeto precisa resolver primeiro?', 'Which parts of the business must the project handle first?') }],
        options: [
          o('ventas', 'Ventas y presupuestos', 'Vendas e orçamentos', 'Sales and quotes'),
          o('clientes', 'Clientes y seguimiento', 'Clientes e acompanhamento', 'Customers and follow-up'),
          o('stock', 'Stock e inventario', 'Estoque e inventário', 'Stock and inventory'),
          o('compras', 'Compras y proveedores', 'Compras e fornecedores', 'Purchasing and suppliers'),
          o('facturacion', 'Facturación y cobranzas', 'Faturamento e cobranças', 'Invoicing and collections'),
          o('personal', 'Personal', 'Pessoal / RH', 'Staff / HR'),
          o('produccion', 'Producción', 'Produção', 'Production'),
          o('proyectos', 'Proyectos y servicios', 'Projetos e serviços', 'Projects and services'),
          o('atencion', 'Turnos, reservas o atención al público', 'Agendamentos, reservas ou atendimento ao público', 'Appointments, bookings or customer service'),
        ],
      },
      { services: ['gestion', 'desarrollo', 'consultoria'], requiredFor: ['gestion'], showIf: NOT_PERSONAL },
    ),
    {
      // Intentos previos: lo que ya se probó y por qué no funcionó dice más de los riesgos que cualquier otra pregunta.
      id: 'x_intentos', type: 'single', required: true, showIf: { all: [DIAGNOSIS, NOT_PERSONAL] },
      short: t('Intentos anteriores', 'Tentativas anteriores', 'Previous attempts'),
      label: t('¿Ya intentaron resolverlo antes?', 'Já tentaram resolver isso antes?', 'Have you tried to solve this before?'),
      variants: [
        { when: profileIs('independiente'), label: t('¿Ya intentó resolverlo antes?', 'Já tentou resolver isso antes?', 'Have you tried to solve this before?') },
        { when: profileIs('proyecto'), label: t('¿Ya empezó a construirlo, o trabajó con alguien en esto?', 'Já começou a construí-lo, ou trabalhou com alguém nisso?', 'Have you started building it, or worked with anyone on it?') },
      ],
      options: [
        o('no', 'No, es la primera vez', 'Não, é a primeira vez', 'No, this is the first time'),
        o('propio', 'Sí, por nuestra cuenta', 'Sim, por conta própria', 'Yes, on our own'),
        o('proveedor', 'Sí, con otro proveedor o sistema', 'Sim, com outro fornecedor ou sistema', 'Yes, with another provider or system'),
        o('curso', 'Hay algo en marcha que no nos convence', 'Há algo em andamento que não nos convence', "There's something underway we're not happy with"),
      ],
    },
    ...withOther(
      {
        id: 'x_intentos_falla', type: 'multi', showIf: is('x_intentos', 'propio', 'proveedor', 'curso'),
        label: t('¿Qué no funcionó?', 'O que não funcionou?', "What didn't work?"),
        help: t('Nos ayuda a no repetirlo.', 'Ajuda a não repetir.', 'It helps us avoid repeating it.'),
        options: [
          o('medias', 'Quedó a medias o sin terminar', 'Ficou pela metade ou sem terminar', 'It was left half done'),
          o('costo', 'Costó o tardó más de lo previsto', 'Custou ou demorou mais que o previsto', 'It cost more or took longer than planned'),
          o('uso', 'La gente no lo terminó de usar', 'As pessoas não chegaram a usar', "People didn't really use it"),
          o('ajuste', 'No se adaptaba a la forma de trabajar', 'Não se adaptava à forma de trabalhar', "It didn't fit the way we work"),
          o('respuesta', 'Nadie respondía cuando había un problema', 'Ninguém respondia quando havia um problema', 'Nobody answered when there was a problem'),
          OTHER,
        ],
      },
      SOMETHING_ELSE,
    ),
    {
      // Hacia dónde va, a 6-12 meses: el objetivo que la solución tiene que acompañar. Opcional: obligatoria juntaba relleno.
      id: 'x_objetivos', type: 'textarea', maxLength: 250, showIf: { all: [DIAGNOSIS, NOT_PERSONAL] },
      short: t('Objetivos a 6-12 meses', 'Objetivos para 6-12 meses', 'Goals for 6-12 months'),
      label: t('¿Qué le gustaría haber logrado dentro de 6 a 12 meses?', 'O que gostaria de ter alcançado daqui a 6 a 12 meses?', 'What would you like to have achieved in 6 to 12 months?'),
      help: t(
        'Pensando a mediano plazo, no solo en lo de ahora. Si todavía no lo tiene claro, puede omitirla.',
        'Pensando no médio prazo, não só no agora. Se ainda não está claro, pode pular.',
        'Think medium term, not just about today. If it is not clear yet, you can skip it.',
      ),
      placeholder: t('Ej.: cerrar el mes en un día y abrir una segunda sucursal con el mismo sistema', 'Ex.: fechar o mês em um dia e abrir uma segunda filial com o mesmo sistema', 'E.g.: close the month in one day and open a second branch on the same system'),
      variants: [
        {
          when: profileIs('independiente'),
          placeholder: t('Ej.: atender más clientes sin sumar horas de administración', 'Ex.: atender mais clientes sem somar horas de administração', 'E.g.: serve more clients without adding admin hours'),
        },
        {
          when: profileIs('proyecto'),
          label: t('¿Hasta dónde quiere llevar el proyecto en los próximos 6 a 12 meses?', 'Até onde quer levar o projeto nos próximos 6 a 12 meses?', 'How far do you want to take the project in the next 6 to 12 months?'),
          placeholder: t('Ej.: lanzar la primera versión y llegar a los primeros 100 clientes', 'Ex.: lançar a primeira versão e chegar aos primeiros 100 clientes', 'E.g.: launch the first version and reach the first 100 customers'),
        },
      ],
    },
  ],
};

/** Paso 3: con qué cuentan hoy. Lo que necesitan dos servicios o más, una sola vez (`shared`). */
export const CONTEXT_SECTION: Section = {
  id: 'contexto',
  color: '#a8b3c7',
  title: t('Cómo trabajan hoy', 'Como trabalham hoje', 'How you work today'),
  intro: t(
    'Preguntas rápidas, de opciones, para entender con qué cuentan hoy.',
    'Perguntas rápidas, de opções, para entender com o que contam hoje.',
    'Quick multiple-choice questions to understand what you have today.',
  ),
  questions: [
    shared(
      {
        id: 'x_herramientas', type: 'multi',
        short: t('Herramientas actuales', 'Ferramentas atuais', 'Current tools'),
        label: t('¿Con qué se organizan hoy?', 'Com o que se organizam hoje?', 'What do you use to get organized today?'),
        variants: [
          { when: profileIs('independiente', 'personal'), label: t('¿Con qué se organiza hoy?', 'Com o que se organiza hoje?', 'What do you use to get organized today?') },
          { when: profileIs('proyecto'), label: t('¿Usan alguna herramienta hoy para el proyecto?', 'Usam alguma ferramenta hoje no projeto?', 'Do you use any tools for the project today?') },
        ],
        options: [
          o('papel', 'Papel o cuadernos', 'Papel ou cadernos', 'Paper or notebooks'),
          o('planillas', 'Planillas (Excel, Google Sheets)', 'Planilhas (Excel, Google Sheets)', 'Spreadsheets (Excel, Google Sheets)'),
          o('mensajeria', 'WhatsApp o correo', 'WhatsApp ou e-mail', 'WhatsApp or email'),
          o('propio', 'Un sistema hecho a medida', 'Um sistema feito sob medida', 'A custom-built system'),
          o('comercial', 'Un sistema comprado o por suscripción', 'Um sistema comprado ou por assinatura', 'A purchased or subscription system'),
          o('nada', 'Todavía nada: es algo nuevo', 'Ainda nada: é algo novo', 'Nothing yet: it is something new', { exclusive: true }),
          DONT_KNOW_ALONE,
        ],
      },
      { services: ['consultoria', 'desarrollo', 'gestion', 'ia'], requiredFor: ['desarrollo', 'gestion'] },
    ),
    shared(
      {
        // Solo si hay un sistema: sin él, «mejorar o reemplazar el existente» no tiene sentido (el lead 0001 lo eligió
        // trabajando con papel y WhatsApp).
        id: 'x_sistema_actual', type: 'single',
        short: t('Sistema actual', 'Sistema atual', 'Current system'),
        label: t('¿Qué le gustaría hacer con el sistema que ya usan?', 'O que gostaria de fazer com o sistema que já usam?', 'What would you like to do with the system you already use?'),
        options: [
          o('mejorar', 'Mejorarlo o ampliarlo', 'Melhorá-lo ou ampliá-lo', 'Improve or extend it'),
          o('reemplazar', 'Reemplazarlo por otro', 'Substituí-lo por outro', 'Replace it'),
          o('conectar', 'Mantenerlo y conectarlo con lo nuevo', 'Mantê-lo e conectá-lo ao novo', 'Keep it and connect it to the new one'),
          o('nose', 'Todavía no lo sé', 'Ainda não sei', "I'm not sure yet"),
        ],
      },
      { services: ['desarrollo', 'gestion'], requiredFor: ['desarrollo', 'gestion'], showIf: is('x_herramientas', 'propio', 'comercial') },
    ),
    ...withOther(
      shared(
        {
          // La necesidad de integrar, contada como síntoma: datos cargados dos veces o pasados a mano.
          id: 'x_integraciones', type: 'multi', maxChoices: 3,
          short: t('Datos cargados dos veces', 'Dados digitados duas vezes', 'Data entered twice'),
          label: t(
            '¿Hay datos que se cargan dos veces o se pasan a mano de un lugar a otro?',
            'Há dados digitados duas vezes ou passados à mão de um lugar para outro?',
            'Is any data entered twice, or copied by hand from one place to another?',
          ),
          help: t(
            'Por ejemplo, copiar a mano las ventas de la tienda online a la facturación. Marque dónde pasa más.',
            'Por exemplo, copiar à mão as vendas da loja online para o faturamento. Marque onde mais acontece.',
            'For example, copying online store sales into invoicing by hand. Mark where it happens most.',
          ),
          options: [
            o('tienda', 'Tienda online o marketplace', 'Loja online ou marketplace', 'Online store or marketplace'),
            o('facturacion', 'Facturación electrónica', 'Nota fiscal eletrônica', 'E-invoicing'),
            o('pagos', 'Banco o medios de pago', 'Banco ou meios de pagamento', 'Bank or payment providers'),
            o('mensajeria', 'WhatsApp o correo', 'WhatsApp ou e-mail', 'WhatsApp or email'),
            o('planillas', 'Planillas', 'Planilhas', 'Spreadsheets'),
            o('contable', 'Sistema contable o contador', 'Sistema contábil ou contador', 'Accounting software or accountant'),
            o('ninguna', 'No: cada dato se carga una sola vez', 'Não: cada dado é digitado uma só vez', 'No: each piece of data is entered once', { exclusive: true }),
            DONT_KNOW_ALONE,
            OTHER,
          ],
        },
        { services: ['gestion', 'desarrollo', 'ia'] },
      ),
      t('Otro lugar: ¿cuál?', 'Outro lugar: qual?', 'Somewhere else: where?'),
    ),
    shared(
      {
        // Mismos rangos que el tamaño (los de Frappe): se pueden comparar. Los de afuera van aparte (visitantes web, clientes).
        id: 'x_usuarios_int', type: 'single',
        short: t('Usuarios del equipo', 'Usuários da equipe', 'Team users'),
        label: t('¿Cuántas personas de su equipo usarían el sistema?', 'Quantas pessoas da sua equipe usariam o sistema?', 'How many people on your team would use the system?'),
        options: PEOPLE_RANGES,
      },
      { services: ['desarrollo', 'gestion'], requiredFor: ['desarrollo', 'gestion'], showIf: NOT_PERSONAL },
    ),
    shared(
      {
        id: 'x_usuarios_ext', type: 'single',
        short: t('Usuarios de afuera', 'Usuários de fora', 'Outside users'),
        label: t('¿También usarían el sistema clientes, alumnos u otras personas de afuera?', 'Clientes, alunos ou outras pessoas de fora também usariam o sistema?', 'Would customers, students or other outside people use the system too?'),
        help: t(
          'Por ejemplo, clientes que hacen pedidos o reservan turnos desde la web.',
          'Por exemplo, clientes que fazem pedidos ou agendam horários pelo site.',
          'For example, customers placing orders or booking appointments online.',
        ),
        options: [
          o('no', 'No, solo uso interno', 'Não, só uso interno', 'No, internal use only'),
          o('hasta-100', 'Sí, hasta 100 por mes', 'Sim, até 100 por mês', 'Yes, up to 100 a month'),
          o('100-1000', 'Sí, de 100 a 1.000 por mes', 'Sim, de 100 a 1.000 por mês', 'Yes, 100 to 1,000 a month'),
          o('1000+', 'Sí, más de 1.000 por mes', 'Sim, mais de 1.000 por mês', 'Yes, more than 1,000 a month'),
          o('nose', 'Sí, pero no sé cuántos', 'Sim, mas não sei quantos', "Yes, but I don't know how many"),
        ],
      },
      { services: ['desarrollo', 'gestion'], requiredFor: ['desarrollo'] },
    ),
    shared(
      {
        id: 'x_sedes', type: 'single',
        short: t('Lugares de trabajo', 'Locais de trabalho', 'Work locations'),
        label: t('¿Desde cuántos lugares trabajan?', 'De quantos locais trabalham?', 'How many locations do you work from?'),
        variants: [{ when: profileIs('independiente'), label: t('¿Desde cuántos lugares trabaja?', 'De quantos locais trabalha?', 'How many locations do you work from?') }],
        options: [
          o('1', 'Uno', 'Um', 'One'),
          o('2-3', '2 o 3', '2 ou 3', '2 or 3'),
          o('4-10', '4 a 10', '4 a 10', '4 to 10'),
          o('10+', 'Más de 10', 'Mais de 10', 'More than 10'),
          o('remoto', 'Ninguno fijo: trabajamos a distancia', 'Nenhum fixo: trabalhamos remotamente', 'No fixed place: we work remotely'),
        ],
      },
      { services: ['infraestructura', 'gestion', 'soporte'], requiredFor: ['infraestructura'], showIf: NOT_PERSONAL },
    ),
    shared(
      {
        // Equipos, no personas: una persona sola puede tener un servidor y diez cámaras.
        id: 'x_equipos', type: 'single',
        short: t('Equipos', 'Equipamentos', 'Devices'),
        label: t('¿Cuántos equipos hay en total (computadoras, servidores, impresoras)?', 'Quantos equipamentos há no total (computadores, servidores, impressoras)?', 'How many devices are there in total (computers, servers, printers)?'),
        options: [
          o('1-10', '1 a 10', '1 a 10', '1 to 10'),
          o('11-50', '11 a 50', '11 a 50', '11 to 50'),
          o('51-200', '51 a 200', '51 a 200', '51 to 200'),
          o('200+', 'Más de 200', 'Mais de 200', 'More than 200'),
        ],
      },
      { services: ['infraestructura', 'soporte'], requiredFor: ['infraestructura'], showIf: NOT_PERSONAL },
    ),
    shared(
      {
        // Capacidad propia: quién sostiene la solución después. Decide qué tan autónoma tiene que ser (y si hace falta soporte).
        id: 'x_responsable', type: 'single',
        short: t('Quién se ocupa de la tecnología', 'Quem cuida da tecnologia', 'Who handles technology'),
        label: t('¿Quién se ocupa hoy de la tecnología?', 'Quem cuida da tecnologia hoje?', 'Who looks after technology today?'),
        help: t(
          'Computadoras, sistemas, internet: quién lo resuelve cuando hace falta.',
          'Computadores, sistemas, internet: quem resolve quando é preciso.',
          'Computers, systems, internet: who sorts it out when needed.',
        ),
        variants: [
          { when: profileIs('independiente'), label: t('¿Quién lo ayuda hoy con la tecnología?', 'Quem ajuda você hoje com a tecnologia?', 'Who helps you with technology today?') },
          { when: profileIs('proyecto'), label: t('¿Quién se ocupa de la parte técnica del proyecto?', 'Quem cuida da parte técnica do projeto?', 'Who handles the technical side of the project?') },
        ],
        options: [
          o('nadie', 'Nadie en particular: nos arreglamos como podemos', 'Ninguém em particular: nos viramos como dá', 'No one in particular: we manage as best we can'),
          o('interno', 'Alguien de adentro que sabe, además de su trabajo', 'Alguém de dentro que entende, além do próprio trabalho', 'Someone inside who knows, on top of their job'),
          o('externo', 'Un técnico o una empresa de afuera', 'Um técnico ou uma empresa de fora', 'An outside technician or company'),
          o('sistemas', 'Una persona o un área dedicada a sistemas', 'Uma pessoa ou área dedicada a sistemas', 'A dedicated IT person or team'),
        ],
      },
      {
        services: ['consultoria', 'desarrollo', 'gestion', 'infraestructura', 'ia', 'soporte'],
        requiredFor: ['desarrollo', 'gestion', 'infraestructura'],
        showIf: NOT_PERSONAL,
      },
    ),
  ],
};

export const CLOSING_SECTION: Section = {
  id: 'cierre',
  color: '#ffe27a',
  title: t('Alcance y reunión', 'Alcance e reunião', 'Scope and meeting'),
  intro: t(
    'Para ver juntos qué es viable y cómo encararlo. La propuesta la definimos en la reunión.',
    'Para vermos juntos o que é viável e como encarar. A proposta definimos na reunião.',
    'To work out together what is feasible and how to approach it. We will shape the proposal in the meeting.',
  ),
  questions: [
    {
      // Con Soporte solo, el alcance ya lo dice `s_tipo` (reparación puntual o mantenimiento periódico).
      id: 'e_alcance', type: 'single', required: true, showIf: DIAGNOSIS,
      short: t('Alcance', 'Alcance', 'Scope'),
      label: t('¿Qué alcance imagina para este trabajo?', 'Que alcance imagina para este trabalho?', 'What scope do you have in mind?'),
      help: t(
        'Si todavía no lo sabe, elija «Todavía no lo sé»: lo vemos juntos en la reunión.',
        'Se ainda não sabe, escolha «Ainda não sei»: vemos juntos na reunião.',
        'If you don\'t know yet, choose "I\'m not sure yet": we will work it out in the meeting.',
      ),
      options: [
        o('puntual', 'Resolver algo puntual', 'Resolver algo pontual', 'Solve one specific thing'),
        o('etapa', 'Una primera etapa, y después ver', 'Uma primeira etapa, e depois ver', 'A first phase, then see'),
        o('completo', 'Un proyecto completo, de principio a fin', 'Um projeto completo, do início ao fim', 'A complete project, start to finish'),
        o('continuo', 'Acompañamiento continuo', 'Acompanhamento contínuo', 'Ongoing support'),
        o('nose', 'Todavía no lo sé', 'Ainda não sei', "I'm not sure yet"),
      ],
    },
    {
      id: 'e_plazo', type: 'single', required: true, showIf: { not: SUPPORT_EMERGENCY_ONLY },
      label: t('¿Para cuándo lo necesita?', 'Para quando precisa?', 'When do you need it?'),
      variants: [{
        when: is('s_tipo', 'emergencia'),
        label: t('Además de la emergencia, ¿para cuándo necesita lo demás?', 'Além da emergência, para quando precisa do resto?', 'Besides the emergency, when do you need the rest?'),
      }],
      options: [
        o('ya', 'Lo antes posible', 'O quanto antes', 'As soon as possible'),
        o('semanas', 'En las próximas semanas', 'Nas próximas semanas', 'In the coming weeks'),
        o('meses', 'En los próximos meses', 'Nos próximos meses', 'In the coming months'),
        o('explorando', 'Estoy explorando opciones', 'Estou explorando opções', "I'm exploring options"),
      ],
    },
    {
      id: 'e_presupuesto', type: 'single', showIf: { not: SUPPORT_EMERGENCY_ONLY },
      label: t('¿Hay un presupuesto asignado?', 'Há um orçamento definido?', 'Is there a budget assigned?'),
      options: [
        o('si', 'Sí', 'Sim', 'Yes'),
        o('aun', 'Todavía no', 'Ainda não', 'Not yet'),
        o('reunion', 'Prefiero conversarlo en la reunión', 'Prefiro conversar na reunião', "I'd rather discuss it in the meeting"),
      ],
    },
    {
      // Un independiente o un particular decide solo: preguntarlo sería deducible del perfil.
      id: 'e_decisor', type: 'single',
      showIf: { all: [{ not: SUPPORT_EMERGENCY_ONLY }, { not: profileIs('independiente', 'personal') }] },
      label: t('¿Quién toma la decisión final?', 'Quem toma a decisão final?', 'Who makes the final decision?'),
      options: [
        o('yo', 'Yo', 'Eu', 'Me'),
        o('conjunta', 'Junto con socios o la dirección', 'Junto com sócios ou a diretoria', 'Together with partners or management'),
        o('otra', 'Otra persona', 'Outra pessoa', 'Someone else'),
      ],
    },
    {
      // Viabilidad: un sistema o un cambio de procesos necesita a alguien del lado del cliente que explique y pruebe.
      id: 'e_dedicacion', type: 'single', showIf: { all: [{ services: ['desarrollo', 'gestion', 'ia'] }, NOT_PERSONAL] },
      short: t('Tiempo de su lado', 'Tempo do seu lado', 'Time on their side'),
      label: t('¿Cuánto tiempo podrían dedicarle de su lado?', 'Quanto tempo poderiam dedicar do seu lado?', 'How much time could your side put into it?'),
      variants: [{ when: profileIs('independiente', 'proyecto'), label: t('¿Cuánto tiempo podría dedicarle usted?', 'Quanto tempo você poderia dedicar?', 'How much time could you put into it?') }],
      help: t(
        'Para que salga bien, alguien de su lado tiene que contar cómo trabajan y probar lo que se hace.',
        'Para dar certo, alguém do seu lado precisa contar como trabalham e testar o que é feito.',
        'For it to work, someone on your side needs to explain how you work and try out what gets built.',
      ),
      options: [
        o('varias', 'Varias horas por semana', 'Várias horas por semana', 'Several hours a week'),
        o('pocas', 'Unas pocas horas por semana', 'Poucas horas por semana', 'A few hours a week'),
        o('minimo', 'Muy poco: preferimos que se encarguen ustedes', 'Muito pouco: preferimos que vocês cuidem disso', "Very little: we'd rather you handle it"),
        DONT_KNOW,
      ],
    },
    {
      // Los riesgos que ve el cliente: se planifica para evitarlos y se habla de ellos en la reunión.
      id: 'e_preocupaciones', type: 'multi', maxChoices: 3, showIf: { all: [DIAGNOSIS, NOT_PERSONAL] },
      short: t('Preocupaciones', 'Preocupações', 'Concerns'),
      label: t('¿Qué le preocupa de encarar esto?', 'O que preocupa você em encarar isso?', 'What worries you about taking this on?'),
      help: t('Lo tenemos en cuenta para planificar.', 'Levamos em conta ao planejar.', 'We take it into account when planning.'),
      options: [
        o('costo', 'Cuánto va a costar', 'Quanto vai custar', 'How much it will cost'),
        o('tiempo', 'Cuánto va a tardar', 'Quanto vai demorar', 'How long it will take'),
        o('adopcion', 'Que la gente no lo use', 'Que as pessoas não usem', "That people won't use it"),
        o('frenar', 'Frenar el trabajo durante el cambio', 'Parar o trabalho durante a mudança', 'Work stopping during the change'),
        o('datos', 'Perder información en el cambio', 'Perder informações na mudança', 'Losing information in the change'),
        o('funcione', 'No saber si la idea va a funcionar', 'Não saber se a ideia vai funcionar', 'Not knowing whether the idea will work'),
        o('proveedor', 'Quedar atado a un proveedor', 'Ficar preso a um fornecedor', 'Being locked in to a provider'),
        o('nada', 'Nada en particular', 'Nada em particular', 'Nothing in particular', { exclusive: true }),
      ],
    },
    {
      id: 'e_horario', type: 'multi', showIf: { not: SUPPORT_EMERGENCY_ONLY },
      short: t('Horario', 'Horário', 'Time'),
      label: t('Franja preferida para la videollamada', 'Horário preferido para a videochamada', 'Preferred time for the video call'),
      help: t('En la hora de donde usted está.', 'No horário de onde você está.', 'In the time zone where you are.'),
      options: [
        o('manana', 'Mañana', 'Manhã', 'Morning'),
        o('mediodia', 'Mediodía', 'Meio-dia', 'Midday'),
        o('tarde', 'Tarde', 'Tarde', 'Afternoon'),
        o('noche', 'Noche', 'Noite', 'Evening'),
      ],
    },
    {
      id: 'e_plataforma', type: 'single', showIf: { not: SUPPORT_EMERGENCY_ONLY },
      short: t('Plataforma', 'Plataforma', 'Platform'),
      label: t('¿Por dónde prefiere la videollamada?', 'Por onde prefere a videochamada?', 'Where would you prefer the video call?'),
      options: [
        o('meet', 'Google Meet', 'Google Meet', 'Google Meet'),
        o('zoom', 'Zoom', 'Zoom', 'Zoom'),
        o('teams', 'Microsoft Teams', 'Microsoft Teams', 'Microsoft Teams'),
        o('whatsapp', 'Videollamada de WhatsApp', 'Videochamada do WhatsApp', 'WhatsApp video call'),
        o('indistinto', 'Indistinto', 'Tanto faz', 'Either'),
      ],
    },
  ],
};

/** Trabajo en el lugar: Infraestructura siempre; Soporte si la atención puede ser presencial. */
const ON_SITE: Condition = { any: [{ services: ['infraestructura'] }, { all: [{ services: ['soporte'] }, is('s_modalidad', 'presencial', 'indistinto')] }] };

/**
 * Último paso: quién es y cómo ubicarlo. Se pide al final, cuando el cliente ya invirtió en responder.
 * Los topes propios (`maxLength`) son los de cada dato (un teléfono, una ciudad) y además mantienen el peor caso de un
 * servicio por debajo del largo seguro del enlace de WhatsApp (tests/qa-flow.test.ts).
 */
export const CONTACT_SECTION: Section = {
  id: 'contacto',
  color: '#e8edf4',
  title: t('Datos de contacto', 'Dados de contato', 'Contact details'),
  intro: t(
    'Último paso. Déjenos al menos un correo o un teléfono, por si el mensaje de WhatsApp no llega.',
    'Último passo. Deixe pelo menos um e-mail ou um telefone, caso a mensagem de WhatsApp não chegue.',
    "Last step. Leave at least an email or a phone number, in case the WhatsApp message doesn't arrive.",
  ),
  questions: [
    { id: 'p_nombre', type: 'text', required: true, autoComplete: 'name', label: t('Nombre y apellido', 'Nome e sobrenome', 'Full name') },
    {
      id: 'p_org', type: 'text', autoComplete: 'organization', showIf: NOT_PERSONAL,
      label: t('Nombre de la empresa', 'Nome da empresa', 'Company name'),
      variants: [
        { when: profileIs('organizacion'), label: t('Nombre de la organización', 'Nome da organização', 'Organization name') },
        { when: profileIs('independiente'), label: t('Nombre comercial (si tiene)', 'Nome comercial (se tiver)', 'Business name (if any)') },
        { when: profileIs('proyecto'), label: t('Nombre del proyecto (si ya tiene)', 'Nome do projeto (se já tiver)', 'Project name (if it has one)') },
      ],
    },
    {
      id: 'p_web', type: 'text', format: 'url', maxLength: 100, autoComplete: 'url', inputMode: 'url', showIf: NOT_PERSONAL,
      short: t('Web o red social', 'Site ou rede social', 'Website or social'),
      label: t('Sitio web o red social (si tiene)', 'Site ou rede social (se tiver)', 'Website or social media (if any)'),
      placeholder: t('empresa.com o @empresa', 'empresa.com.br ou @empresa', 'company.com or @company'),
    },
    {
      id: 'p_ubicacion', type: 'text', maxLength: 80, autoComplete: 'address-level2', required: ON_SITE,
      label: t('Ciudad y país', 'Cidade e país', 'City and country'),
      help: t('La usamos para coordinar el horario de la reunión.', 'Usamos para combinar o horário da reunião.', 'We use it to schedule the meeting at a good time for you.'),
      placeholder: t('Ej.: Rosario, Argentina', 'Ex.: Porto Alegre, Brasil', 'E.g.: Austin, United States'),
      variants: [{ when: ON_SITE, help: t('La necesitamos para ir a atenderlo.', 'Precisamos dela para ir atendê-lo.', 'We need it to come and help you on site.') }],
    },
    {
      id: 'p_correo', type: 'text', format: 'email', autoComplete: 'email', inputMode: 'email',
      label: t('Correo electrónico', 'E-mail', 'Email'),
      placeholder: t('nombre@empresa.com', 'nome@empresa.com', 'name@company.com'),
    },
    {
      // Al menos un medio de contacto: sin correo, el teléfono pasa a ser obligatorio (el lead 0001 quedó sin ninguno).
      id: 'p_telefono', type: 'text', format: 'phone', maxLength: 25, autoComplete: 'tel', inputMode: 'tel',
      short: t('Teléfono', 'Telefone', 'Phone'),
      required: { not: { answered: 'p_correo' } },
      label: t('Teléfono o WhatsApp, con código de país', 'Telefone ou WhatsApp, com código do país', 'Phone or WhatsApp, with country code'),
      help: t('Solo por si el correo no llega.', 'Só para o caso de o e-mail não chegar.', 'Just in case the email does not reach you.'),
      placeholder: t('+54 9 11 1234 5678', '+55 11 91234 5678', '+1 512 555 0100'),
      variants: [{
        when: { not: { answered: 'p_correo' } },
        help: t('Como no dejó correo, necesitamos un teléfono para contactarlo.', 'Como não deixou e-mail, precisamos de um telefone para contatá-lo.', 'Since you left no email, we need a phone number to reach you.'),
      }],
    },
  ],
};

export function getService(id: ServiceId): Service {
  const svc = SERVICES.find((s) => s.id === id);
  if (!svc) throw new Error(`Servicio desconocido: ${id}`);
  return svc;
}

export function isServiceId(value: string): value is ServiceId {
  return SERVICES.some((s) => s.id === value);
}

export function serviceToSection(svc: Service): Section {
  return { id: `svc:${svc.id}`, title: svc.title, intro: svc.stepIntro, color: svc.color, questions: svc.questions };
}

/** Secciones comunes antes y después de las de los servicios. */
export const SECTIONS_BEFORE_SERVICES = [INQUIRY_SECTION, DIAGNOSIS_SECTION, CONTEXT_SECTION];
export const SECTIONS_AFTER_SERVICES = [CLOSING_SECTION, CONTACT_SECTION];

/**
 * Todas las preguntas que PUEDE tener el recorrido de esos servicios, sin resolver condiciones: su consulta → qué está
 * pasando → cómo trabajan hoy → un paso por servicio (en orden del catálogo) → alcance y reunión → contacto.
 */
export function layoutSections(selected: readonly ServiceId[]): Section[] {
  const ordered = SERVICES.filter((s) => selected.includes(s.id));
  return [...SECTIONS_BEFORE_SERVICES, ...ordered.map(serviceToSection), ...SECTIONS_AFTER_SERVICES];
}

/** Preguntas posibles del recorrido (para sanear un estado guardado sin perder respuestas que vuelvan a mostrarse). */
export function allQuestions(selected: readonly ServiceId[]): Question[] {
  return layoutSections(selected).flatMap((section) => section.questions);
}

/** La pregunta tal como se muestra en este contexto: texto de la variante que corresponda y `required` ya decidido. */
export function resolveQuestion(question: Question, ctx: ConditionContext): Question {
  const { showIf: _showIf, variants = [], ...rest } = question;
  const matching = variants.filter((v) => evaluate(v.when, ctx));
  const pick = <K extends 'label' | 'placeholder' | 'help'>(key: K) => matching.find((v) => v[key])?.[key] ?? question[key];
  const required = typeof question.required === 'object' ? evaluate(question.required, ctx) : question.required === true;
  return { ...rest, label: pick('label') as L10n, placeholder: pick('placeholder'), help: pick('help'), required };
}

/**
 * Las secciones del recorrido para estas respuestas, en orden: solo las preguntas visibles, ya resueltas, y sin secciones
 * vacías. Cada condición se evalúa con las respuestas de las preguntas visibles ANTERIORES: una respuesta que quedó de una
 * pregunta ahora oculta no cuenta, ni para lo que sigue ni para el envío.
 */
export function buildSections(selected: readonly ServiceId[], answers: Answers = {}): Section[] {
  const effective: Answers = {};
  const out: Section[] = [];
  for (const section of layoutSections(selected)) {
    const questions: Question[] = [];
    for (const question of section.questions) {
      const ctx = { services: selected, answers: effective };
      if (question.showIf && !evaluate(question.showIf, ctx)) continue;
      questions.push(resolveQuestion(question, ctx));
      if (answers[question.id] !== undefined) effective[question.id] = answers[question.id];
    }
    if (questions.length) out.push({ ...section, questions });
  }
  return out;
}

export type { Question };
