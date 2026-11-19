'use client';
/* Control de formulario genérico: dibuja cada pregunta según su tipo. */
import { site } from '@/config/site';
import { DICTIONARIES } from '@/model/i18n';
import type { AnswerValue, Locale, Question } from '@/model/types';
import { CheckIcon } from '../components/Icons';

interface FieldProps {
  question: Question;
  value: AnswerValue | undefined;
  error?: boolean;
  locale: Locale;
  onChange: (value: AnswerValue) => void;
  autoFocus?: boolean;
}

export function Field({ question: q, value, error, locale, onChange, autoFocus }: FieldProps) {
  const d = DICTIONARIES[locale].survey;
  const inputId = `f-${q.id}`;
  const errId = `${inputId}-err`;
  const hint = q.type === 'single' ? d.chooseOne : q.type === 'multi' ? d.chooseAny : null;
  const describedBy = error ? errId : undefined;

  const label = (
    <>
      {q.label[locale]}
      <span className={`field__tag ${q.required ? 'field__tag--req' : ''}`}>{q.required ? d.required : d.optional}</span>
    </>
  );

  if (q.type === 'single' || q.type === 'multi') {
    const multi = q.type === 'multi';
    const current = multi ? (Array.isArray(value) ? value : []) : typeof value === 'string' ? value : '';
    const toggle = (id: string) => {
      if (multi) {
        const arr = current as string[];
        onChange(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
      } else {
        onChange(current === id ? '' : id);
      }
    };
    return (
      <fieldset className={`field ${error ? 'field--error' : ''}`} aria-describedby={describedBy} aria-invalid={error || undefined}>
        <legend className="field__label">{label}</legend>
        {hint && <p className="field__hint">{hint}</p>}
        <div className="chips" role={multi ? 'group' : 'radiogroup'}>
          {q.options?.map((opt, i) => {
            const checked = multi ? (current as string[]).includes(opt.id) : current === opt.id;
            return (
              <label key={opt.id} className={`chip ${checked ? 'chip--on' : ''}`}>
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={inputId}
                  value={opt.id}
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  onClick={(e) => { if (!multi && checked) { e.preventDefault(); toggle(opt.id); } }}
                  autoFocus={autoFocus && i === 0}
                />
                {checked && <CheckIcon className="icon" />}
                <span>{opt.label[locale]}</span>
              </label>
            );
          })}
        </div>
        {error && <p className="field__error" id={errId}>{d.fieldRequired}</p>}
      </fieldset>
    );
  }

  const text = typeof value === 'string' ? value : '';
  const common = {
    id: inputId,
    value: text,
    placeholder: q.placeholder?.[locale],
    required: q.required,
    maxLength: site.maxTextLength,
    'aria-invalid': error || undefined,
    'aria-describedby': describedBy,
    autoFocus,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  };

  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={inputId}>{label}</label>
      {q.type === 'textarea' ? (
        <>
          <textarea {...common} rows={4} />
          <span className="field__count" aria-hidden="true">{text.length}/{site.maxTextLength}</span>
        </>
      ) : (
        <input {...common} type="text" autoComplete={q.id === 'p_nombre' ? 'name' : q.id === 'p_org' ? 'organization' : undefined} />
      )}
      {error && <p className="field__error" id={errId}>{d.fieldRequired}</p>}
    </div>
  );
}
