/* ============================================================
 * MODELO — Textos de interfaz por idioma.
 * ============================================================ */
import type { Locale } from './types';

export interface Dictionary {
  meta: { title: string; description: string };
  role: string;
  tagline: string;
  nav: { services: string; approach: string; contact: string; language: string };
  hero: { title: string; lead: string; cta: string; secondary: string; };
  emergency: { label: string; message: string };
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
    title: 'Tecnología pensada desde su negocio',
    lead: 'Primero entiendo cómo trabaja su organización; después diseño la solución. Cuénteme qué necesita y lo vemos por videollamada.',
    cta: 'Contar mi caso',
    secondary: 'Ver servicios',
  },
  emergency: {
    label: 'Emergencia 24/7',
    message: '🚨 *EMERGENCIA 24/7*\nNecesito asistencia técnica urgente.\n\n• Nombre:\n• Empresa / lugar:\n• Qué está pasando:',
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
    title: 'Tecnologia pensada a partir do seu negócio',
    lead: 'Primeiro entendo como sua organização trabalha; depois projeto a solução. Conte o que precisa e conversamos por videochamada.',
    cta: 'Contar meu caso',
    secondary: 'Ver serviços',
  },
  emergency: {
    label: 'Emergência 24/7',
    message: '🚨 *EMERGÊNCIA 24/7*\nPreciso de assistência técnica urgente.\n\n• Nome:\n• Empresa / local:\n• O que está acontecendo:',
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
    title: 'Technology designed around your business',
    lead: 'First I understand how your organization works; then I design the solution. Tell me what you need and we will talk it through on a video call.',
    cta: 'Tell me your case',
    secondary: 'See services',
  },
  emergency: {
    label: '24/7 Emergency',
    message: '🚨 *24/7 EMERGENCY*\nI need urgent technical assistance.\n\n• Name:\n• Company / location:\n• What is happening:',
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
