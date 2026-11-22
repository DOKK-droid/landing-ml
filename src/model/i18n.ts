/* ============================================================
 * MODELO — Textos de interfaz por idioma.
 * ============================================================ */
import type { OfferFigures } from './offer';
import type { Locale } from './types';

export interface Dictionary {
  meta: { title: string; description: string };
  role: string;
  tagline: string;
  nav: { services: string; approach: string; contact: string; language: string };
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
  };
  message: {
    greeting: string; greetingNamed: (name: string) => string; title: string; ref: string; services: string;
    consult: string; consultValue: (f: OfferFigures) => string;
    origin: string; footer: string; closing: string;
  };
  footer: { privacy: string; rights: (year: number) => string; whatsapp: string; email: string; linkedin: string };
}

const es: Dictionary = {
  meta: {
    title: 'Mariano Lemos Barbaro — Arquitecto & Consultor Senior IT',
    description: 'Consultoría, desarrollo de software, gestión ERP/CRM, infraestructura, inteligencia artificial y soporte 24/7. Cuente su situación y coordinamos una videollamada.',
  },
  role: 'Arquitecto & Consultor Senior IT',
  tagline: 'Innovación · Tecnología · Soluciones reales',
  nav: { services: 'Servicios', approach: 'Enfoque', contact: 'Contacto', language: 'Idioma' },
  hero: {
    eyebrow: 'Diagnósticos · Diseños · Implementación',
    title: 'Soluciones IT que empiezan por entender su negocio',
    lead: 'Consultoría, software, gestión, infraestructura, inteligencia artificial y soporte 24/7. Cuénteme qué necesita y lo vemos por videollamada.',
    cta: 'Iniciar relevamiento',
    secondary: 'Ver servicios',
  },
  concept: {
    title: 'Tecnología pensada desde su negocio',
    lead: 'Primero entiendo cómo trabaja su organización; después diseño la solución. Su negocio va al centro y cada servicio se conecta a él según lo que necesite.',
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
    lead: 'Toda asesoría empieza con un relevamiento técnico por videollamada: usted cuenta su situación y definimos juntos los próximos pasos. Vale para software, sistemas, gestión, infraestructura o inteligencia artificial.',
    billing: (m, from) => `Cada bloque de ${m} minutos se cobra al precio del tramo en que empieza y un bloque incompleto cuenta como uno entero. Con menos de ${from} rige la tarifa normal.`,
    perHour: 'la hora de relevamiento técnico',
    hourShort: 'la hora',
    equals: (f) => `Equivale a ${f.block} cada ${f.minutes} min (antes ${f.blockOriginal}).`,
    off: (p) => `−${p} %`,
    srPrice: (f) => `Oferta: ${f.hour} la hora de relevamiento técnico, es decir ${f.block} cada ${f.minutes} minutos, desde ${f.from} de reunión. Precio normal: ${f.hourOriginal} la hora (${f.blockOriginal} cada ${f.minutes} minutos). El total se calcula por tramos.`,
    tiersTitle: (m) => `Tarifa por tramos · cada ${m} min y por hora`,
    tierBelow: (to) => `Menos de ${to} · tarifa normal`,
    tierBetween: (from, to) => `De ${from} a ${to}`,
    tierFrom: (from) => `Más de ${from}`,
    examples: 'Costo total según la duración de la reunión',
    was: 'antes',
    support: 'Para emergencias, reparación o mantenimiento de equipos, en remoto o presencial, está Soporte 24/7.',
    supportLink: 'Ver Soporte 24/7',
    cta: 'Pedir mi consulta',
    hero: 'Relevamiento técnico',
  },
  preview: {
    title: 'Vista previa del mensaje',
    hint: 'Así va quedando lo que recibirá Mariano. Lo revisa y lo puede editar antes de enviarlo.',
    keyData: (d, t) => `Datos clave: ${d} de ${t}`,
    keyDone: 'Datos clave completos',
    pending: 'pendiente',
    optional: 'opcional',
  },
  how: {
    title: 'Cómo funciona',
    steps: [
      { t: 'Elija servicios', d: 'Uno o varios.' },
      { t: 'Responda', d: 'Preguntas simples, unos 5 minutos.' },
      { t: 'Envíe por WhatsApp', d: 'Coordinamos una videollamada.' },
    ],
  },
  services: {
    title: 'Servicios',
    subtitle: 'Elija uno o varios. Si no está seguro, el más cercano: lo definimos juntos.',
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
    title: 'En cada diagnóstico busco',
    items: ['Dónde se pierde tiempo o dinero', 'Qué ventajas aprovechar', 'Si la inversión es viable', 'Cómo cuidar sus activos'],
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
    sent: 'Gracias. Le respondo a la brevedad para coordinar la videollamada.',
    restart: 'Nuevo relevamiento',
    tooLong: 'El mensaje es muy extenso; considere acortar los textos libres.',
  },
  message: {
    greeting: 'Hola Mariano, quiero hacer una consulta.',
    greetingNamed: (n) => `Hola Mariano, soy ${n}. Quiero hacer una consulta.`,
    title: 'RELEVAMIENTO INICIAL',
    ref: 'Ref.',
    services: 'Servicios de interés',
    consult: 'Consulta',
    consultValue: (f) => `${f.hour} la hora (${f.block} cada ${f.minutes} min), oferta desde ${f.from}; precio normal ${f.hourOriginal} la hora; total por tramos`,
    origin: 'origen',
    footer: 'Enviado desde',
    closing: 'Quedo a la espera para coordinar la videollamada.',
  },
  footer: {
    privacy: 'Este sitio no guarda sus datos: el resumen se arma en su dispositivo y usted decide si lo envía por WhatsApp.',
    rights: (y) => `© ${y} Mariano Lemos Barbaro`,
    whatsapp: 'WhatsApp',
    email: 'Correo',
    linkedin: 'LinkedIn',
  },
};

const pt: Dictionary = {
  meta: {
    title: 'Mariano Lemos Barbaro — Arquiteto & Consultor Sênior de TI',
    description: 'Consultoria, desenvolvimento de software, gestão ERP/CRM, infraestrutura, inteligência artificial e suporte 24/7. Conte sua situação e agendamos uma videochamada.',
  },
  role: 'Arquiteto & Consultor Sênior de TI',
  tagline: 'Inovação · Tecnologia · Soluções reais',
  nav: { services: 'Serviços', approach: 'Abordagem', contact: 'Contato', language: 'Idioma' },
  hero: {
    eyebrow: 'Diagnósticos · Projetos · Implementação',
    title: 'Soluções de TI que começam por entender o seu negócio',
    lead: 'Consultoria, software, gestão, infraestrutura, inteligência artificial e suporte 24/7. Conte o que precisa e conversamos por videochamada.',
    cta: 'Iniciar levantamento',
    secondary: 'Ver serviços',
  },
  concept: {
    title: 'Tecnologia pensada a partir do seu negócio',
    lead: 'Primeiro entendo como sua organização trabalha; depois projeto a solução. Seu negócio fica no centro e cada serviço se conecta a ele conforme a necessidade.',
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
    lead: 'Toda assessoria começa com um levantamento técnico por videochamada: você conta sua situação e definimos juntos os próximos passos. Vale para software, sistemas, gestão, infraestrutura ou inteligência artificial.',
    billing: (m, from) => `Cada bloco de ${m} minutos é cobrado pelo preço da faixa em que começa e um bloco incompleto conta como inteiro. Com menos de ${from} vale a tarifa normal.`,
    perHour: 'a hora de levantamento técnico',
    hourShort: 'a hora',
    equals: (f) => `Equivale a ${f.block} a cada ${f.minutes} min (antes ${f.blockOriginal}).`,
    off: (p) => `−${p} %`,
    srPrice: (f) => `Oferta: ${f.hour} a hora de levantamento técnico, ou seja, ${f.block} a cada ${f.minutes} minutos, a partir de ${f.from} de reunião. Preço normal: ${f.hourOriginal} a hora (${f.blockOriginal} a cada ${f.minutes} minutos). O total é calculado por faixas.`,
    tiersTitle: (m) => `Tarifa por faixas · a cada ${m} min e por hora`,
    tierBelow: (to) => `Menos de ${to} · tarifa normal`,
    tierBetween: (from, to) => `De ${from} a ${to}`,
    tierFrom: (from) => `Mais de ${from}`,
    examples: 'Custo total conforme a duração da reunião',
    was: 'antes',
    support: 'Para emergências, conserto ou manutenção de equipamentos, remoto ou presencial, há o Suporte 24/7.',
    supportLink: 'Ver Suporte 24/7',
    cta: 'Pedir minha consulta',
    hero: 'Levantamento técnico',
  },
  preview: {
    title: 'Prévia da mensagem',
    hint: 'É assim que a mensagem que o Mariano receberá vai ficando. Você revisa e pode editar antes de enviar.',
    keyData: (d, t) => `Dados-chave: ${d} de ${t}`,
    keyDone: 'Dados-chave completos',
    pending: 'pendente',
    optional: 'opcional',
  },
  how: {
    title: 'Como funciona',
    steps: [
      { t: 'Escolha serviços', d: 'Um ou vários.' },
      { t: 'Responda', d: 'Perguntas simples, cerca de 5 minutos.' },
      { t: 'Envie pelo WhatsApp', d: 'Agendamos uma videochamada.' },
    ],
  },
  services: {
    title: 'Serviços',
    subtitle: 'Escolha um ou vários. Se não tiver certeza, o mais próximo: definimos juntos.',
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
    title: 'Em cada diagnóstico procuro',
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
    sent: 'Obrigado. Respondo em breve para agendar a videochamada.',
    restart: 'Novo levantamento',
    tooLong: 'A mensagem está muito longa; considere encurtar os textos livres.',
  },
  message: {
    greeting: 'Olá Mariano, gostaria de fazer uma consulta.',
    greetingNamed: (n) => `Olá Mariano, sou ${n}. Gostaria de fazer uma consulta.`,
    title: 'LEVANTAMENTO INICIAL',
    ref: 'Ref.',
    services: 'Serviços de interesse',
    consult: 'Consulta',
    consultValue: (f) => `${f.hour} a hora (${f.block} a cada ${f.minutes} min), oferta a partir de ${f.from}; preço normal ${f.hourOriginal} a hora; total por faixas`,
    origin: 'origem',
    footer: 'Enviado de',
    closing: 'Aguardo para agendarmos a videochamada.',
  },
  footer: {
    privacy: 'Este site não armazena seus dados: o resumo é montado no seu dispositivo e você decide se o envia pelo WhatsApp.',
    rights: (y) => `© ${y} Mariano Lemos Barbaro`,
    whatsapp: 'WhatsApp',
    email: 'E-mail',
    linkedin: 'LinkedIn',
  },
};

const en: Dictionary = {
  meta: {
    title: 'Mariano Lemos Barbaro — Senior IT Architect & Consultant',
    description: 'Consulting, software development, ERP/CRM management, infrastructure, artificial intelligence and 24/7 support. Tell me about your situation and we will schedule a video call.',
  },
  role: 'Senior IT Architect & Consultant',
  tagline: 'Innovation · Technology · Real solutions',
  nav: { services: 'Services', approach: 'Approach', contact: 'Contact', language: 'Language' },
  hero: {
    eyebrow: 'Diagnosis · Design · Implementation',
    title: 'IT solutions that start by understanding your business',
    lead: 'Consulting, software, management, infrastructure, artificial intelligence and 24/7 support. Tell me what you need and we will talk it through on a video call.',
    cta: 'Start the assessment',
    secondary: 'See services',
  },
  concept: {
    title: 'Technology designed around your business',
    lead: 'First I understand how your organization works; then I design the solution. Your business sits at the center and each service connects to it as needed.',
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
    lead: 'Every advisory engagement starts with a technical assessment by video call: you describe your situation and we define the next steps together. It covers software, systems, management, infrastructure or artificial intelligence.',
    billing: (m, from) => `Each ${m}-minute block is charged at the price of the tier where it starts, and a partial block counts as a full one. Under ${from} the regular rate applies.`,
    perHour: 'per hour of technical assessment',
    hourShort: 'per hour',
    equals: (f) => `Equivalent to ${f.block} per ${f.minutes} min (was ${f.blockOriginal}).`,
    off: (p) => `−${p}%`,
    srPrice: (f) => `Offer: ${f.hour} per hour of technical assessment, i.e. ${f.block} per ${f.minutes} minutes, from ${f.from} of meeting. Regular price: ${f.hourOriginal} per hour (${f.blockOriginal} per ${f.minutes} minutes). The total is calculated by tier.`,
    tiersTitle: (m) => `Tiered pricing · per ${m} min and per hour`,
    tierBelow: (to) => `Under ${to} · regular rate`,
    tierBetween: (from, to) => `${from} to ${to}`,
    tierFrom: (from) => `Over ${from}`,
    examples: 'Total cost by meeting length',
    was: 'was',
    support: 'For emergencies, repair or maintenance of equipment, remote or on-site, there is 24/7 Support.',
    supportLink: 'See 24/7 Support',
    cta: 'Request my consultation',
    hero: 'Technical assessment',
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
      { t: 'Choose services', d: 'One or several.' },
      { t: 'Answer', d: 'Simple questions, about 5 minutes.' },
      { t: 'Send via WhatsApp', d: 'We schedule a video call.' },
    ],
  },
  services: {
    title: 'Services',
    subtitle: "Pick one or several. Not sure? Pick the closest; we'll define it together.",
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
    title: 'In every diagnosis I look for',
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
    sent: 'Thank you. I will get back to you shortly to schedule the video call.',
    restart: 'New assessment',
    tooLong: 'The message is very long; consider shortening the free-text answers.',
  },
  message: {
    greeting: "Hi Mariano, I'd like to make an inquiry.",
    greetingNamed: (n) => `Hi Mariano, I'm ${n}. I'd like to make an inquiry.`,
    title: 'INITIAL ASSESSMENT',
    ref: 'Ref.',
    services: 'Services of interest',
    consult: 'Consultation',
    consultValue: (f) => `${f.hour} per hour (${f.block} per ${f.minutes} min), offer from ${f.from}; regular price ${f.hourOriginal} per hour; total by tier`,
    origin: 'source',
    footer: 'Sent from',
    closing: 'Looking forward to scheduling the video call.',
  },
  footer: {
    privacy: 'This site does not store your data: the summary is built on your device and you decide whether to send it via WhatsApp.',
    rights: (y) => `© ${y} Mariano Lemos Barbaro`,
    whatsapp: 'WhatsApp',
    email: 'Email',
    linkedin: 'LinkedIn',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { es, pt, en };

export const LOCALE_NAMES: Record<Locale, string> = { es: 'Español', pt: 'Português', en: 'English' };
