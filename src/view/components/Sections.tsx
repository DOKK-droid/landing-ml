'use client';
/* Secciones de la landing: hero, cómo funciona, servicios, enfoque y barra de selección. */
import { useEffect, useRef, useState } from 'react';
import { SERVICES } from '@/model/catalog';
import { DICTIONARIES } from '@/model/i18n';
import type { Locale, Service, ServiceId } from '@/model/types';
import { ArrowIcon, CheckIcon, ServiceIcon } from './Icons';
import { Logo } from './Logo';

export function Hero({ locale, onStart }: { locale: Locale; onStart: () => void }) {
  const d = DICTIONARIES[locale].hero;
  return (
    <section className="hero">
      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="eyebrow"><i aria-hidden="true" />{d.eyebrow}</p>
          <h1>{d.title}</h1>
          <p className="lead">{d.lead}</p>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary" onClick={onStart}>
              {d.cta} <ArrowIcon className="icon" />
            </button>
            <a className="btn btn--ghost" href="#servicios">{d.secondary}</a>
          </div>
        </div>
        <Logo variant="hero" className="hero__logo" />
      </div>
    </section>
  );
}

export function HowItWorks({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale].how;
  return (
    <section className="section how" aria-labelledby="how-title">
      <div className="container">
        <h2 id="how-title" className="section__title">{d.title}</h2>
        <ol className="how__steps">
          {d.steps.map((s, i) => (
            <li key={s.t} className="how__step">
              <span className="how__num" aria-hidden="true">{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

interface ServicesProps {
  locale: Locale;
  selected: ServiceId[];
  onToggle: (id: ServiceId) => void;
  onSet: (id: ServiceId, on: boolean) => void;
}

export function ServicesSection({ locale, selected, onToggle, onSet }: ServicesProps) {
  const d = DICTIONARIES[locale].services;
  const [detail, setDetail] = useState<Service | null>(null);

  return (
    <section className="section" id="servicios" aria-labelledby="svc-title">
      <div className="container">
        <h2 id="svc-title" className="section__title">{d.title}</h2>
        <p className="section__subtitle">{d.subtitle}</p>
        <ul className="services">
          {SERVICES.map((svc) => {
            const on = selected.includes(svc.id);
            return (
              <li key={svc.id} className={`card ${on ? 'card--on' : ''}`} style={{ '--c': svc.color } as React.CSSProperties}>
                <div className="card__head">
                  <span className="tile"><ServiceIcon name={svc.id} /></span>
                  <h3>{svc.title[locale]}</h3>
                </div>
                <p className="card__summary">{svc.summary[locale]}</p>
                <div className="card__actions">
                  <button type="button" className="link" onClick={() => setDetail(svc)}>{d.detail}</button>
                  <button type="button" className={`toggle ${on ? 'toggle--on' : ''}`} aria-pressed={on} onClick={() => onToggle(svc.id)}>
                    {on ? <><CheckIcon className="icon" /> {d.selected}</> : d.add}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <ServiceDialog
        locale={locale}
        service={detail}
        selected={detail ? selected.includes(detail.id) : false}
        onClose={() => setDetail(null)}
        onSet={(on) => { if (detail) onSet(detail.id, on); setDetail(null); }}
      />
    </section>
  );
}

function ServiceDialog({ locale, service, selected, onClose, onSet }: {
  locale: Locale; service: Service | null; selected: boolean; onClose: () => void; onSet: (on: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const d = DICTIONARIES[locale].services;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (service && !el.open) el.showModal();
    if (!service && el.open) el.close();
  }, [service]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dlg-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={service ? ({ '--c': service.color } as React.CSSProperties) : undefined}
    >
      {service && (
        <div className="dialog__body">
          <div className="card__head">
            <span className="tile"><ServiceIcon name={service.id} /></span>
            <h3 id="dlg-title">{service.title[locale]}</h3>
          </div>
          <p>{service.summary[locale]}</p>
          <h4>{d.includes}</h4>
          <ul className="checklist">
            {service.includes.map((item) => (
              <li key={item.es}><CheckIcon className="icon" />{item[locale]}</li>
            ))}
          </ul>
          <h4>{d.needs}</h4>
          <p className="dialog__needs">{service.needs[locale]}</p>
          <div className="dialog__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>{d.close}</button>
            <button type="button" className="btn btn--primary" onClick={() => onSet(!selected)}>
              {selected ? d.remove : d.add}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

export function Approach({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale].approach;
  return (
    <section className="section approach" id="enfoque" aria-labelledby="ap-title">
      <div className="container approach__inner">
        <h2 id="ap-title" className="section__title">{d.title}</h2>
        <ul className="approach__list">
          {d.items.map((item) => <li key={item}><CheckIcon className="icon" />{item}</li>)}
        </ul>
        <p className="approach__note">{d.note}</p>
      </div>
    </section>
  );
}

export function SelectionBar({ locale, count, onContinue, onClear }: { locale: Locale; count: number; onContinue: () => void; onClear: () => void }) {
  const d = DICTIONARIES[locale].bar;
  if (!count) return null;
  return (
    <div className="selbar" role="region" aria-live="polite" aria-label={d.selected(count)}>
      <div className="container selbar__inner">
        <span className="selbar__count">{d.selected(count)}</span>
        <button type="button" className="link" onClick={onClear}>{d.clear}</button>
        <button type="button" className="btn btn--primary" onClick={onContinue}>
          {d.continue} <ArrowIcon className="icon" />
        </button>
      </div>
    </div>
  );
}
