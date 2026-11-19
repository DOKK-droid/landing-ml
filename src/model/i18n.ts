/* ============================================================
 * MODELO — Textos de interfaz por idioma.
 * ============================================================ */
import type { Locale } from './types';

export interface Dictionary {
  meta: { title: string; description: string };
  role: string;
  tagline: string;
  nav: { services: string; approach: string; contact: string; language: string };
  hero: { eyebrow: string; title: string; lead: string; cta: string; secondary: string };
  emergency: { label: string; message: string };
  how: { title: string; steps: { t: string; d: string }[] };
  services: {
    title: string; subtitle: string; detail: string; add: string; remove: string; selected: string;
    includes: string; needs: string; close: string;
  };
  bar: { selected: (n: number) => string; continue: string; clear: string };
  approach: { title: string; items: string[]; note: string };
  survey: {
    step: (n: number, total: number) => string; back: string; next: string; review: string;
    required: string; optional: string; fieldRequired: string; chooseOne: string; chooseAny: string; exit: string;
    fixErrors: string;
  };
  review: {
    title: string; lead: string; send: string; copy: string; copied: string; edit: string;
    sent: string; restart: string; tooLong: string;
  };
  message: { greeting: string; title: string; ref: string; services: string; footer: string; closing: string };
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
    lead: 'Antes de proponer tecnología, analizo cómo trabaja su organización: dónde se pierde tiempo o dinero, qué activos conviene cuidar y qué es viable. Cuénteme su situación en unos minutos y coordinamos una videollamada.',
    cta: 'Iniciar relevamiento',
    secondary: 'Ver servicios',
  },
  emergency: {
    label: 'Emergencia 24/7',
    message: '🚨 *EMERGENCIA 24/7*\nNecesito asistencia técnica urgente.\n\n• Nombre:\n• Empresa / lugar:\n• Qué está pasando:',
  },
  how: {
    title: 'Cómo funciona',
    steps: [
      { t: 'Elija los servicios', d: 'Puede marcar uno o varios. Cada uno explica qué incluye y qué conviene contar.' },
      { t: 'Responda preguntas simples', d: 'Sin tecnicismos, en el lenguaje de su negocio. Le lleva unos 5 minutos.' },
      { t: 'Envíe el resumen por WhatsApp', d: 'Revisa el mensaje, lo envía y coordinamos una videollamada para proponerle la mejor alternativa.' },
    ],
  },
  services: {
    title: 'Servicios',
    subtitle: 'Seleccione lo que necesita. Si no está seguro, elija el más cercano: en la reunión lo definimos juntos.',
    detail: 'Ver detalle',
    add: 'Agregar al relevamiento',
    remove: 'Quitar del relevamiento',
    selected: 'Seleccionado',
    includes: 'Qué incluye',
    needs: 'Para preparar la reunión',
    close: 'Cerrar',
  },
  bar: {
    selected: (n) => (n === 1 ? '1 servicio seleccionado' : `${n} servicios seleccionados`),
    continue: 'Continuar',
    clear: 'Limpiar',
  },
  approach: {
    title: 'Primero el negocio, después la tecnología',
    items: [
      'Detectar fallas y puntos de pérdida',
      'Aprovechar las ventajas que ya tiene',
      'Evaluar viabilidad y retorno antes de invertir',
      'Reducir gastos y cuidar sus activos',
    ],
    note: 'Con su relevamiento preparo la reunión y le propongo la alternativa que más le convenga a su caso.',
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
    fixErrors: 'Faltan datos obligatorios en este paso.',
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
    title: 'RELEVAMIENTO INICIAL',
    ref: 'Ref.',
    services: 'Servicios de interés',
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
    lead: 'Antes de propor tecnologia, analiso como sua organização trabalha: onde se perde tempo ou dinheiro, quais ativos vale a pena proteger e o que é viável. Conte sua situação em poucos minutos e agendamos uma videochamada.',
    cta: 'Iniciar levantamento',
    secondary: 'Ver serviços',
  },
  emergency: {
    label: 'Emergência 24/7',
    message: '🚨 *EMERGÊNCIA 24/7*\nPreciso de assistência técnica urgente.\n\n• Nome:\n• Empresa / local:\n• O que está acontecendo:',
  },
  how: {
    title: 'Como funciona',
    steps: [
      { t: 'Escolha os serviços', d: 'Pode marcar um ou vários. Cada um explica o que inclui e o que vale a pena contar.' },
      { t: 'Responda perguntas simples', d: 'Sem termos técnicos, na linguagem do seu negócio. Leva cerca de 5 minutos.' },
      { t: 'Envie o resumo pelo WhatsApp', d: 'Revise a mensagem, envie e agendamos uma videochamada para propor a melhor alternativa.' },
    ],
  },
  services: {
    title: 'Serviços',
    subtitle: 'Selecione o que precisa. Se não tiver certeza, escolha o mais próximo: na reunião definimos juntos.',
    detail: 'Ver detalhes',
    add: 'Adicionar ao levantamento',
    remove: 'Remover do levantamento',
    selected: 'Selecionado',
    includes: 'O que inclui',
    needs: 'Para preparar a reunião',
    close: 'Fechar',
  },
  bar: {
    selected: (n) => (n === 1 ? '1 serviço selecionado' : `${n} serviços selecionados`),
    continue: 'Continuar',
    clear: 'Limpar',
  },
  approach: {
    title: 'Primeiro o negócio, depois a tecnologia',
    items: [
      'Identificar falhas e pontos de perda',
      'Aproveitar as vantagens que você já tem',
      'Avaliar viabilidade e retorno antes de investir',
      'Reduzir custos e proteger seus ativos',
    ],
    note: 'Com o seu levantamento preparo a reunião e proponho a alternativa mais conveniente para o seu caso.',
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
    fixErrors: 'Faltam dados obrigatórios nesta etapa.',
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
    title: 'LEVANTAMENTO INICIAL',
    ref: 'Ref.',
    services: 'Serviços de interesse',
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
    lead: 'Before proposing technology, I analyze how your organization works: where time or money is lost, which assets are worth protecting and what is feasible. Tell me about your situation in a few minutes and we will schedule a video call.',
    cta: 'Start the assessment',
    secondary: 'See services',
  },
  emergency: {
    label: '24/7 Emergency',
    message: '🚨 *24/7 EMERGENCY*\nI need urgent technical assistance.\n\n• Name:\n• Company / location:\n• What is happening:',
  },
  how: {
    title: 'How it works',
    steps: [
      { t: 'Choose the services', d: 'Pick one or several. Each explains what it includes and what is worth telling.' },
      { t: 'Answer simple questions', d: 'No jargon, in the language of your business. It takes about 5 minutes.' },
      { t: 'Send the summary via WhatsApp', d: 'Review the message, send it and we will schedule a video call to propose the best option.' },
    ],
  },
  services: {
    title: 'Services',
    subtitle: "Select what you need. If you're not sure, pick the closest one: we will define it together in the meeting.",
    detail: 'See details',
    add: 'Add to assessment',
    remove: 'Remove from assessment',
    selected: 'Selected',
    includes: 'What it includes',
    needs: 'To prepare the meeting',
    close: 'Close',
  },
  bar: {
    selected: (n) => (n === 1 ? '1 service selected' : `${n} services selected`),
    continue: 'Continue',
    clear: 'Clear',
  },
  approach: {
    title: 'Business first, technology second',
    items: [
      'Find failures and loss points',
      'Leverage the strengths you already have',
      'Assess feasibility and return before investing',
      'Cut costs and protect your assets',
    ],
    note: 'I use your assessment to prepare the meeting and propose the option that best fits your case.',
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
    fixErrors: 'Some required fields in this step are missing.',
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
    title: 'INITIAL ASSESSMENT',
    ref: 'Ref.',
    services: 'Services of interest',
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
