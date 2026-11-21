'use client';
/* Vista previa en vivo del mensaje de WhatsApp.
 * Dibuja las mismas líneas que se enviarán (src/model/message.ts) y marca como "pendientes" los datos
 * críticos que todavía faltan. Acompaña a la conversación: resalta la sección y la pregunta en curso y se
 * desplaza sola hasta ellas. */
import { useEffect, useRef } from 'react';
import { DICTIONARIES } from '@/model/i18n';
import type { MessageLine } from '@/model/message';
import type { Locale } from '@/model/types';
import type { CriticalProgress } from '@/model/validation';
import { prefersReducedMotion } from '../motion';

/** Formato de WhatsApp: *negrita* y _cursiva_. Se arma con elementos de React, nunca con HTML en crudo. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, i) => {
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <strong key={i}>{part.slice(1, -1)}</strong>;
        if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={i}>{part.slice(1, -1)}</em>;
        return part;
      })}
    </>
  );
}

interface PreviewProps {
  locale: Locale;
  lines: MessageLine[];
  progress: CriticalProgress;
  /** Sección que se está completando: se resalta y se lleva a la vista. */
  currentSectionId?: string;
  /** Pregunta que se está respondiendo: su renglón se resalta y se mantiene a la vista. */
  currentQuestionId?: string;
}

export function Preview({ locale, lines, progress, currentSectionId, currentQuestionId }: PreviewProps) {
  const d = DICTIONARIES[locale].preview;
  const bodyRef = useRef<HTMLDivElement>(null);
  const complete = progress.total > 0 && progress.done === progress.total;
  const label = complete ? d.keyDone : d.keyData(progress.done, progress.total);

  // Mantiene a la vista la pregunta en curso (o, si todavía no tiene renglón, el encabezado de su sección),
  // dentro del panel y sin mover la página. Solo se desplaza si el renglón quedó fuera de la vista.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const items = Array.from(body.querySelectorAll<HTMLElement>('[data-q],[data-section]'));
    const target =
      items.find((el) => el.dataset.q === currentQuestionId) ?? items.find((el) => el.dataset.section === currentSectionId);
    if (!target) return;
    const box = body.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    const margin = 16;
    if (rect.top >= box.top + margin && rect.bottom <= box.bottom - margin) return;
    // Un renglón más alto que el panel se alinea por arriba; el resto queda en el tercio superior.
    const offset = rect.height > box.height - margin * 2 ? margin : box.height / 3;
    body.scrollTo({ top: body.scrollTop + (rect.top - box.top) - offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [lines, currentQuestionId, currentSectionId]);

  return (
    <section className={`preview ${complete ? 'is-complete' : ''}`} aria-label={d.title}>
      <div className="preview__head">
        <div className="preview__titles">
          <h2 className="preview__title">{d.title}</h2>
          <p className="preview__hint">{d.hint}</p>
        </div>
        <div className="preview__status">
          <span className="preview__count">{label}</span>
          <div
            className="preview__meter"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            style={{ '--p': progress.total ? progress.done / progress.total : 0 } as React.CSSProperties}
          >
            <i />
          </div>
        </div>
      </div>

      {/* Región con scroll: necesita foco de teclado para poder desplazarse sin mouse. */}
      <div ref={bodyRef} className="preview__body" tabIndex={0} role="region" aria-label={d.title}>
        <div className="preview__bubble">
          {lines.map((line, i) => {
            switch (line.kind) {
              case 'gap':
                return <div key={i} className="pv-gap" />;
              case 'text':
                return <p key={i} className="pv-line"><Rich text={line.text} /></p>;
              case 'footer':
                return <p key={i} className="pv-line pv-line--footer"><Rich text={line.text} /></p>;
              case 'section':
                return (
                  <p key={i} data-section={line.sectionId} className={`pv-line pv-section ${line.sectionId === currentSectionId ? 'is-current' : ''}`}>
                    <Rich text={line.text} />
                  </p>
                );
              case 'item': {
                const pending = line.value === null;
                return (
                  // La clave cambia al pasar de pendiente a respondido: el renglón se vuelve a montar y se anima una vez.
                  <p
                    key={`${line.questionId}:${pending ? 'p' : 'v'}`}
                    data-q={line.questionId}
                    className={`pv-line pv-item ${pending ? 'is-pending' : 'is-filled'} ${line.questionId === currentQuestionId ? 'is-asking' : line.sectionId === currentSectionId ? 'is-current' : ''}`}
                  >
                    {'• '}{line.label}:{' '}
                    {pending ? (
                      <span className="pv-pending">{line.optional ? d.optional : d.pending}</span>
                    ) : line.multiline ? (
                      <span className="pv-multi">{line.value}</span>
                    ) : (
                      line.value
                    )}
                  </p>
                );
              }
            }
          })}
        </div>
      </div>
    </section>
  );
}
