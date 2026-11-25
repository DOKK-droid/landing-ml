/* ============================================================
 * MODELO — Textos de interfaz por idioma.
 * ============================================================ */
import type { OfferFigures } from './offer';
import type { Locale } from './types';

export interface Dictionary {
  meta: { title: string; description: string };
  /** Título y descripción de la página de tarifas (`/es/tarifas/`): lo que ven buscadores y vistas previas al compartirla. Sin cifras: salen de `site.consulta`. */
  ratesMeta: { title: string; description: string };
  role: string;
  tagline: string;
  nav: { services: string; rates: string; approach: string; contact: string; language: string };
  hero: { eyebrow: string; title: string; lead: string; cta: string; secondary: string };
  concept: { title: string; lead: string; center: string; diagram: string };
  boot: { label: string };
  emergency: { label: string; message: string };
  consulta: {
    badge: string; title: string; lead: string; billing: (minutes: number, from: string) => string;
    /** Rótulo del precio de la hora, la equivalencia por bloque y la versión corta del aviso del inicio. */
    perHour: string; hourShort: string; equals: (f: OfferFigures) => string;
    off: (percent: number) => string; srPrice: (f: OfferFigures) => string;
    /** Tarifa por tramos: título de la tabla y rótulo de cada fila. Las duraciones llegan ya formateadas ("1 h", "3 h 30 min"). */
    tiersTitle: (minutes: number) => string; tierBelow: (to: string) => string;
    tierBetween: (from: string, to: string) => string; tierFrom: (from: string) => string;
    examples: string; was: string; support: string; supportLink: string; cta: string; hero: string;
    /** La ventaja a la vista: rótulo del ahorro de un ejemplo, por qué una reunión corta no lo tiene y cuánto baja la hora entre el primer y el último tramo. */
    saving: string; noOffer: (from: string) => string; perk: (from: string, to: string, percent: number) => string;
  };
  preview: {
    title: string; hint: string; keyData: (done: number, total: number) => string; keyDone: string;
    pending: string; optional: string;
  };
  how: { title: string; steps: { t: string; d: string }[] };
  services: {
    title: string; subtitle: string; detail: string; add: string; remove: string; selected: string;
    includes: string; needs: string; hide: string;
  };
  bar: { selected: (n: number) => string; continue: string; clear: string };
  approach: { title: string; items: string[] };
  survey: {
    step: (n: number, total: number) => string; back: string; next: string; review: string;
    required: string; optional: string; fieldRequired: string; chooseOne: string; chooseAny: string; exit: string;
    section: (n: number, total: number) => string; question: (n: number, total: number) => string;
    skip: string; send: string; answerPlaceholder: string; enterHint: string; preparing: string;
  };
  review: {
    title: string; lead: string; send: string; copy: string; copied: string; edit: string;
    sent: string; restart: string; tooLong: string;
    /** Registro de la consulta en el CRM (solo si el sitio tiene la conexión activa). */
    consent: string; consentNote: string; registering: string; reference: string;
    /**
     * Bajo el widget, según cómo va la verificación: mientras Cloudflare verifica solo (`checking`), cuando pide una acción y
     * mientras falte (`verify`), cuando terminó (`verified`) o cuando no se pudo completar (`verifyFailed`).
     */
    checking: string; verify: string; verified: string; verifyFailed: string;
    /** El botón de envío mientras se verifica (no se puede tocar) y cuando la verificación falló (envía sin registro). */
    verifying: string; sendUnregistered: string;
  };
  message: {
    greeting: string; greetingNamed: (name: string) => string; title: string; ref: string; services: string;
    consult: string; consultValue: (f: OfferFigures) => string;
    origin: string; footer: string; closing: string;
    /** Marca junto a la referencia cuando la consulta (o esta versión de ella) no quedó en el CRM. */
    unregistered: string;
    /** Marca junto a la referencia cuando el CRM sumó el envío a la consulta anterior de la misma persona: «envío 2». */
    followUp: (n: number) => string;
  };
  footer: { privacy: string; /** Reemplaza a `privacy` cuando el sitio registra consultas. */ privacyCrm: string; rights: (year: number) => string; whatsapp: string; email: string; linkedin: string };
}

const es: Dictionary = {
  meta: {
    title: 'Mariano Lemos Barbaro — Arquitecto & Consultor Senior IT',
    description: 'Consultoría, desarrollo de software, gestión ERP/CRM, infraestructura, inteligencia artificial y soporte 24/7. Describa su situación y coordinaremos una videollamada.',
  },
  ratesMeta: {
    title: 'Tarifas del relevamiento técnico — Mariano Lemos Barbaro',
    description: 'Cuanto más larga la reunión, menos cuesta la hora. Tarifa por tramos de duración, ejemplos de costo total y cómo solicitar la consulta.',
  },
  role: 'Arquitecto & Consultor Senior IT',
  tagline: 'Innovación · Tecnología · Soluciones reales',
  nav: { services: 'Servicios', rates: 'Tarifas', approach: 'Enfoque', contact: 'Contacto', language: 'Idioma' },
  hero: {
    eyebrow: 'Diagnóstico · Diseño · Implementación',
    title: 'Soluciones IT que empiezan por entender su negocio',
    lead: 'Consultoría, software, gestión, infraestructura, inteligencia artificial y soporte 24/7. Describa su necesidad y la analizamos en una videollamada.',
    cta: 'Iniciar relevamiento',
    secondary: 'Ver servicios',
  },
  concept: {
    title: 'Tecnología pensada desde su negocio',
    lead: 'Primero se analiza cómo trabaja su organización y luego se diseña la solución. Su negocio ocupa el centro y cada servicio se conecta a él según sus necesidades.',
    center: 'Su negocio',
    diagram: 'Diagrama: su negocio en el centro, conectado a seis servicios.',
  },
  boot: { label: 'Cargando…' },
  emergency: {
    label: 'Emergencia 24/7',
    message: '🚨 *EMERGENCIA 24/7*\nNecesito asistencia técnica urgente.\n\n• Nombre:\n• Empresa / lugar:\n• Qué está pasando:\n• Remoto o presencial:',
  },
  consulta: {
    badge: 'Oferta',
    title: 'Relevamiento técnico, con tarifa por tramos',
    lead: 'Toda asesoría comienza con un relevamiento técnico por videollamada: usted expone su situación y se definen en conjunto los próximos pasos. Aplica a software, sistemas, gestión, infraestructura e inteligencia artificial.',
    billing: (m, from) => `La duración total define el tramo y su tarifa rige para toda la reunión, en bloques de ${m} minutos (un bloque incompleto cuenta como uno entero). Con menos de ${from} rige la tarifa normal.`,
    perHour: 'la hora de relevamiento técnico',
    hourShort: 'la hora',
    equals: (f) => `Equivale a ${f.block} cada ${f.minutes} min (antes ${f.blockOriginal}).`,
    off: (p) => `−${p} %`,
    srPrice: (f) => `Oferta: ${f.hour} la hora de relevamiento técnico, es decir ${f.block} cada ${f.minutes} minutos, desde ${f.from} de reunión. Precio normal: ${f.hourOriginal} la hora (${f.blockOriginal} cada ${f.minutes} minutos). La hora baja cuanto más larga es la reunión.`,
    tiersTitle: (m) => `Tarifa por tramos · cada ${m} min y por hora`,
    tierBelow: (to) => `Menos de ${to} · tarifa normal`,
    tierBetween: (from, to) => `De ${from} a ${to}`,
    tierFrom: (from) => `Desde ${from}`,
    examples: 'Costo total según la duración de la reunión',
    was: 'antes',
    support: 'Para emergencias, reparación o mantenimiento de equipos, en modalidad remota o presencial, se dispone del servicio de Soporte 24/7.',
    supportLink: 'Ver Soporte 24/7',
    cta: 'Solicitar consulta',
    hero: 'Relevamiento técnico',
    saving: 'Ahorro',
    noOffer: (from) => `Tarifa normal · la oferta empieza en ${from}`,
    perk: (from, to, p) => `Cuanto más larga la reunión, menos cuesta la hora: de ${from} a ${to}, hasta ${p} % menos que la tarifa normal.`,
  },
  preview: {
    title: 'Vista previa del mensaje',
    hint: 'Así va quedando el mensaje que recibirá Mariano. Puede revisarlo y editarlo antes de enviarlo.',
    keyData: (d, t) => `Datos clave: ${d} de ${t}`,
    keyDone: 'Datos clave completos',
    pending: 'pendiente',
    optional: 'opcional',
  },
  how: {
    title: 'Cómo funciona',
    steps: [
      { t: 'Seleccione servicios', d: 'Uno o varios.' },
      { t: 'Responda', d: 'Preguntas breves, unos 5 minutos.' },
      { t: 'Envíe por WhatsApp', d: 'Coordinamos una videollamada.' },
    ],
  },
  services: {
    title: 'Servicios',
    subtitle: 'Seleccione uno o varios. Ante la duda, el más cercano: el alcance se define en conjunto.',
    detail: 'Ver detalle',
    add: 'Agregar',
    remove: 'Quitar',
    selected: 'Agregado',
    includes: 'Incluye',
    needs: 'Para la reunión',
    hide: 'Ocultar detalle',
  },
  bar: {
    selected: (n) => (n === 1 ? '1 servicio seleccionado' : `${n} servicios seleccionados`),
    continue: 'Continuar',
    clear: 'Limpiar',
  },
  approach: {
    title: 'En cada diagnóstico se analiza',
    items: ['Dónde se pierde tiempo o dinero', 'Qué ventajas aprovechar', 'Si la inversión es viable', 'Cómo proteger sus activos'],
  },
  survey: {
    step: (n, total) => `Paso ${n} de ${total}`,
    back: 'Atrás',
    next: 'Siguiente',
    review: 'Revisar mensaje',
    required: 'Obligatorio',
    optional: 'Opcional',
    fieldRequired: 'Complete este dato para continuar.',
    chooseOne: 'Elija una opción.',
    chooseAny: 'Puede elegir varias.',
    exit: 'Volver al inicio',
    section: (n, total) => `Sección ${n} de ${total}`,
    question: (n, total) => `Pregunta ${n} de ${total}`,
    skip: 'Omitir',
    send: 'Enviar respuesta',
    answerPlaceholder: 'Escriba su respuesta…',
    enterHint: 'Enter envía · Mayús+Enter agrega una línea',
    preparing: 'Preparando la siguiente pregunta',
  },
  review: {
    title: 'Revise su mensaje',
    lead: 'Puede editarlo antes de enviarlo. Al tocar «Enviar por WhatsApp» se abre la conversación con el mensaje listo.',
    send: 'Enviar por WhatsApp',
    copy: 'Copiar mensaje',
    copied: 'Copiado',
    edit: 'Modificar respuestas',
    sent: 'Gracias. Nos comunicaremos a la brevedad para coordinar la videollamada.',
    restart: 'Nuevo relevamiento',
    tooLong: 'El mensaje es muy extenso; considere acortar los textos libres.',
    consent: 'Acepto que Mariano Lemos Barbaro guarde mis respuestas y mis datos de contacto para atender esta consulta y darle seguimiento.',
    consentNote: 'Es opcional: si no lo marca, el mensaje se envía igual por WhatsApp y no se guarda nada en el sitio.',
    registering: 'Registrando su consulta…',
    reference: 'Su referencia',
    checking: 'Verificando la conexión: tarda unos segundos. Si no quiere esperar, desmarque la casilla y el mensaje se envía igual por WhatsApp, sin registro.',
    verify: 'Complete la verificación de arriba para que se registre su consulta, o desmarque la casilla para enviar por WhatsApp sin registro.',
    verified: 'Verificación lista: al enviar, su consulta quedará registrada.',
    verifyFailed: 'No se pudo completar la verificación. Puede enviar igual por WhatsApp: su consulta no quedará registrada.',
    verifying: 'Verificando…',
    sendUnregistered: 'Enviar por WhatsApp sin registro',
  },
  message: {
    greeting: 'Hola Mariano, quiero hacer una consulta.',
    greetingNamed: (n) => `Hola Mariano, soy ${n}. Quiero hacer una consulta.`,
    title: 'RELEVAMIENTO INICIAL',
    ref: 'Ref.',
    services: 'Servicios de interés',
    consult: 'Consulta',
    consultValue: (f) => `${f.hour} la hora (${f.block} cada ${f.minutes} min), oferta desde ${f.from}; precio normal ${f.hourOriginal} la hora; tarifa por tramos de duración`,
    origin: 'origen',
    footer: 'Enviado desde',
    closing: 'Quedo a la espera para coordinar la videollamada.',
    unregistered: 'sin registro',
    followUp: (n) => `envío ${n}`,
  },
  footer: {
    privacy: 'Este sitio no guarda sus datos: el resumen se arma en su dispositivo y usted decide si lo envía por WhatsApp.',
    privacyCrm: 'El resumen se arma en su dispositivo y usted decide si lo envía por WhatsApp. Solo si lo autoriza, registramos sus respuestas y datos de contacto para dar seguimiento a su consulta.',
    rights: (y) => `© ${y} Mariano Lemos Barbaro`,
    whatsapp: 'WhatsApp',
    email: 'Correo',
    linkedin: 'LinkedIn',
  },
};

const pt: Dictionary = {
  meta: {
    title: 'Mariano Lemos Barbaro — Arquiteto & Consultor Sênior de TI',
    description: 'Consultoria, desenvolvimento de software, gestão ERP/CRM, infraestrutura, inteligência artificial e suporte 24/7. Descreva sua situação e agendaremos uma videochamada.',
  },
  ratesMeta: {
    title: 'Tarifas do levantamento técnico — Mariano Lemos Barbaro',
    description: 'Quanto mais longa a reunião, menos custa a hora. Tarifa por faixas de duração, exemplos de custo total e como solicitar a consulta.',
  },
  role: 'Arquiteto & Consultor Sênior de TI',
  tagline: 'Inovação · Tecnologia · Soluções reais',
  nav: { services: 'Serviços', rates: 'Tarifas', approach: 'Abordagem', contact: 'Contato', language: 'Idioma' },
  hero: {
    eyebrow: 'Diagnóstico · Projeto · Implementação',
    title: 'Soluções de TI que começam por entender o seu negócio',
    lead: 'Consultoria, software, gestão, infraestrutura, inteligência artificial e suporte 24/7. Descreva sua necessidade e a analisamos em uma videochamada.',
    cta: 'Iniciar levantamento',
    secondary: 'Ver serviços',
  },
  concept: {
    title: 'Tecnologia pensada a partir do seu negócio',
    lead: 'Primeiro se analisa como sua organização trabalha e, depois, se projeta a solução. Seu negócio fica no centro e cada serviço se conecta a ele conforme a necessidade.',
    center: 'Seu negócio',
    diagram: 'Diagrama: seu negócio no centro, conectado a seis serviços.',
  },
  boot: { label: 'Carregando…' },
  emergency: {
    label: 'Emergência 24/7',
    message: '🚨 *EMERGÊNCIA 24/7*\nPreciso de assistência técnica urgente.\n\n• Nome:\n• Empresa / local:\n• O que está acontecendo:\n• Remoto ou presencial:',
  },
  consulta: {
    badge: 'Oferta',
    title: 'Levantamento técnico, com tarifa por faixas',
    lead: 'Toda assessoria começa com um levantamento técnico por videochamada: você expõe sua situação e os próximos passos são definidos em conjunto. Aplica-se a software, sistemas, gestão, infraestrutura e inteligência artificial.',
    billing: (m, from) => `A duração total define a faixa e sua tarifa vale para toda a reunião, em blocos de ${m} minutos (um bloco incompleto conta como inteiro). Com menos de ${from} vale a tarifa normal.`,
    perHour: 'a hora de levantamento técnico',
    hourShort: 'a hora',
    equals: (f) => `Equivale a ${f.block} a cada ${f.minutes} min (antes ${f.blockOriginal}).`,
    off: (p) => `−${p} %`,
    srPrice: (f) => `Oferta: ${f.hour} a hora de levantamento técnico, ou seja, ${f.block} a cada ${f.minutes} minutos, a partir de ${f.from} de reunião. Preço normal: ${f.hourOriginal} a hora (${f.blockOriginal} a cada ${f.minutes} minutos). A hora fica mais barata quanto mais longa é a reunião.`,
    tiersTitle: (m) => `Tarifa por faixas · a cada ${m} min e por hora`,
    tierBelow: (to) => `Menos de ${to} · tarifa normal`,
    tierBetween: (from, to) => `De ${from} a ${to}`,
    tierFrom: (from) => `A partir de ${from}`,
    examples: 'Custo total conforme a duração da reunião',
    was: 'antes',
    support: 'Para emergências, conserto ou manutenção de equipamentos, em modalidade remota ou presencial, está disponível o serviço de Suporte 24/7.',
    supportLink: 'Ver Suporte 24/7',
    cta: 'Solicitar consulta',
    hero: 'Levantamento técnico',
    saving: 'Economia',
    noOffer: (from) => `Tarifa normal · a oferta começa em ${from}`,
    perk: (from, to, p) => `Quanto mais longa a reunião, menos custa a hora: de ${from} a ${to}, até ${p} % menos que a tarifa normal.`,
  },
  preview: {
    title: 'Prévia da mensagem',
    hint: 'É assim que a mensagem que o Mariano receberá vai ficando. Você pode revisá-la e editá-la antes de enviar.',
    keyData: (d, t) => `Dados-chave: ${d} de ${t}`,
    keyDone: 'Dados-chave completos',
    pending: 'pendente',
    optional: 'opcional',
  },
  how: {
    title: 'Como funciona',
    steps: [
      { t: 'Selecione serviços', d: 'Um ou vários.' },
      { t: 'Responda', d: 'Perguntas simples, cerca de 5 minutos.' },
      { t: 'Envie pelo WhatsApp', d: 'Agendamos uma videochamada.' },
    ],
  },
  services: {
    title: 'Serviços',
    subtitle: 'Selecione um ou vários. Em caso de dúvida, o mais próximo: o escopo é definido em conjunto.',
    detail: 'Ver detalhes',
    add: 'Adicionar',
    remove: 'Remover',
    selected: 'Adicionado',
    includes: 'Inclui',
    needs: 'Para a reunião',
    hide: 'Ocultar detalhes',
  },
  bar: {
    selected: (n) => (n === 1 ? '1 serviço selecionado' : `${n} serviços selecionados`),
    continue: 'Continuar',
    clear: 'Limpar',
  },
  approach: {
    title: 'Em cada diagnóstico se analisa',
    items: ['Onde se perde tempo ou dinheiro', 'Que vantagens aproveitar', 'Se o investimento é viável', 'Como proteger seus ativos'],
  },
  survey: {
    step: (n, total) => `Etapa ${n} de ${total}`,
    back: 'Voltar',
    next: 'Próximo',
    review: 'Revisar mensagem',
    required: 'Obrigatório',
    optional: 'Opcional',
    fieldRequired: 'Preencha este dado para continuar.',
    chooseOne: 'Escolha uma opção.',
    chooseAny: 'Pode escolher várias.',
    exit: 'Voltar ao início',
    section: (n, total) => `Seção ${n} de ${total}`,
    question: (n, total) => `Pergunta ${n} de ${total}`,
    skip: 'Pular',
    send: 'Enviar resposta',
    answerPlaceholder: 'Escreva sua resposta…',
    enterHint: 'Enter envia · Shift+Enter nova linha',
    preparing: 'Preparando a próxima pergunta',
  },
  review: {
    title: 'Revise sua mensagem',
    lead: 'Você pode editá-la antes de enviar. Ao tocar em «Enviar pelo WhatsApp», a conversa abre com a mensagem pronta.',
    send: 'Enviar pelo WhatsApp',
    copy: 'Copiar mensagem',
    copied: 'Copiado',
    edit: 'Alterar respostas',
    sent: 'Obrigado. Entraremos em contato em breve para agendar a videochamada.',
    restart: 'Novo levantamento',
    tooLong: 'A mensagem está muito longa; considere encurtar os textos livres.',
    consent: 'Aceito que Mariano Lemos Barbaro guarde minhas respostas e meus dados de contato para atender esta consulta e dar seguimento a ela.',
    consentNote: 'É opcional: se você não marcar, a mensagem é enviada mesmo assim pelo WhatsApp e nada é guardado no site.',
    registering: 'Registrando sua consulta…',
    reference: 'Sua referência',
    checking: 'Verificando a conexão: leva alguns segundos. Se não quiser esperar, desmarque a caixa e a mensagem é enviada mesmo assim pelo WhatsApp, sem registro.',
    verify: 'Conclua a verificação acima para que sua consulta seja registrada, ou desmarque a caixa para enviar pelo WhatsApp sem registro.',
    verified: 'Verificação concluída: ao enviar, sua consulta ficará registrada.',
    verifyFailed: 'Não foi possível concluir a verificação. Você pode enviar mesmo assim pelo WhatsApp: sua consulta não será registrada.',
    verifying: 'Verificando…',
    sendUnregistered: 'Enviar pelo WhatsApp sem registro',
  },
  message: {
    greeting: 'Olá Mariano, gostaria de fazer uma consulta.',
    greetingNamed: (n) => `Olá Mariano, sou ${n}. Gostaria de fazer uma consulta.`,
    title: 'LEVANTAMENTO INICIAL',
    ref: 'Ref.',
    services: 'Serviços de interesse',
    consult: 'Consulta',
    consultValue: (f) => `${f.hour} a hora (${f.block} a cada ${f.minutes} min), oferta a partir de ${f.from}; preço normal ${f.hourOriginal} a hora; tarifa por faixas de duração`,
    origin: 'origem',
    footer: 'Enviado de',
    closing: 'Aguardo para agendarmos a videochamada.',
    unregistered: 'sem registro',
    followUp: (n) => `envio ${n}`,
  },
  footer: {
    privacy: 'Este site não armazena seus dados: o resumo é montado no seu dispositivo e você decide se o envia pelo WhatsApp.',
    privacyCrm: 'O resumo é montado no seu dispositivo e você decide se o envia pelo WhatsApp. Somente se você autorizar, registramos suas respostas e dados de contato para dar seguimento à sua consulta.',
    rights: (y) => `© ${y} Mariano Lemos Barbaro`,
    whatsapp: 'WhatsApp',
    email: 'E-mail',
    linkedin: 'LinkedIn',
  },
};

const en: Dictionary = {
  meta: {
    title: 'Mariano Lemos Barbaro — Senior IT Architect & Consultant',
    description: 'Consulting, software development, ERP/CRM management, infrastructure, artificial intelligence and 24/7 support. Describe your situation and we will schedule a video call.',
  },
  ratesMeta: {
    title: 'Technical assessment rates — Mariano Lemos Barbaro',
    description: 'The longer the meeting, the less each hour costs. Tiered rates by duration, total cost examples and how to request a consultation.',
  },
  role: 'Senior IT Architect & Consultant',
  tagline: 'Innovation · Technology · Real solutions',
  nav: { services: 'Services', rates: 'Rates', approach: 'Approach', contact: 'Contact', language: 'Language' },
  hero: {
    eyebrow: 'Diagnosis · Design · Implementation',
    title: 'IT solutions that start by understanding your business',
    lead: 'Consulting, software, management, infrastructure, artificial intelligence and 24/7 support. Describe your need and we will review it on a video call.',
    cta: 'Start assessment',
    secondary: 'View services',
  },
  concept: {
    title: 'Technology designed around your business',
    lead: 'Every engagement begins by understanding how your organization works; the solution is designed afterwards. Your business sits at the center and each service connects to it as needed.',
    center: 'Your business',
    diagram: 'Diagram: your business at the center, connected to six services.',
  },
  boot: { label: 'Loading…' },
  emergency: {
    label: '24/7 Emergency',
    message: '🚨 *24/7 EMERGENCY*\nI need urgent technical assistance.\n\n• Name:\n• Company / location:\n• What is happening:\n• Remote or on-site:',
  },
  consulta: {
    badge: 'Offer',
    title: 'Technical assessment, with tiered pricing',
    lead: 'Every advisory engagement starts with a technical assessment by video call: you describe your situation and the next steps are defined jointly. It applies to software, systems, management, infrastructure and artificial intelligence.',
    billing: (m, from) => `The total length sets the tier, and its rate applies to the whole meeting, in ${m}-minute blocks (a partial block counts as a full one). Under ${from} the regular rate applies.`,
    perHour: 'per hour of technical assessment',
    hourShort: 'per hour',
    equals: (f) => `Equivalent to ${f.block} per ${f.minutes} min (was ${f.blockOriginal}).`,
    off: (p) => `−${p}%`,
    srPrice: (f) => `Offer: ${f.hour} per hour of technical assessment, i.e. ${f.block} per ${f.minutes} minutes, from ${f.from} of meeting. Regular price: ${f.hourOriginal} per hour (${f.blockOriginal} per ${f.minutes} minutes). The hourly price drops the longer the meeting is.`,
    tiersTitle: (m) => `Tiered pricing · per ${m} min and per hour`,
    tierBelow: (to) => `Under ${to} · regular rate`,
    tierBetween: (from, to) => `${from} to ${to}`,
    tierFrom: (from) => `From ${from}`,
    examples: 'Total cost by meeting length',
    was: 'was',
    support: 'For emergencies, repair or maintenance of equipment, remote or on-site, the 24/7 Support service is available.',
    supportLink: 'View 24/7 Support',
    cta: 'Request a consultation',
    hero: 'Technical assessment',
    saving: 'Saving',
    noOffer: (from) => `Regular rate · the offer starts at ${from}`,
    perk: (from, to, p) => `The longer the meeting, the lower the hourly price: from ${from} down to ${to}, up to ${p}% below the regular rate.`,
  },
  preview: {
    title: 'Message preview',
    hint: 'This is how the message Mariano will receive is taking shape. You can review and edit it before sending.',
    keyData: (d, t) => `Key details: ${d} of ${t}`,
    keyDone: 'Key details complete',
    pending: 'pending',
    optional: 'optional',
  },
  how: {
    title: 'How it works',
    steps: [
      { t: 'Select services', d: 'One or several.' },
      { t: 'Answer', d: 'Simple questions, about 5 minutes.' },
      { t: 'Send via WhatsApp', d: 'We schedule a video call.' },
    ],
  },
  services: {
    title: 'Services',
    subtitle: 'Select one or several. If in doubt, the closest one: the scope is defined jointly.',
    detail: 'See details',
    add: 'Add',
    remove: 'Remove',
    selected: 'Added',
    includes: 'Includes',
    needs: 'For the meeting',
    hide: 'Hide details',
  },
  bar: {
    selected: (n) => (n === 1 ? '1 service selected' : `${n} services selected`),
    continue: 'Continue',
    clear: 'Clear',
  },
  approach: {
    title: 'Every diagnosis examines',
    items: ['Where time or money is lost', 'Which strengths to build on', 'Whether the investment is viable', 'How to protect your assets'],
  },
  survey: {
    step: (n, total) => `Step ${n} of ${total}`,
    back: 'Back',
    next: 'Next',
    review: 'Review message',
    required: 'Required',
    optional: 'Optional',
    fieldRequired: 'Please fill this in to continue.',
    chooseOne: 'Choose one option.',
    chooseAny: 'You can choose several.',
    exit: 'Back to home',
    section: (n, total) => `Section ${n} of ${total}`,
    question: (n, total) => `Question ${n} of ${total}`,
    skip: 'Skip',
    send: 'Send answer',
    answerPlaceholder: 'Type your answer…',
    enterHint: 'Enter to send · Shift+Enter for a new line',
    preparing: 'Preparing the next question',
  },
  review: {
    title: 'Review your message',
    lead: 'You can edit it before sending. Tapping “Send via WhatsApp” opens the chat with the message ready.',
    send: 'Send via WhatsApp',
    copy: 'Copy message',
    copied: 'Copied',
    edit: 'Edit answers',
    sent: 'Thank you. We will get back to you shortly to schedule the video call.',
    restart: 'New assessment',
    tooLong: 'The message is very long; consider shortening the free-text answers.',
    consent: 'I agree that Mariano Lemos Barbaro stores my answers and contact details to handle and follow up on this inquiry.',
    consentNote: 'This is optional: if you leave it unticked, the message is still sent via WhatsApp and nothing is stored on the site.',
    registering: 'Registering your inquiry…',
    reference: 'Your reference',
    checking: 'Checking your connection: this takes a few seconds. If you would rather not wait, untick the box and the message is still sent via WhatsApp, without being registered.',
    verify: 'Complete the verification above so your inquiry is registered, or untick the box to send via WhatsApp without registering it.',
    verified: 'Verification done: when you send, your inquiry will be registered.',
    verifyFailed: 'The verification could not be completed. You can still send via WhatsApp: your inquiry will not be registered.',
    verifying: 'Verifying…',
    sendUnregistered: 'Send via WhatsApp without registering',
  },
  message: {
    greeting: "Hi Mariano, I'd like to make an inquiry.",
    greetingNamed: (n) => `Hi Mariano, I'm ${n}. I'd like to make an inquiry.`,
    title: 'INITIAL ASSESSMENT',
    ref: 'Ref.',
    services: 'Services of interest',
    consult: 'Consultation',
    consultValue: (f) => `${f.hour} per hour (${f.block} per ${f.minutes} min), offer from ${f.from}; regular price ${f.hourOriginal} per hour; tiered by meeting length`,
    origin: 'source',
    footer: 'Sent from',
    closing: 'Looking forward to scheduling the video call.',
    unregistered: 'not registered',
    followUp: (n) => `submission ${n}`,
  },
  footer: {
    privacy: 'This site does not store your data: the summary is built on your device and you decide whether to send it via WhatsApp.',
    privacyCrm: 'The summary is built on your device and you decide whether to send it via WhatsApp. Only if you allow it, we store your answers and contact details to follow up on your inquiry.',
    rights: (y) => `© ${y} Mariano Lemos Barbaro`,
    whatsapp: 'WhatsApp',
    email: 'Email',
    linkedin: 'LinkedIn',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { es, pt, en };

export const LOCALE_NAMES: Record<Locale, string> = { es: 'Español', pt: 'Português', en: 'English' };
