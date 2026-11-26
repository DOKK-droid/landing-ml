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
import { LOCALES } from '@/model/types';

/**
 * Cambia con cada versión del formulario que cambia las preguntas: v2 cambió el orden de los pasos; v4 cambió los ids y
 * las condiciones (un cursor o una respuesta de v3 apuntaría a otra pregunta); v5 agregó el diagnóstico y movió secciones.
 * Un relevamiento a medias de otra versión se descarta.
 */
export const STORAGE_KEY = 'ml-relevamiento-v5';
export const RESUME_ATTR = 'data-resume';

/** Red de seguridad: si la hidratación tarda o falla, la landing se muestra igual pasado este tiempo. */
export const RESUME_FAILSAFE_MS = 5000;

const attr = JSON.stringify(RESUME_ATTR);

/** Dirección del inicio de cada idioma ("/es/", y también "/es" o "/es/index.html"). El relevamiento solo existe ahí: el script está en el
 *  <head> de todo `[locale]`, y en otra página (las tarifas) ocultaría el contenido hasta que venza la red de seguridad, porque nada lo restaura. */
const HOME_PATH = new RegExp(`^/(${LOCALES.join('|')})(/(index\\.html)?)?$`);

/** Script para <head>. Sin dependencias: se ejecuta tal cual en el navegador y no debe lanzar errores. */
export const resumeScript =
  `(function(){try{` +
  `if(!/${HOME_PATH.source}/.test(location.pathname))return;` +
  `var s=JSON.parse(sessionStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"null");` +
  // La referencia válida es parte de la condición porque sanitize() manda a la landing un estado sin ella.
  `if(s&&/^(survey|review|sent)$/.test(s.phase)&&Array.isArray(s.selected)&&s.selected.length` +
  `&&typeof s.reference==="string"&&/${REFERENCE_PATTERN.source}/.test(s.reference)){` +
  `var d=document.documentElement;d.setAttribute(${attr},"");` +
  `setTimeout(function(){d.removeAttribute(${attr})},${RESUME_FAILSAFE_MS})}` +
  `}catch(e){}})();`;
