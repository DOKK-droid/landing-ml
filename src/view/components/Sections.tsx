'use client';
/* Secciones de la landing: inicio, pasos, servicios, enfoque y barra de selección. */
import { SERVICES } from '@/model/catalog';
import { DICTIONARIES } from '@/model/i18n';
import type { Locale, ServiceId } from '@/model/types';
import { ArrowIcon, CheckIcon, ServiceIcon } from './Icons';
import { Logo } from './Logo';
import { ServiceArt } from './ServiceArt';

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
          <HowItWorks locale={locale} />
        </div>
        <Logo variant="hero" className="hero__logo" />
      </div>
    </section>
  );
}

function HowItWorks({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale].how;
  return (
    <ol className="steps" aria-label={d.title}>
      {d.steps.map((s, i) => (
        <li key={s.t}>
          <span className="steps__n" aria-hidden="true">{i + 1}</span>
          <span><strong>{s.t}</strong> {s.d}</span>
        </li>
      ))}
    </ol>
  );
}

interface ServicesProps {
  locale: Locale;
  selected: ServiceId[];
  openId: ServiceId | null;
  onOpen: (id: ServiceId | null) => void;
  onToggle: (id: ServiceId) => void;
}

export function ServicesSection({ locale, selected, openId, onOpen, onToggle }: ServicesProps) {
  const d = DICTIONARIES[locale].services;
  return (
    <section className="section" id="servicios" aria-labelledby="svc-title">
      <div className="container">
        <header className="section__head">
          <h2 id="svc-title" className="section__title">{d.title}</h2>
          <p className="section__subtitle">{d.subtitle}</p>
        </header>
        <ul className="sheets">
          {SERVICES.map((svc) => {
            const on = selected.includes(svc.id);
            const open = openId === svc.id;
            return (
              <li
                key={svc.id}
                id={`svc-${svc.id}`}
                className={`sheet ${on ? 'is-on' : ''} ${open ? 'is-open' : ''}`}
                style={{ '--c': svc.color } as React.CSSProperties}
              >
                <div className="sheet__art">
                  <ServiceArt id={svc.id} />
                </div>
                <div className="sheet__detail" id={`det-${svc.id}`}>
                  <h4 className="sheet__detail-title">{svc.title[locale]}</h4>
                  <p>{svc.summary[locale]}</p>
                  <h4>{d.includes}</h4>
                  <ul>
                    {svc.includes.map((it) => <li key={it.es}><CheckIcon className="icon" />{it[locale]}</li>)}
                  </ul>
                </div>
                <div className="sheet__body">
                  <div className="sheet__head">
                    <span className="tile"><ServiceIcon name={svc.id} /></span>
                    <h3>{svc.title[locale]}</h3>
                  </div>
                  <p className="sheet__tag">{svc.tagline[locale]}</p>
                  <div className="sheet__actions">
                    <button type="button" className="link" aria-expanded={open} aria-controls={`det-${svc.id}`} onClick={() => onOpen(open ? null : svc.id)}>
                      {open ? d.hide : d.detail}
                    </button>
                    <button type="button" className={`toggle ${on ? 'toggle--on' : ''}`} aria-pressed={on} onClick={() => onToggle(svc.id)}>
                      {on ? <><CheckIcon className="icon" />{d.selected}</> : d.add}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function Approach({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale].approach;
  return (
    <section className="section approach" id="enfoque" aria-labelledby="ap-title">
      <div className="container">
        <h2 id="ap-title" className="approach__title">{d.title}</h2>
        <ul className="approach__list">
          {d.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
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
