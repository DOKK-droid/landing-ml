/* ============================================================
 * MODELO — Catálogo de servicios y preguntas del relevamiento.
 * Agregar o editar un servicio/pregunta = editar este archivo.
 * Lenguaje de stakeholder: sin tecnicismos.
 * ============================================================ */
import type { L10n, Option, Question, Section, Service, ServiceId } from './types';

const o = (id: string, es: string, pt: string, en: string): Option => ({ id, label: { es, pt, en } });
const t = (es: string, pt: string, en: string): L10n => ({ es, pt, en });

const OTHER = o('otro', 'Otro', 'Outro', 'Other');
const DONT_KNOW = o('nose', 'No lo sé', 'Não sei', "I don't know");

const PEOPLE_USING: Option[] = [
  o('1-5', '1 a 5', '1 a 5', '1 to 5'),
  o('6-20', '6 a 20', '6 a 20', '6 to 20'),
  o('21-100', '21 a 100', '21 a 100', '21 to 100'),
  o('100+', 'Más de 100', 'Mais de 100', 'More than 100'),
];

/* ---------------------------- Servicios ---------------------------- */

export const SERVICES: Service[] = [
  {
    id: 'consultoria',
    color: '#2fe6ff',
    title: t('Consultoría & Gestión', 'Consultoria & Gestão', 'Consulting & Management'),
    summary: t(
      'Analizo cómo funciona hoy su organización para detectar pérdidas, riesgos y oportunidades, y evaluar si una inversión conviene antes de hacerla.',
      'Analiso como sua organização funciona hoje para identificar perdas, riscos e oportunidades, e avaliar se um investimento vale a pena antes de fazê-lo.',
      'I analyze how your organization works today to find losses, risks and opportunities, and assess whether an investment pays off before you make it.',
    ),
    includes: [
      t('Diagnóstico de procesos y puntos de pérdida', 'Diagnóstico de processos e pontos de perda', 'Process diagnosis and loss points'),
      t('Estudio de viabilidad y retorno', 'Estudo de viabilidade e retorno', 'Feasibility and return study'),
      t('Auditoría de sistemas e información existentes', 'Auditoria de sistemas e informações existentes', 'Audit of existing systems and information'),
      t('Plan de automatización por prioridades', 'Plano de automação por prioridades', 'Prioritized automation plan'),
    ],
    needs: t(
      'Para preparar la reunión me ayuda saber qué le preocupa hoy, cómo se trabaja actualmente y qué decisión necesita tomar.',
      'Para preparar a reunião, ajuda saber o que preocupa hoje, como se trabalha atualmente e que decisão precisa ser tomada.',
      'To prepare the meeting, it helps to know what worries you today, how work is done now and what decision you need to make.',
    ),
    questions: [
      {
        id: 'c_motivo', type: 'multi', required: true,
        label: t('¿Qué lo lleva a consultar?', 'O que o leva a consultar?', 'What brings you here?'),
        options: [
          o('tiempo', 'Se pierde tiempo o dinero en tareas repetitivas', 'Perde-se tempo ou dinheiro em tarefas repetitivas', 'Time or money is lost on repetitive tasks'),
          o('info', 'No tengo información clara para decidir', 'Não tenho informações claras para decidir', "I don't have clear information to decide"),
          o('sistemas', 'Las herramientas actuales ya no alcanzan', 'As ferramentas atuais já não são suficientes', 'Current tools are no longer enough'),
          o('evaluar', 'Quiero evaluar un proyecto antes de invertir', 'Quero avaliar um projeto antes de investir', 'I want to assess a project before investing'),
          o('ordenar', 'Necesito ordenar procesos o el trabajo del equipo', 'Preciso organizar processos ou o trabalho da equipe', 'I need to organize processes or teamwork'),
          OTHER,
        ],
      },
      {
        id: 'c_situacion', type: 'textarea', required: true,
        label: t('Cuente brevemente cómo se trabaja hoy en el área que le preocupa', 'Conte brevemente como se trabalha hoje na área que o preocupa', 'Briefly describe how the area you are concerned about works today'),
        placeholder: t('Ej.: los pedidos se toman por teléfono y se anotan en planillas', 'Ex.: os pedidos são feitos por telefone e anotados em planilhas', 'E.g.: orders are taken by phone and written down in spreadsheets'),
      },
      {
        id: 'c_herramientas', type: 'multi',
        label: t('¿Con qué se trabaja hoy?', 'Com o que se trabalha hoje?', 'What do you work with today?'),
        options: [
          o('papel', 'Papel o cuadernos', 'Papel ou cadernos', 'Paper or notebooks'),
          o('planillas', 'Planillas (Excel, Google Sheets)', 'Planilhas (Excel, Google Sheets)', 'Spreadsheets (Excel, Google Sheets)'),
          o('mensajeria', 'WhatsApp o correo', 'WhatsApp ou e-mail', 'WhatsApp or email'),
          o('propio', 'Un sistema hecho a medida', 'Um sistema feito sob medida', 'A custom-built system'),
          o('comercial', 'Un sistema comprado o por suscripción', 'Um sistema comprado ou por assinatura', 'A purchased or subscription system'),
          DONT_KNOW,
        ],
      },
      {
        id: 'c_decision', type: 'textarea',
        label: t('¿Qué decisión necesita tomar o qué le gustaría poder responder?', 'Que decisão precisa tomar ou o que gostaria de poder responder?', 'What decision do you need to make, or what would you like to be able to answer?'),
        placeholder: t('Ej.: si conviene cambiar el sistema o mejorar el actual', 'Ex.: se vale a pena trocar o sistema ou melhorar o atual', 'E.g.: whether to replace the system or improve the current one'),
      },
    ],
  },
  {
    id: 'desarrollo',
    color: '#9d86ff',
    title: t('Desarrollo de Software', 'Desenvolvimento de Software', 'Software Development'),
    summary: t(
      'Diseño y construyo un sistema a la medida de su forma de trabajar, con la información ordenada y controles de calidad en cada etapa.',
      'Projeto e construo um sistema sob medida para sua forma de trabalhar, com informações organizadas e controle de qualidade em cada etapa.',
      'I design and build a system tailored to the way you work, with well-organized information and quality checks at every stage.',
    ),
    includes: [
      t('Relevamiento y modelado de su negocio', 'Levantamento e modelagem do seu negócio', 'Discovery and modeling of your business'),
      t('Sistema web, móvil o de escritorio a medida', 'Sistema web, mobile ou desktop sob medida', 'Custom web, mobile or desktop system'),
      t('Información centralizada y reportes', 'Informações centralizadas e relatórios', 'Centralized information and reports'),
      t('Entregas por etapas validadas por su equipo', 'Entregas por etapas validadas pela sua equipe', 'Staged deliveries validated by your team'),
    ],
    needs: t(
      'Me ayuda saber qué problema debe resolver el sistema, quién lo va a usar y qué tiene que hacer sí o sí.',
      'Ajuda saber que problema o sistema deve resolver, quem vai usá-lo e o que ele precisa fazer obrigatoriamente.',
      'It helps to know what problem the system must solve, who will use it and what it absolutely has to do.',
    ),
    questions: [
      {
        id: 'd_tipo', type: 'single', required: true,
        label: t('¿Qué está buscando?', 'O que está buscando?', 'What are you looking for?'),
        options: [
          o('nuevo', 'Un sistema nuevo desde cero', 'Um sistema novo do zero', 'A brand-new system'),
          o('reemplazo', 'Mejorar o reemplazar uno existente', 'Melhorar ou substituir um existente', 'Improve or replace an existing one'),
          o('clientes', 'Una app o portal para mis clientes', 'Um app ou portal para meus clientes', 'An app or portal for my customers'),
          o('nose', 'Todavía no lo sé', 'Ainda não sei', "I'm not sure yet"),
        ],
      },
      {
        id: 'd_problema', type: 'textarea', required: true,
        label: t('¿Qué problema debería resolver?', 'Que problema deveria resolver?', 'What problem should it solve?'),
        placeholder: t('Ej.: no sabemos qué stock tenemos y perdemos ventas', 'Ex.: não sabemos o estoque que temos e perdemos vendas', "E.g.: we don't know our stock and we lose sales"),
      },
      {
        id: 'd_usuarios', type: 'single',
        label: t('¿Cuántas personas lo usarían?', 'Quantas pessoas o usariam?', 'How many people would use it?'),
        options: [...PEOPLE_USING, o('publico', 'Clientes o público en general', 'Clientes ou público em geral', 'Customers or the general public')],
      },
      {
        id: 'd_imprescindible', type: 'textarea',
        label: t('¿Qué tendría que hacer sí o sí?', 'O que ele teria que fazer obrigatoriamente?', 'What must it absolutely do?'),
        placeholder: t('Ej.: controlar stock, emitir presupuestos, ver reportes del mes', 'Ex.: controlar estoque, emitir orçamentos, ver relatórios do mês', 'E.g.: track stock, issue quotes, see monthly reports'),
      },
      {
        id: 'd_dispositivos', type: 'multi',
        label: t('¿Desde dónde lo usarían?', 'De onde o usariam?', 'Where would it be used from?'),
        options: [
          o('pc', 'Computadora', 'Computador', 'Computer'),
          o('celular', 'Celular', 'Celular', 'Phone'),
          o('tablet', 'Tablet', 'Tablet', 'Tablet'),
          o('offline', 'Lugares sin internet en algún momento', 'Locais sem internet em algum momento', 'Places without internet at times'),
        ],
      },
    ],
  },
  {
    id: 'gestion',
    color: '#ff6fbf',
    title: t('Gestión & Integraciones', 'Gestão & Integrações', 'Management & Integrations'),
    summary: t(
      'Unifico la gestión de su empresa (ventas, clientes, stock, compras y facturación) en una sola plataforma, y la conecto con las herramientas que ya usa.',
      'Unifico a gestão da sua empresa (vendas, clientes, estoque, compras e faturamento) em uma só plataforma e a conecto às ferramentas que você já usa.',
      'I bring your company management (sales, customers, stock, purchasing and invoicing) into a single platform and connect it to the tools you already use.',
    ),
    includes: [
      t('Plataforma de gestión integral (ERP / CRM)', 'Plataforma de gestão integrada (ERP / CRM)', 'Integrated management platform (ERP / CRM)'),
      t('Seguimiento de clientes y comunicación', 'Acompanhamento de clientes e comunicação', 'Customer follow-up and communication'),
      t('Conexión con tienda online, facturación, bancos o WhatsApp', 'Conexão com loja online, faturamento, bancos ou WhatsApp', 'Connection to online store, invoicing, banks or WhatsApp'),
      t('Migración de la información y capacitación', 'Migração das informações e treinamento', 'Data migration and training'),
    ],
    needs: t(
      'Me ayuda saber qué áreas quiere ordenar, cómo se manejan hoy y qué herramientas tienen que seguir funcionando.',
      'Ajuda saber quais áreas quer organizar, como são gerenciadas hoje e quais ferramentas precisam continuar funcionando.',
      'It helps to know which areas you want to organize, how they are handled today and which tools must keep working.',
    ),
    questions: [
      {
        id: 'g_areas', type: 'multi', required: true,
        label: t('¿Qué áreas quiere ordenar?', 'Quais áreas quer organizar?', 'Which areas do you want to organize?'),
        options: [
          o('ventas', 'Ventas y presupuestos', 'Vendas e orçamentos', 'Sales and quotes'),
          o('clientes', 'Clientes y seguimiento', 'Clientes e acompanhamento', 'Customers and follow-up'),
          o('stock', 'Stock e inventario', 'Estoque e inventário', 'Stock and inventory'),
          o('compras', 'Compras y proveedores', 'Compras e fornecedores', 'Purchasing and suppliers'),
          o('facturacion', 'Facturación y cobranzas', 'Faturamento e cobranças', 'Invoicing and collections'),
          o('personal', 'Personal', 'Pessoal / RH', 'Staff / HR'),
          o('produccion', 'Producción', 'Produção', 'Production'),
          o('proyectos', 'Proyectos y servicios', 'Projetos e serviços', 'Projects and services'),
        ],
      },
      {
        id: 'g_actual', type: 'textarea', required: true,
        label: t('¿Cómo se manejan hoy esas áreas y qué es lo que más cuesta?', 'Como essas áreas são gerenciadas hoje e o que é mais difícil?', 'How are those areas handled today, and what is hardest?'),
        placeholder: t('Ej.: cada sucursal lleva su planilla y a fin de mes no cierran los números', 'Ex.: cada filial tem sua planilha e no fim do mês os números não batem', "E.g.: each branch keeps its own spreadsheet and the numbers don't add up at month end"),
      },
      {
        id: 'g_conectar', type: 'textarea',
        label: t('¿Hay herramientas que deban seguir funcionando o conectarse?', 'Há ferramentas que devem continuar funcionando ou ser conectadas?', 'Are there tools that must keep working or be connected?'),
        placeholder: t('Ej.: tienda online, sistema de facturación, banco', 'Ex.: loja online, sistema de faturamento, banco', 'E.g.: online store, invoicing system, bank'),
      },
      {
        id: 'g_usuarios', type: 'single',
        label: t('¿Cuántas personas trabajarían en la plataforma?', 'Quantas pessoas trabalhariam na plataforma?', 'How many people would work on the platform?'),
        options: PEOPLE_USING,
      },
    ],
  },
  {
    id: 'infraestructura',
    color: '#3b9bff',
    title: t('Infraestructura & Redes', 'Infraestrutura & Redes', 'Infrastructure & Networks'),
    summary: t(
      'Planifico y pongo en marcha la base técnica (servidores, nube, red y seguridad) para que todo funcione de forma estable y protegida.',
      'Planejo e implanto a base técnica (servidores, nuvem, rede e segurança) para que tudo funcione de forma estável e protegida.',
      'I plan and set up the technical foundation (servers, cloud, network and security) so everything runs reliably and securely.',
    ),
    includes: [
      t('Servidores propios o en la nube', 'Servidores próprios ou na nuvem', 'On-site or cloud servers'),
      t('Cableado y redes Wi-Fi', 'Cabeamento e redes Wi-Fi', 'Cabling and Wi-Fi networks'),
      t('Copias de seguridad y protección de la información', 'Backups e proteção das informações', 'Backups and information protection'),
      t('Puesta en marcha y documentación', 'Implantação e documentação', 'Setup and documentation'),
    ],
    needs: t(
      'Me ayuda saber qué necesita, cuántos equipos y lugares hay, y qué problemas notan hoy.',
      'Ajuda saber o que precisa, quantos equipamentos e locais existem e quais problemas percebem hoje.',
      'It helps to know what you need, how many devices and locations there are, and what problems you notice today.',
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
          o('nose', 'No estoy seguro', 'Não tenho certeza', "I'm not sure"),
        ],
      },
      {
        id: 'i_puestos', type: 'single',
        label: t('¿Cuántos puestos o equipos hay?', 'Quantos postos ou equipamentos existem?', 'How many workstations or devices are there?'),
        options: [
          o('1-5', '1 a 5', '1 a 5', '1 to 5'),
          o('6-20', '6 a 20', '6 a 20', '6 to 20'),
          o('21-50', '21 a 50', '21 a 50', '21 to 50'),
          o('50+', 'Más de 50', 'Mais de 50', 'More than 50'),
        ],
      },
      {
        id: 'i_sedes', type: 'single',
        label: t('¿Cuántas oficinas o sedes?', 'Quantos escritórios ou unidades?', 'How many offices or sites?'),
        options: [
          o('1', 'Una', 'Uma', 'One'),
          o('2-3', '2 o 3', '2 ou 3', '2 or 3'),
          o('4+', 'Más de 3', 'Mais de 3', 'More than 3'),
          o('remoto', 'Trabajamos a distancia', 'Trabalhamos remotamente', 'We work remotely'),
        ],
      },
      {
        id: 'i_problemas', type: 'textarea', required: true,
        label: t('¿Qué problemas notan hoy?', 'Quais problemas percebem hoje?', 'What problems do you notice today?'),
        placeholder: t('Ej.: internet que se corta, archivos que se pierden, equipos lentos', 'Ex.: internet que cai, arquivos que se perdem, equipamentos lentos', 'E.g.: internet drops, lost files, slow computers'),
      },
    ],
  },
  {
    id: 'ia',
    color: '#ffb23e',
    title: t('Inteligencia Artificial', 'Inteligência Artificial', 'Artificial Intelligence'),
    summary: t(
      'Aplico inteligencia artificial donde genera un ahorro real: leer documentos e imágenes, responder consultas, clasificar información o asistir a su equipo.',
      'Aplico inteligência artificial onde ela gera economia real: ler documentos e imagens, responder dúvidas, classificar informações ou apoiar sua equipe.',
      'I apply artificial intelligence where it creates real savings: reading documents and images, answering inquiries, sorting information or assisting your team.',
    ),
    includes: [
      t('Lectura automática de imágenes y documentos', 'Leitura automática de imagens e documentos', 'Automatic reading of images and documents'),
      t('Asistentes para clientes o para el equipo', 'Assistentes para clientes ou para a equipe', 'Assistants for customers or for your team'),
      t('Modelos entrenados con su propia información', 'Modelos treinados com suas próprias informações', 'Models trained on your own information'),
      t('Evaluación previa de factibilidad', 'Avaliação prévia de viabilidade', 'Up-front feasibility assessment'),
    ],
    needs: t(
      'Me ayuda saber qué tarea se hace hoy a mano, con qué frecuencia y si hay ejemplos guardados.',
      'Ajuda saber qual tarefa é feita hoje manualmente, com que frequência e se há exemplos guardados.',
      'It helps to know which task is done by hand today, how often, and whether examples have been kept.',
    ),
    questions: [
      {
        id: 'a_objetivo', type: 'multi', required: true,
        label: t('¿Qué le gustaría lograr?', 'O que gostaria de alcançar?', 'What would you like to achieve?'),
        options: [
          o('consultas', 'Responder consultas de clientes automáticamente', 'Responder dúvidas de clientes automaticamente', 'Answer customer inquiries automatically'),
          o('documentos', 'Leer facturas, formularios u otros documentos', 'Ler notas fiscais, formulários ou outros documentos', 'Read invoices, forms or other documents'),
          o('imagenes', 'Reconocer productos o situaciones en imágenes', 'Reconhecer produtos ou situações em imagens', 'Recognize products or situations in images'),
          o('resumir', 'Resumir o clasificar información', 'Resumir ou classificar informações', 'Summarize or sort information'),
          o('asistente', 'Un asistente para mi equipo', 'Um assistente para minha equipe', 'An assistant for my team'),
          o('prever', 'Anticipar ventas, demanda o problemas', 'Antecipar vendas, demanda ou problemas', 'Forecast sales, demand or problems'),
          OTHER,
        ],
      },
      {
        id: 'a_tarea', type: 'textarea', required: true,
        label: t('Describa la tarea que hoy se hace a mano y quiere mejorar', 'Descreva a tarefa que hoje é feita manualmente e que quer melhorar', 'Describe the task that is done by hand today and you want to improve'),
        placeholder: t('Ej.: cargamos a mano los datos de 200 facturas de proveedores por semana', 'Ex.: digitamos manualmente os dados de 200 notas de fornecedores por semana', 'E.g.: we manually enter data from 200 supplier invoices a week'),
      },
      {
        id: 'a_volumen', type: 'single',
        label: t('¿Con qué frecuencia ocurre?', 'Com que frequência acontece?', 'How often does it happen?'),
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
    title: t('Soporte & Hardware 24/7', 'Suporte & Hardware 24/7', 'Support & Hardware 24/7'),
    summary: t(
      'Reparo y optimizo equipos y sistemas, y atiendo emergencias las 24 horas para que su operación no se detenga.',
      'Conserto e otimizo equipamentos e sistemas, e atendo emergências 24 horas para que sua operação não pare.',
      'I repair and optimize equipment and systems, and handle emergencies around the clock so your operation never stops.',
    ),
    includes: [
      t('Diagnóstico y reparación de equipos', 'Diagnóstico e conserto de equipamentos', 'Equipment diagnosis and repair'),
      t('Optimización de sistemas operativos', 'Otimização de sistemas operacionais', 'Operating system optimization'),
      t('Mantenimiento preventivo', 'Manutenção preventiva', 'Preventive maintenance'),
      t('Atención de emergencias 24/7', 'Atendimento de emergências 24/7', '24/7 emergency response'),
    ],
    needs: t(
      'Me ayuda saber qué tipo de atención necesita, qué equipo está involucrado y qué está pasando.',
      'Ajuda saber que tipo de atendimento precisa, qual equipamento está envolvido e o que está acontecendo.',
      'It helps to know what kind of service you need, which equipment is involved and what is happening.',
    ),
    questions: [
      {
        id: 's_tipo', type: 'single', required: true,
        label: t('¿Qué tipo de atención necesita?', 'Que tipo de atendimento precisa?', 'What kind of service do you need?'),
        options: [
          o('emergencia', 'Una emergencia ahora', 'Uma emergência agora', 'An emergency right now'),
          o('puntual', 'Un problema puntual', 'Um problema pontual', 'A one-off problem'),
          o('periodico', 'Mantenimiento periódico', 'Manutenção periódica', 'Regular maintenance'),
        ],
      },
      {
        id: 's_equipo', type: 'multi',
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
      {
        id: 's_sintoma', type: 'textarea', required: true,
        label: t('¿Qué está pasando?', 'O que está acontecendo?', 'What is happening?'),
        placeholder: t('Ej.: la computadora de caja no enciende desde ayer', 'Ex.: o computador do caixa não liga desde ontem', "E.g.: the checkout computer hasn't turned on since yesterday"),
      },
      {
        id: 's_modalidad', type: 'single',
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

export const PROFILE_SECTION: Section = {
  id: 'perfil',
  title: t('Sobre usted y su organización', 'Sobre você e sua organização', 'About you and your organization'),
  intro: t('Para entender el contexto de su consulta.', 'Para entender o contexto da sua consulta.', 'To understand the context of your inquiry.'),
  questions: [
    { id: 'p_nombre', type: 'text', required: true, label: t('Nombre y apellido', 'Nome e sobrenome', 'Full name') },
    { id: 'p_org', type: 'text', label: t('Empresa u organización', 'Empresa ou organização', 'Company or organization') },
    {
      id: 'p_rubro', type: 'text', required: true,
      label: t('¿A qué se dedica la organización?', 'Qual é a atividade da organização?', 'What does the organization do?'),
      placeholder: t('Ej.: distribuidora de alimentos, estudio contable, clínica', 'Ex.: distribuidora de alimentos, escritório de contabilidade, clínica', 'E.g.: food distributor, accounting firm, clinic'),
    },
    {
      id: 'p_tamano', type: 'single',
      label: t('¿Cuántas personas trabajan?', 'Quantas pessoas trabalham?', 'How many people work there?'),
      options: [
        o('1', 'Solo yo', 'Só eu', 'Just me'),
        o('2-10', '2 a 10', '2 a 10', '2 to 10'),
        o('11-50', '11 a 50', '11 a 50', '11 to 50'),
        o('51-200', '51 a 200', '51 a 200', '51 to 200'),
        o('200+', 'Más de 200', 'Mais de 200', 'More than 200'),
      ],
    },
    { id: 'p_ubicacion', type: 'text', label: t('Ciudad y país', 'Cidade e país', 'City and country') },
  ],
};

export const CLOSING_SECTION: Section = {
  id: 'cierre',
  title: t('Expectativas y reunión', 'Expectativas e reunião', 'Expectations and meeting'),
  intro: t(
    'Con esto preparo la videollamada. La propuesta final la definimos juntos según lo que más le convenga.',
    'Com isso preparo a videochamada. A proposta final definimos juntos conforme o que for mais conveniente para você.',
    'This helps me prepare the video call. We will define the final proposal together, based on what suits you best.',
  ),
  questions: [
    {
      id: 'e_resultado', type: 'textarea', required: true,
      label: t('Si todo sale bien, ¿qué habría cambiado dentro de 6 meses?', 'Se tudo der certo, o que terá mudado daqui a 6 meses?', 'If everything goes well, what will have changed in 6 months?'),
      placeholder: t('Ej.: cerrar el mes en un día y no en una semana', 'Ex.: fechar o mês em um dia e não em uma semana', 'E.g.: closing the month in one day instead of a week'),
    },
    {
      id: 'e_plazo', type: 'single', required: true,
      label: t('¿Para cuándo lo necesita?', 'Para quando precisa?', 'When do you need it?'),
      options: [
        o('ya', 'Lo antes posible', 'O quanto antes', 'As soon as possible'),
        o('semanas', 'En las próximas semanas', 'Nas próximas semanas', 'In the coming weeks'),
        o('meses', 'En los próximos meses', 'Nos próximos meses', 'In the coming months'),
        o('explorando', 'Estoy explorando opciones', 'Estou explorando opções', "I'm exploring options"),
      ],
    },
    {
      id: 'e_presupuesto', type: 'single',
      label: t('¿Hay un presupuesto asignado?', 'Há um orçamento definido?', 'Is there a budget assigned?'),
      options: [
        o('si', 'Sí', 'Sim', 'Yes'),
        o('aun', 'Todavía no', 'Ainda não', 'Not yet'),
        o('reunion', 'Prefiero conversarlo en la reunión', 'Prefiro conversar na reunião', "I'd rather discuss it in the meeting"),
      ],
    },
    {
      id: 'e_decisor', type: 'single',
      label: t('¿Quién toma la decisión final?', 'Quem toma a decisão final?', 'Who makes the final decision?'),
      options: [
        o('yo', 'Yo', 'Eu', 'Me'),
        o('conjunta', 'Junto con socios o la dirección', 'Junto com sócios ou a diretoria', 'Together with partners or management'),
        o('otra', 'Otra persona', 'Outra pessoa', 'Someone else'),
      ],
    },
    {
      id: 'e_horario', type: 'multi',
      label: t('Franja preferida para la videollamada', 'Horário preferido para a videochamada', 'Preferred time for the video call'),
      options: [
        o('manana', 'Mañana', 'Manhã', 'Morning'),
        o('mediodia', 'Mediodía', 'Meio-dia', 'Midday'),
        o('tarde', 'Tarde', 'Tarde', 'Afternoon'),
        o('noche', 'Noche', 'Noite', 'Evening'),
      ],
    },
    {
      id: 'e_plataforma', type: 'single',
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

export function getService(id: ServiceId): Service {
  const svc = SERVICES.find((s) => s.id === id);
  if (!svc) throw new Error(`Servicio desconocido: ${id}`);
  return svc;
}

export function isServiceId(value: string): value is ServiceId {
  return SERVICES.some((s) => s.id === value);
}

export function serviceToSection(svc: Service): Section {
  return { id: `svc:${svc.id}`, title: svc.title, intro: svc.needs, color: svc.color, questions: svc.questions };
}

/** Pasos del relevamiento: perfil → un paso por servicio (en orden del catálogo) → cierre. */
export function buildSections(selected: ServiceId[]): Section[] {
  const ordered = SERVICES.filter((s) => selected.includes(s.id));
  return [PROFILE_SECTION, ...ordered.map(serviceToSection), CLOSING_SECTION];
}

export type { Question };
