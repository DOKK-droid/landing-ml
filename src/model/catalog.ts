/* ============================================================
 * MODELO — Catálogo de servicios y preguntas del relevamiento (v4).
 * Agregar o editar un servicio/pregunta = editar este archivo. Lenguaje de stakeholder: sin tecnicismos.
 *
 * Cómo está pensado (detalle y matriz en docs/RELEVAMIENTO.md):
 *   · Un concepto, un id, un lugar. Lo que necesitan dos servicios o más está en «Situación actual» (`CONTEXT_SECTION`),
 *     antes de los servicios, y dice para qué servicios se pregunta y para cuáles es obligatorio (`shared`). Cada servicio
 *     solo trae lo propio: así nada se pregunta dos veces, aunque se elijan varios servicios.
 *   · Sirve para cualquier perfil (empresa, organización, independiente, proyecto, uso personal): la primera pregunta es
 *     `p_perfil` y las demás cambian de texto (`variants`) o no se hacen (`showIf`) según la respuesta.
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

/* ---------------------------- Condiciones de uso frecuente ---------------------------- */

export const PROFILE_QUESTION = 'p_perfil';
const is = (answer: string, ...values: string[]): Condition => ({ answer, in: values });
const profileIs = (...profiles: string[]): Condition => is(PROFILE_QUESTION, ...profiles);
const NOT_PERSONAL: Condition = { not: profileIs('personal') };
const ONLY_SUPPORT: Condition = { onlyServices: ['soporte'] };
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
      'Para preparar la reunión es útil conocer qué consulta o proyecto tiene en mente, cómo se resuelve hoy y qué decisión debe tomar.',
      'Para preparar a reunião, ajuda saber que consulta ou projeto você tem em mente, como isso é resolvido hoje e que decisão precisa ser tomada.',
      'To prepare the meeting, it helps to know what question or project you have in mind, how it is handled today and what decision you need to make.',
    ),
    stepIntro: t(
      'Para preparar la reunión: por qué consulta y qué espera obtener.',
      'Para preparar a reunião: por que está consultando e o que espera obter.',
      'To prepare the meeting: why you are reaching out and what you hope to get.',
    ),
    questions: [
      ...withOther(
        {
          id: 'c_motivo', type: 'multi', required: true,
          label: t('¿Qué lo lleva a consultar?', 'O que o leva a consultar?', 'What brings you here?'),
          options: [
            o('tiempo', 'Se pierde tiempo o dinero en tareas repetitivas', 'Perde-se tempo ou dinheiro em tarefas repetitivas', 'Time or money is lost on repetitive tasks'),
            o('info', 'Falta información clara para decidir', 'Faltam informações claras para decidir', 'There is no clear information to decide'),
            o('sistemas', 'Las herramientas actuales ya no alcanzan', 'As ferramentas atuais já não são suficientes', 'Current tools are no longer enough'),
            o('ordenar', 'Hay que ordenar procesos o la forma de trabajar', 'É preciso organizar processos ou a forma de trabalhar', 'Processes or ways of working need organizing'),
            o('crecer', 'Estamos creciendo y queremos prepararnos', 'Estamos crescendo e queremos nos preparar', "We're growing and want to be ready"),
            o('idea', 'Tengo una idea o un proyecto y quiero una opinión técnica', 'Tenho uma ideia ou um projeto e quero uma opinião técnica', 'I have an idea or a project and want a technical opinion'),
            o('duda', 'Tengo una duda técnica puntual (sistemas, integraciones o IA)', 'Tenho uma dúvida técnica pontual (sistemas, integrações ou IA)', 'I have a specific technical question (systems, integrations or AI)'),
            OTHER,
          ],
        },
        t('Otro motivo: ¿cuál?', 'Outro motivo: qual?', 'Other reason: what is it?'),
      ),
      ...withOther(
        {
          // Con solo una duda puntual, lo que se lleva es la respuesta: preguntarlo sería pedir dos veces lo mismo.
          id: 'c_entregable', type: 'multi', required: true,
          showIf: { not: { answer: 'c_motivo', only: ['duda'] } },
          label: t('¿Qué le gustaría llevarse de la consultoría?', 'O que gostaria de obter da consultoria?', 'What would you like to get out of the consultation?'),
          options: [
            o('viabilidad', 'Saber si es viable y si conviene', 'Saber se é viável e se vale a pena', 'Whether it is feasible and worth it'),
            o('costos', 'Una estimación de costos y plazos', 'Uma estimativa de custos e prazos', 'An estimate of cost and timeline'),
            o('tecnologia', 'Qué tecnología o herramientas conviene usar', 'Que tecnologia ou ferramentas usar', 'Which technology or tools to use'),
            o('plan', 'Un plan con prioridades: por dónde empezar', 'Um plano com prioridades: por onde começar', 'A prioritized plan: where to start'),
            o('revisar', 'Revisar una propuesta o un sistema que ya tengo', 'Revisar uma proposta ou um sistema que já tenho', 'A review of a proposal or system I already have'),
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
      'Es útil conocer qué problema debe resolver el sistema, quién lo utilizará y qué funciones son indispensables.',
      'Ajuda saber que problema o sistema deve resolver, quem vai usá-lo e o que ele precisa fazer obrigatoriamente.',
      'It helps to know what problem the system must solve, who will use it and what it absolutely has to do.',
    ),
    stepIntro: t(
      'Sobre el sistema que necesita: qué tiene que hacer y desde dónde se usaría.',
      'Sobre o sistema que você precisa: o que ele deve fazer e de onde seria usado.',
      'About the system you need: what it must do and where it would be used.',
    ),
    questions: [
      ...withOther(
        {
          // Sin pagos ni avisos por WhatsApp (son `x_integraciones`) ni turnos (es `x_areas`): cada cosa se pregunta una vez.
          id: 'd_funciones', type: 'multi',
          label: t('¿Qué funciones necesita sí o sí?', 'Quais funções precisa obrigatoriamente?', 'Which features does it absolutely need?'),
          options: [
            o('usuarios', 'Usuarios con distintos permisos', 'Usuários com permissões diferentes', 'Users with different permissions'),
            o('reportes', 'Reportes y tableros', 'Relatórios e painéis', 'Reports and dashboards'),
            o('archivos', 'Carga de archivos, fotos o documentos', 'Envio de arquivos, fotos ou documentos', 'Uploading files, photos or documents'),
            o('aprobaciones', 'Aprobaciones o firmas', 'Aprovações ou assinaturas', 'Approvals or signatures'),
            o('idiomas', 'Varios idiomas o monedas', 'Vários idiomas ou moedas', 'Multiple languages or currencies'),
            o('mapas', 'Mapas o ubicación', 'Mapas ou localização', 'Maps or location'),
            OTHER,
          ],
        },
        t('Otra función: ¿cuál?', 'Outra função: qual?', 'Other feature: what is it?'),
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
      'Es útil conocer qué áreas se desea ordenar, cómo se gestionan hoy y qué herramientas deben seguir en funcionamiento.',
      'Ajuda saber quais áreas quer organizar, como são gerenciadas hoje e quais ferramentas precisam continuar funcionando.',
      'It helps to know which areas you want to organize, how they are handled today and which tools must keep working.',
    ),
    stepIntro: t(
      'Sobre la plataforma de gestión: qué información de hoy habría que pasar al sistema nuevo.',
      'Sobre a plataforma de gestão: que informações de hoje precisariam ir para o sistema novo.',
      'About the management platform: which of your current information would move to the new system.',
    ),
    questions: [
      {
        // Si hoy no usan nada, no hay nada que pasar: no se pregunta.
        id: 'g_migracion', type: 'multi',
        showIf: { not: { answer: 'x_herramientas', only: ['nada'] } },
        label: t('¿Qué información habría que pasar al sistema nuevo?', 'Que informações precisariam ser levadas para o sistema novo?', 'What information would need to move to the new system?'),
        options: [
          o('clientes', 'Clientes', 'Clientes', 'Customers'),
          o('productos', 'Productos y precios', 'Produtos e preços', 'Products and prices'),
          o('stock', 'Stock', 'Estoque', 'Stock'),
          o('historial', 'Historial de ventas o facturas', 'Histórico de vendas ou notas', 'Sales or invoice history'),
          o('proveedores', 'Proveedores', 'Fornecedores', 'Suppliers'),
          o('nada', 'Nada: empezamos de cero', 'Nada: começamos do zero', 'Nothing: we start from scratch', { exclusive: true }),
          DONT_KNOW_ALONE,
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
      'Es útil conocer qué se necesita, cuántos equipos y sedes existen, y qué problemas se observan hoy.',
      'Ajuda saber o que precisa, quantos equipamentos e locais existem e quais problemas percebem hoje.',
      'It helps to know what you need, how many devices and locations there are, and what problems you notice today.',
    ),
    stepIntro: t(
      'Sobre la infraestructura: qué necesita instalar, mejorar o proteger.',
      'Sobre a infraestrutura: o que precisa instalar, melhorar ou proteger.',
      'About the infrastructure: what you need to install, improve or protect.',
    ),
    questions: [
      {
        id: 'i_necesidad', type: 'multi', required: true,
        label: t('¿Qué necesita?', 'O que precisa?', 'What do you need?'),
        options: [
          o('red', 'Instalar o renovar la red', 'Instalar ou renovar a rede', 'Install or upgrade the network'),
          o('nube', 'Pasar a la nube', 'Migrar para a nuvem', 'Move to the cloud'),
          o('servidor', 'Servidor o almacenamiento', 'Servidor ou armazenamento', 'Server or storage'),
          o('backup', 'Copias de seguridad', 'Backups', 'Backups'),
          o('seguridad', 'Mejorar la seguridad', 'Melhorar a segurança', 'Improve security'),
          o('sede', 'Equipar una oficina o sucursal nueva', 'Equipar um escritório ou filial nova', 'Set up a new office or branch'),
          o('nose', 'No estoy seguro', 'Não tenho certeza', "I'm not sure", { exclusive: true }),
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
      'Es útil conocer qué tarea se realiza hoy de forma manual, con qué frecuencia y si existen ejemplos guardados.',
      'Ajuda saber qual tarefa é feita hoje manualmente, com que frequência e se há exemplos guardados.',
      'It helps to know which task is done by hand today, how often, and whether examples have been kept.',
    ),
    stepIntro: t(
      'Sobre la inteligencia artificial: qué tarea haría, cada cuánto y si tienen ejemplos guardados.',
      'Sobre a inteligência artificial: que tarefa faria, com que frequência e se há exemplos guardados.',
      'About artificial intelligence: what task it would do, how often, and whether you have saved examples.',
    ),
    questions: [
      ...withOther(
        {
          id: 'a_objetivo', type: 'multi', required: true,
          label: t('¿Qué le gustaría que haga la IA?', 'O que gostaria que a IA fizesse?', 'What would you like the AI to do?'),
          options: [
            o('consultas', 'Responder consultas de clientes automáticamente', 'Responder dúvidas de clientes automaticamente', 'Answer customer inquiries automatically'),
            o('documentos', 'Leer facturas, formularios u otros documentos', 'Ler notas fiscais, formulários ou outros documentos', 'Read invoices, forms or other documents'),
            o('imagenes', 'Reconocer productos o situaciones en imágenes', 'Reconhecer produtos ou situações em imagens', 'Recognize products or situations in images'),
            o('resumir', 'Resumir o clasificar información', 'Resumir ou classificar informações', 'Summarize or sort information'),
            o('asistente', 'Asistir a mi equipo (buscar información, redactar)', 'Ajudar minha equipe (buscar informações, redigir)', 'Assist my team (finding information, drafting)'),
            o('prever', 'Anticipar ventas, demanda o problemas', 'Antecipar vendas, demanda ou problemas', 'Forecast sales, demand or problems'),
            OTHER,
          ],
        },
        t('Otra tarea: ¿cuál?', 'Outra tarefa: qual?', 'Other task: what is it?'),
      ),
      {
        id: 'a_volumen', type: 'single',
        label: t('¿Con qué frecuencia se haría esa tarea?', 'Com que frequência essa tarefa seria feita?', 'How often would that task be done?'),
        options: [
          o('mes', 'Algunas veces al mes', 'Algumas vezes por mês', 'A few times a month'),
          o('dia', 'Todos los días', 'Todos os dias', 'Every day'),
          o('cientos', 'Cientos de veces por día', 'Centenas de vezes por dia', 'Hundreds of times a day'),
          DONT_KNOW,
        ],
      },
      {
        id: 'a_datos', type: 'single',
        label: t('¿Tienen ejemplos o historial guardado (documentos, fotos, conversaciones)?', 'Têm exemplos ou histórico guardado (documentos, fotos, conversas)?', 'Do you have examples or a history saved (documents, photos, conversations)?'),
        options: [
          o('muchos', 'Sí, bastantes', 'Sim, bastante', 'Yes, plenty'),
          o('algunos', 'Algunos', 'Alguns', 'Some'),
          o('no', 'No', 'Não', 'No'),
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

/** Paso 1: quién consulta y qué necesita. Lo mínimo para entender el contexto, para cualquier perfil. */
export const INQUIRY_SECTION: Section = {
  id: 'consulta',
  color: '#e8edf4',
  title: t('Su consulta', 'Sua consulta', 'Your inquiry'),
  intro: t(
    'Primero, quién consulta y qué necesita. Son pocas preguntas.',
    'Primeiro, quem está consultando e do que precisa. São poucas perguntas.',
    'First, who is asking and what you need. Just a few questions.',
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
      // Qué es la empresa o el proyecto, no qué necesita: eso es `x_necesidad`, y la ayuda lo aclara para que no se mezclen.
      id: 'p_descripcion', type: 'text', required: true, showIf: NOT_PERSONAL, maxLength: 160, autoComplete: 'off',
      label: t('En una frase: ¿a qué se dedica la empresa y para quién?', 'Em uma frase: o que a empresa faz e para quem?', 'In one sentence: what does the company do, and for whom?'),
      help: t(
        'Por ejemplo: «Distribuidora de alimentos para almacenes de zona norte». Lo que necesita resolver se lo preguntamos más adelante.',
        'Por exemplo: «Distribuidora de alimentos para mercados da zona norte». O que precisa resolver perguntamos mais adiante.',
        'For example: "Food distributor supplying corner shops in the north side". We will ask what you need to solve later on.',
      ),
      placeholder: t('Escriba una frase', 'Escreva uma frase', 'Write one sentence'),
      variants: [
        {
          when: profileIs('organizacion'),
          label: t('En una frase: ¿qué hace la organización y para quién?', 'Em uma frase: o que a organização faz e para quem?', 'In one sentence: what does the organization do, and for whom?'),
          help: t(
            'Por ejemplo: «Fundación que da apoyo escolar a 300 chicos del barrio». Lo que necesita resolver se lo preguntamos más adelante.',
            'Por exemplo: «Fundação que dá reforço escolar a 300 crianças do bairro». O que precisa resolver perguntamos mais adiante.',
            'For example: "A foundation that tutors 300 local kids". We will ask what you need to solve later on.',
          ),
        },
        {
          when: profileIs('independiente'),
          label: t('En una frase: ¿a qué se dedica y para quién trabaja?', 'Em uma frase: o que você faz e para quem trabalha?', 'In one sentence: what do you do, and who do you work for?'),
          help: t(
            'Por ejemplo: «Arquitecta, hago reformas para particulares». Lo que necesita resolver se lo preguntamos más adelante.',
            'Por exemplo: «Arquiteta, faço reformas para clientes particulares». O que precisa resolver perguntamos mais adiante.',
            'For example: "Architect doing home renovations for private clients". We will ask what you need to solve later on.',
          ),
        },
        {
          when: profileIs('proyecto'),
          label: t('En una frase: ¿de qué se trata el proyecto y para quién es?', 'Em uma frase: do que se trata o projeto e para quem é?', 'In one sentence: what is the project, and who is it for?'),
          help: t(
            'Por ejemplo: «Una app para reservar turnos en peluquerías de barrio». Lo que necesita resolver se lo preguntamos más adelante.',
            'Por exemplo: «Um app para agendar horários em salões de bairro». O que precisa resolver perguntamos mais adiante.',
            'For example: "An app to book appointments at local hair salons". We will ask what you need to solve later on.',
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
    {
      // La única pregunta abierta sobre la necesidad, para todos los servicios: antes cada servicio tenía la suya y, al
      // elegir varios, la misma historia se contaba dos veces (o se repartía a ciegas entre las dos).
      id: 'x_necesidad', type: 'textarea', required: true,
      label: t('¿Qué necesita resolver o lograr?', 'O que precisa resolver ou alcançar?', 'What do you need to solve or achieve?'),
      help: t(
        'Cuéntelo con sus palabras: qué pasa hoy o qué le gustaría lograr.',
        'Conte com suas palavras: o que acontece hoje ou o que gostaria de alcançar.',
        'In your own words: what happens today, or what you would like to achieve.',
      ),
      variants: [
        { when: ONLY_SUPPORT, label: t('¿Qué necesita? Si algo falla, cuente qué pasa.', 'Do que precisa? Se algo está falhando, conte o que acontece.', 'What do you need? If something is failing, tell us what happens.') },
        {
          when: { minServices: 2 },
          help: t(
            'Eligió varios servicios: cuente todo en esta misma respuesta. Después hay unas preguntas cortas sobre cada uno.',
            'Escolheu vários serviços: conte tudo nesta mesma resposta. Depois vêm algumas perguntas curtas sobre cada um.',
            'You chose several services: describe everything in this one answer. A few short questions about each one follow.',
          ),
        },
        // Ejemplo según el primer servicio elegido (en el orden del catálogo).
        { when: { services: ['consultoria'] }, placeholder: t('Ej.: quiero saber si conviene conectar la tienda online con la facturación', 'Ex.: quero saber se vale a pena conectar a loja online ao faturamento', 'E.g.: I want to know whether to connect the online store to invoicing') },
        { when: { all: [{ services: ['desarrollo'] }, profileIs('proyecto')] }, placeholder: t('Ej.: una app donde los clientes reserven turnos y paguen online', 'Ex.: um app onde os clientes agendem horários e paguem online', 'E.g.: an app where customers book appointments and pay online') },
        { when: { services: ['desarrollo'] }, placeholder: t('Ej.: no sabemos qué stock tenemos y perdemos ventas', 'Ex.: não sabemos o estoque que temos e perdemos vendas', "E.g.: we don't know our stock and we lose sales") },
        { when: { services: ['gestion'] }, placeholder: t('Ej.: cada sucursal lleva su planilla y a fin de mes los números no cierran', 'Ex.: cada filial tem sua planilha e no fim do mês os números não batem', "E.g.: each branch keeps its own spreadsheet and the numbers don't add up at month end") },
        { when: { services: ['infraestructura'] }, placeholder: t('Ej.: internet se corta, se pierden archivos y los equipos andan lentos', 'Ex.: a internet cai, arquivos se perdem e os equipamentos estão lentos', 'E.g.: the internet drops, files get lost and computers are slow') },
        { when: { services: ['ia'] }, placeholder: t('Ej.: cargamos a mano 200 facturas de proveedores por semana', 'Ex.: digitamos manualmente 200 notas de fornecedores por semana', 'E.g.: we manually enter 200 supplier invoices a week') },
        { when: { services: ['soporte'] }, placeholder: t('Ej.: la computadora de caja no enciende desde ayer', 'Ex.: o computador do caixa não liga desde ontem', "E.g.: the checkout computer hasn't turned on since yesterday") },
      ],
    },
  ],
};

/** Paso 2: lo que necesitan dos servicios o más, una sola vez. Cada pregunta dice para qué servicios se hace (`shared`). */
export const CONTEXT_SECTION: Section = {
  id: 'contexto',
  color: '#a8b3c7',
  title: t('Situación actual', 'Situação atual', 'Current situation'),
  intro: t(
    'Unas preguntas rápidas, de opciones, sobre cómo se organizan hoy.',
    'Algumas perguntas rápidas, de opções, sobre como se organizam hoje.',
    'A few quick multiple-choice questions about how you work today.',
  ),
  questions: [
    shared(
      {
        id: 'x_herramientas', type: 'multi',
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
    shared(
      {
        id: 'x_areas', type: 'multi',
        label: t('¿Qué áreas de su trabajo tendría que cubrir el sistema?', 'Quais áreas do seu trabalho o sistema deveria cobrir?', 'Which areas of your work should the system cover?'),
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
      { services: ['gestion', 'desarrollo'], requiredFor: ['gestion'] },
    ),
    ...withOther(
      shared(
        {
          // «Otras» herramientas: el sistema actual ya tiene su pregunta, y las planillas son algo a migrar, no a conectar.
          id: 'x_integraciones', type: 'multi',
          label: t('¿Con qué otras herramientas tendría que conectarse?', 'Com quais outras ferramentas precisaria se conectar?', 'What other tools would it need to connect to?'),
          help: t(
            'Por ejemplo, que una venta en la tienda online llegue sola a la facturación.',
            'Por exemplo, que uma venda na loja online chegue sozinha ao faturamento.',
            'For example, an online store sale reaching invoicing on its own.',
          ),
          options: [
            o('tienda', 'Tienda online o marketplace', 'Loja online ou marketplace', 'Online store or marketplace'),
            o('facturacion', 'Facturación electrónica', 'Nota fiscal eletrônica', 'E-invoicing'),
            o('pagos', 'Bancos o medios de pago', 'Bancos ou meios de pagamento', 'Banks or payment providers'),
            o('whatsapp', 'WhatsApp', 'WhatsApp', 'WhatsApp'),
            o('correo', 'Correo electrónico', 'E-mail', 'Email'),
            o('contable', 'Sistema contable o del estudio contable', 'Sistema contábil ou do escritório de contabilidade', "Accounting software or your accountant's system"),
            o('ninguna', 'Con ninguna', 'Com nenhuma', 'None', { exclusive: true }),
            DONT_KNOW_ALONE,
            OTHER,
          ],
        },
        { services: ['gestion', 'desarrollo', 'ia'] },
      ),
      t('Otra herramienta: ¿cuál?', 'Outra ferramenta: qual?', 'Other tool: what is it?'),
    ),
    shared(
      {
        // Mismos rangos que el tamaño (los de Frappe): se pueden comparar. Los de afuera van aparte (visitantes web, clientes).
        id: 'x_usuarios_int', type: 'single',
        label: t('¿Cuántas personas de su equipo usarían el sistema?', 'Quantas pessoas da sua equipe usariam o sistema?', 'How many people on your team would use the system?'),
        options: PEOPLE_RANGES,
      },
      { services: ['desarrollo', 'gestion'], requiredFor: ['desarrollo', 'gestion'], showIf: NOT_PERSONAL },
    ),
    shared(
      {
        id: 'x_usuarios_ext', type: 'single',
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
  ],
};

export const CLOSING_SECTION: Section = {
  id: 'cierre',
  color: '#ffe27a',
  title: t('Objetivos y reunión', 'Objetivos e reunião', 'Goals and meeting'),
  intro: t(
    'Con esto preparamos la videollamada. La propuesta final la definimos juntos.',
    'Com isto preparamos a videochamada. A proposta final definimos juntos.',
    'This helps us prepare the video call. We will shape the final proposal together.',
  ),
  questions: [
    {
      // Con Soporte solo, el alcance ya lo dice `s_tipo` (reparación puntual o mantenimiento periódico).
      id: 'e_alcance', type: 'single', required: true, showIf: { not: ONLY_SUPPORT },
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
      id: 'e_objetivos', type: 'textarea', maxLength: 400, showIf: { all: [{ not: ONLY_SUPPORT }, NOT_PERSONAL] },
      label: t('¿Qué objetivos tiene la empresa para los próximos 6 a 12 meses?', 'Quais objetivos a empresa tem para os próximos 6 a 12 meses?', "What are the company's goals for the next 6 to 12 months?"),
      help: t(
        'Pensando a mediano plazo, no solo en lo de ahora. Si todavía no lo tiene claro, puede omitirla.',
        'Pensando no médio prazo, não só no agora. Se ainda não está claro, pode pular.',
        'Think medium term, not just about today. If it is not clear yet, you can skip it.',
      ),
      placeholder: t('Ej.: cerrar el mes en un día y abrir una segunda sucursal con el mismo sistema', 'Ex.: fechar o mês em um dia e abrir uma segunda filial com o mesmo sistema', 'E.g.: close the month in one day and open a second branch on the same system'),
      variants: [
        { when: profileIs('organizacion'), label: t('¿Qué objetivos tiene la organización para los próximos 6 a 12 meses?', 'Quais objetivos a organização tem para os próximos 6 a 12 meses?', "What are the organization's goals for the next 6 to 12 months?") },
        {
          when: profileIs('independiente'),
          label: t('¿Qué objetivos tiene para los próximos 6 a 12 meses?', 'Quais objetivos você tem para os próximos 6 a 12 meses?', 'What are your goals for the next 6 to 12 months?'),
          placeholder: t('Ej.: atender más clientes sin sumar horas de administración', 'Ex.: atender mais clientes sem somar horas de administração', 'E.g.: serve more clients without adding admin hours'),
        },
        {
          when: profileIs('proyecto'),
          label: t('¿Hasta dónde quiere llevar el proyecto en los próximos 6 a 12 meses?', 'Até onde quer levar o projeto nos próximos 6 a 12 meses?', 'How far do you want to take the project in the next 6 to 12 months?'),
          placeholder: t('Ej.: lanzar la primera versión y llegar a los primeros 100 clientes', 'Ex.: lançar a primeira versão e chegar aos primeiros 100 clientes', 'E.g.: launch the first version and reach the first 100 customers'),
        },
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
      id: 'e_horario', type: 'multi', showIf: { not: SUPPORT_EMERGENCY_ONLY },
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
export const SECTIONS_BEFORE_SERVICES = [INQUIRY_SECTION, CONTEXT_SECTION];
export const SECTIONS_AFTER_SERVICES = [CLOSING_SECTION, CONTACT_SECTION];

/**
 * Todas las preguntas que PUEDE tener el recorrido de esos servicios, sin resolver condiciones: su consulta → situación
 * actual → un paso por servicio (en orden del catálogo) → objetivos y reunión → contacto.
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
