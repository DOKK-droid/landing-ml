'use client';
/* ============================================================
 * CONTROLADOR — Hook que conecta la máquina de estados con la vista.
 * Persiste en sessionStorage para no perder respuestas al cambiar de idioma.
 * ============================================================ */
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { site } from '@/config/site';
import { buildSections } from '@/model/catalog';
import { buildSubmission, crmEnabled, newIdempotencyKey } from '@/model/crm';
import { buildFlow } from '@/model/flow';
import { DICTIONARIES } from '@/model/i18n';
import { buildLines, buildMessage, buildWhatsAppUrl, createReference, isServerReference, replaceReference } from '@/model/message';
import type { Answers, AnswerValue, Locale, ServiceId } from '@/model/types';
import { criticalProgress } from '@/model/validation';
import { registerLead } from './registerLead';
import { RESUME_ATTR, STORAGE_KEY } from './resume';
import { initialState, surveyReducer, type SurveyState } from './surveyReducer';
import { visitKey } from './visit';

/** Espera tras la última tecla antes de guardar: evita serializar y escribir el estado completo en cada pulsación. */
const SAVE_DELAY_MS = 250;

/** Resultado de intentar registrar la consulta: el texto final para WhatsApp y si quedó en el CRM. */
export interface SendOutcome {
  text: string;
  registered: boolean;
}

/** Lo que el CRM respondió en esta visita: la referencia y qué envío de ese `CRM Lead` fue (2 o más: la misma persona reenvió). */
export interface Registration {
  reference: string;
  submission: number;
}

/** Lo que `register` necesita del widget de Turnstile (ver controller/turnstile.ts). */
export interface TokenSource {
  getToken: (waitMs: number) => Promise<string | null>;
  consume: () => void;
}

export function useSurvey(locale: Locale) {
  const [state, dispatch] = useReducer(surveyReducer, initialState);
  /** Lo que respondió el servidor si el último envío quedó registrado (no se guarda: es solo para mostrarlo al final). */
  const [registration, setRegistration] = useState<Registration | null>(null);
  const attempt = useRef<{ answers: Answers; selected: ServiceId[]; origin: string; draft: string | null; key: string } | null>(null);
  // `ready`: ya se leyó el almacenamiento. Hasta entonces no se guarda nada, o se pisaría lo guardado con el
  // estado vacío (en desarrollo, Strict Mode ejecuta los efectos dos veces y lo hacía).
  const [ready, setReady] = useState(false);
  const pending = useRef<SurveyState | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: 'HYDRATE', state: JSON.parse(raw) });
    } catch {
      /* almacenamiento no disponible: se sigue en memoria */
    }
    // Trazabilidad: ?o=tarjeta (QR de la tarjeta) queda en el estado y viaja en el mensaje.
    const origin = new URLSearchParams(window.location.search).get('o');
    if (origin) dispatch({ type: 'SET_ORIGIN', origin });
    setReady(true); // mismo lote que HYDRATE: un único render con el estado restaurado
  }, []);

  // Con el estado ya restaurado y antes de pintar, se muestra la página (ver resume.ts).
  // Va en un efecto de layout para que los efectos de la vista (foco al título del paso) ya la encuentren visible.
  useLayoutEffect(() => {
    if (ready) document.documentElement.removeAttribute(RESUME_ATTR);
  }, [ready]);

  /** Escribe de inmediato el último estado pendiente (si lo hay). */
  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    if (!pending.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending.current));
    } catch {
      /* ignorar */
    }
    pending.current = null;
  }, []);

  useEffect(() => {
    if (!ready) return;
    pending.current = state;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }, [ready, state, flush]);

  // Al cambiar de idioma (otra página) o cerrar la pestaña no se pierde lo último escrito.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, [flush]);

  const sections = useMemo(() => buildSections(state.selected), [state.selected]);
  const flow = useMemo(() => buildFlow(sections), [sections]);
  /** Pregunta que se está respondiendo (solo en la fase de preguntas). */
  const current = state.phase === 'survey' ? flow[state.cursor] : undefined;
  const focusId = current?.question.id;

  // El texto solo se usa en la revisión y al enviar: no se reconstruye mientras se escribe cada respuesta.
  const needsMessage = state.phase === 'review' || state.phase === 'sent';
  const generated = useMemo(
    () => (needsMessage ? buildMessage({ locale, selected: state.selected, sections, answers: state.answers, reference: state.reference, origin: state.origin }) : ''),
    [needsMessage, locale, state.selected, sections, state.answers, state.reference, state.origin],
  );

  // Vista previa en vivo mientras se responde. `useDeferredValue` deja que lo que se escribe tenga prioridad
  // y que la vista previa se ponga al día enseguida, sin trabarse en cada tecla.
  const inSurvey = state.phase === 'survey';
  const deferredAnswers = useDeferredValue(state.answers);
  const previewLines = useMemo(
    () => (inSurvey ? buildLines({ locale, selected: state.selected, sections, answers: deferredAnswers, reference: state.reference, origin: state.origin }, { pending: true, focusId }) : []),
    [inSurvey, locale, state.selected, sections, deferredAnswers, state.reference, state.origin, focusId],
  );
  const progress = useMemo(() => criticalProgress(sections, deferredAnswers), [sections, deferredAnswers]);
  const message = state.draft ?? generated;

  const actions = useMemo(
    () => ({
      toggleService: (id: ServiceId) => dispatch({ type: 'TOGGLE_SERVICE', id }),
      setService: (id: ServiceId, selected: boolean) => dispatch({ type: 'SET_SERVICE', id, selected }),
      clearServices: () => dispatch({ type: 'CLEAR_SERVICES' }),
      start: () => dispatch({ type: 'START', reference: createReference() }),
      setAnswer: (id: string, value: AnswerValue) => dispatch({ type: 'SET_ANSWER', id, value }),
      next: () => dispatch({ type: 'NEXT' }),
      back: () => dispatch({ type: 'BACK' }),
      goToSection: (section: number) => dispatch({ type: 'GO_TO_SECTION', section }),
      exit: () => dispatch({ type: 'EXIT' }),
      setDraft: (text: string) => dispatch({ type: 'SET_DRAFT', text }),
      markSent: () => dispatch({ type: 'SENT' }),
      restart: () => dispatch({ type: 'RESTART' }),
    }),
    [],
  );

  /** El texto marcado «sin registro» junto a la referencia (si el sitio tiene la conexión con el CRM). */
  const markUnregistered = useCallback(
    (text: string) => crmEnabled() ? replaceReference(text, state.reference, `${state.reference} (${DICTIONARIES[locale].message.unregistered})`) : text,
    [locale, state.reference],
  );

  /**
   * El enlace de siempre, el que se usa sin consentimiento. Si la consulta ya tiene la referencia del servidor (se registró
   * antes en esta visita y ahora se reenvía sin registrar), va marcada «sin registro»: esta versión no está en el CRM.
   */
  const whatsappUrl = useCallback(
    () => buildWhatsAppUrl(isServerReference(state.reference) ? markUnregistered(message) : message),
    [message, state.reference, markUnregistered],
  );

  /**
   * Misma clave mientras el contenido no cambie: un reintento (respuesta perdida, clic doble) no crea otra consulta; si el
   * cliente cambia algo, también el mensaje editado a mano, sí.
   */
  const keyFor = useCallback(() => {
    const last = attempt.current;
    if (last && last.answers === state.answers && last.selected === state.selected && last.origin === state.origin && last.draft === state.draft) return last.key;
    attempt.current = { answers: state.answers, selected: state.selected, origin: state.origin, draft: state.draft, key: newIdempotencyKey() };
    return attempt.current.key;
  }, [state.answers, state.selected, state.origin, state.draft]);

  /**
   * Registra la consulta en el CRM (si el cliente lo consintió) y devuelve el texto que va a WhatsApp. Nunca lanza y siempre
   * devuelve un texto enviable: si algo falla, el mensaje sale con su referencia marcada «sin registro».
   *
   * Si el servidor lo sumó a un `CRM Lead` anterior de la misma persona (envío 2 o más), el mensaje lo dice junto a la
   * referencia, que es la misma de antes: «ML-261125-0001 (envío 2)», como el título de la nota en el CRM.
   */
  const register = useCallback(
    async ({ consent, turnstile }: { consent: boolean; turnstile: TokenSource }): Promise<SendOutcome> => {
      const local = state.reference;
      const unregistered = (): SendOutcome => {
        setRegistration(null);
        return { text: markUnregistered(message), registered: false };
      };
      if (!consent || !crmEnabled()) return unregistered();

      const token = await turnstile.getToken(site.crm.tokenWaitMs);
      if (!token) return unregistered();
      const submission = buildSubmission({
        locale, selected: state.selected, sections, answers: state.answers, origin: state.origin,
        idempotencyKey: keyFor(), visitKey: visitKey(), turnstile: token, message: state.draft,
      });
      const result = await registerLead(submission, { url: site.crm.url, timeoutMs: site.crm.timeoutMs });
      turnstile.consume(); // el token es de un solo uso, haya salido bien o no
      if (!result.ok) return unregistered();
      setRegistration({ reference: result.reference, submission: result.submission });
      dispatch({ type: 'REGISTERED', reference: result.reference });
      const label = result.submission > 1
        ? `${result.reference} (${DICTIONARIES[locale].message.followUp(result.submission)})`
        : result.reference;
      return { text: replaceReference(message, local, label), registered: true };
    },
    [locale, message, sections, state.answers, state.draft, state.origin, state.reference, state.selected, keyFor, markUnregistered],
  );

  return {
    state,
    sections,
    flow,
    current,
    previewLines,
    progress,
    message,
    whatsappUrl,
    register,
    registration,
    actions,
  };
}

export type SurveyController = ReturnType<typeof useSurvey>;
