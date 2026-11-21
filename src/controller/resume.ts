/* ============================================================
 * CONTROLADOR — Reanudar el relevamiento tras cambiar de idioma (o recargar).
 *
 * Cada idioma es una página estática distinta, y su HTML siempre arranca en la landing: el estado guardado
 * solo se puede aplicar cuando React hidrata. Entre ambos momentos se vería un destello de landing
 * antes de volver al paso en curso.
 *
 * Solución (guía "preventing flash before hydration" de Next): un script inline en <head> corre mientras
 * el navegador lee el HTML, antes del primer pintado. Si hay un relevamiento en curso marca <html> con
 * `data-resume`; el CSS oculta la landing mientras tanto y useSurvey quita la marca al restaurar el estado.
 * ============================================================ */
import { REFERENCE_PATTERN } from '@/model/message';

/** v2: cambió el orden de los pasos (actividad → servicios → expectativas → contacto); un `step` guardado en v1 apuntaría a otra sección. */
export const STORAGE_KEY = 'ml-relevamiento-v3';
export const RESUME_ATTR = 'data-resume';

/** Red de seguridad: si la hidratación tarda o falla, la landing se muestra igual pasado este tiempo. */
export const RESUME_FAILSAFE_MS = 5000;

const attr = JSON.stringify(RESUME_ATTR);

/** Script para <head>. Sin dependencias: se ejecuta tal cual en el navegador y no debe lanzar errores. */
export const resumeScript =
  `(function(){try{` +
  `var s=JSON.parse(sessionStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"null");` +
  // La referencia válida es parte de la condición porque sanitize() manda a la landing un estado sin ella.
  `if(s&&/^(survey|review|sent)$/.test(s.phase)&&Array.isArray(s.selected)&&s.selected.length` +
  `&&typeof s.reference==="string"&&/${REFERENCE_PATTERN.source}/.test(s.reference)){` +
  `var d=document.documentElement;d.setAttribute(${attr},"");` +
  `setTimeout(function(){d.removeAttribute(${attr})},${RESUME_FAILSAFE_MS})}` +
  `}catch(e){}})();`;
