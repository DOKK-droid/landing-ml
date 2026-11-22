'use client';
/* Secciones de la landing: inicio, pasos, servicios, enfoque y barra de selección. */
import { useRef } from 'react';
import { SERVICES } from '@/model/catalog';
import { DICTIONARIES, type Dictionary } from '@/model/i18n';
import { CONSULTA, discountPercent, EXAMPLE_MINUTES, formatDuration, formatMoney, hourly, meetingCost, offerFigures, offerRates, type OfferRate } from '@/model/offer';
import type { Locale, ServiceId } from '@/model/types';
import { usePresence } from '../motion';
import { ArrowIcon, CheckIcon, ServiceIcon } from './Icons';
import { HeroDiagram } from './HeroDiagram';
import { Logo } from './Logo';
import { ServiceArt } from './ServiceArt';

export function Hero({ locale, onStart }: { locale: Locale; onStart: () => void }) {
  const d = DICTIONARIES[locale].hero;
  const c = DICTIONARIES[locale].consulta;
  const fig = offerFigures();
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
          <a className="hero__offer" href="#consulta">
            <span aria-hidden="true">{c.hero} · {c.hourShort}</span>
            <s aria-hidden="true">{fig.hourOriginal}</s>
            <b aria-hidden="true">{fig.hour}</b>
            <span className="sr-only">{c.hero}: {c.srPrice(fig)}</span>
          </a>
        </div>
        <Logo variant="hero" className="hero__logo" sweep="visible" />
      </div>
    </section>
  );
}

export function Concept({ locale, selected, onPick }: { locale: Locale; selected: ServiceId[]; onPick: (id: ServiceId) => void }) {
  const d = DICTIONARIES[locale].concept;
  return (
    <section className="section concept" id="enfoque-negocio" aria-labelledby="concept-title">
      <div className="container concept__inner">
        <div className="concept__copy" data-reveal>
          <h2 id="concept-title" className="section__title">{d.title}</h2>
          <p className="concept__lead">{d.lead}</p>
          <HowItWorks locale={locale} />
        </div>
        <HeroDiagram locale={locale} selected={selected} onPick={onPick} />
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
  /** Servicio que recibe el destello al llegar desde el diagrama en escritorio. */
  flashId: ServiceId | null;
  onOpen: (id: ServiceId | null) => void;
  onToggle: (id: ServiceId) => void;
}

export function ServicesSection({ locale, selected, openId, flashId, onOpen, onToggle }: ServicesProps) {
  const d = DICTIONARIES[locale].services;
  return (
    <section className="section" id="servicios" aria-labelledby="svc-title">
      <div className="container">
        <header className="section__head">
          <h2 id="svc-title" className="section__title">{d.title}</h2>
          <p className="section__subtitle">{d.subtitle}</p>
        </header>
        <ul className="sheets">
          {SERVICES.map((svc, i) => {
            const on = selected.includes(svc.id);
            const open = openId === svc.id;
            return (
              <li
                key={svc.id}
                id={`svc-${svc.id}`}
                className={`sheet ${on ? 'is-on' : ''} ${open ? 'is-open' : ''} ${flashId === svc.id ? 'is-flash' : ''}`}
                style={{ '--c': svc.color, '--rd': `${(i % 3) * 90}ms` } as React.CSSProperties}
                data-reveal
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
                    <button type="button" className="link sheet__more" aria-expanded={open} aria-controls={`det-${svc.id}`} onClick={() => onOpen(open ? null : svc.id)}>
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

/** Rótulo de un tramo de la tarifa: "Menos de 1 h · tarifa normal", "De 1 h a 2 h", "Más de 3 h 30 min". */
function tierLabel(d: Dictionary['consulta'], r: OfferRate): string {
  if (r.regular) return d.tierBelow(formatDuration(r.to!));
  return r.to === null ? d.tierFrom(formatDuration(r.from)) : d.tierBetween(formatDuration(r.from), formatDuration(r.to));
}

/** Oferta del relevamiento técnico: tarifa por tramos, referencia por bloque y costo total de ejemplo. Los valores salen de src/config/site.ts. */
export function OfferSection({ locale, onStart }: { locale: Locale; onStart: () => void }) {
  const d = DICTIONARIES[locale].consulta;
  const fig = offerFigures();
  return (
    <section className="section offer" id="consulta" aria-labelledby="offer-title">
      <div className="container">
        <div className="offer__card" data-reveal>
          <div className="offer__copy">
            <span className="offer__badge">{d.badge}</span>
            <h2 id="offer-title" className="section__title">{d.title}</h2>
            <p className="offer__lead">{d.lead}</p>
            <p className="offer__billing">{d.billing(CONSULTA.minutes, fig.from)}</p>
            <p className="offer__support">{d.support} <a href="#svc-soporte">{d.supportLink}</a></p>
          </div>
          <div className="offer__price">
            <p className="sr-only">{d.srPrice(fig)}</p>
            <p className="offer__amounts" aria-hidden="true">
              <s className="offer__old">{fig.hourOriginal}</s>
              <span className="offer__now">{fig.hour}</span>
              <span className="offer__off">{d.off(discountPercent(CONSULTA))}</span>
            </p>
            <p className="offer__per" aria-hidden="true">{d.perHour}</p>
            <p className="offer__equals" aria-hidden="true">{d.equals(fig)}</p>
            <div className="offer__examples offer__tiers">
              <p className="offer__examples-title">{d.tiersTitle(CONSULTA.minutes)}</p>
              <ul>
                {offerRates().map((r) => (
                  <li key={r.from}>
                    <span className="offer__dur">{tierLabel(d, r)}</span>
                    <span className="offer__rate">{formatMoney(r.price, CONSULTA.currency)} / {CONSULTA.minutes} min</span>
                    <b>{formatMoney(hourly(r.price), CONSULTA.currency)} / h</b>
                  </li>
                ))}
              </ul>
            </div>
            <div className="offer__examples">
              <p className="offer__examples-title">{d.examples}</p>
              <ul>
                {EXAMPLE_MINUTES.map((minutes) => {
                  const cost = meetingCost(minutes);
                  return (
                    <li key={minutes}>
                      <span className="offer__dur">{formatDuration(minutes)}</span>
                      {cost.price < cost.originalPrice
                        ? <s><span className="sr-only">{d.was} </span>{formatMoney(cost.originalPrice, CONSULTA.currency)}</s>
                        : <span aria-hidden="true" />}
                      <b>{formatMoney(cost.price, CONSULTA.currency)}</b>
                    </li>
                  );
                })}
              </ul>
            </div>
            <button type="button" className="btn btn--primary" onClick={onStart}>
              {d.cta} <ArrowIcon className="icon" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Approach({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale].approach;
  return (
    <section className="section approach" id="enfoque" aria-labelledby="ap-title">
      <div className="container">
        <h2 id="ap-title" className="approach__title" data-reveal>{d.title}</h2>
        <ul className="approach__list" data-reveal style={{ '--rd': '90ms' } as React.CSSProperties}>
          {d.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </section>
  );
}

export function SelectionBar({ locale, count, onContinue, onClear }: { locale: Locale; count: number; onContinue: () => void; onClear: () => void }) {
  const d = DICTIONARIES[locale].bar;
  // La barra desliza al entrar y al salir: se mantiene montada 320 ms tras llegar a 0 y conserva el último conteo
  // para no mostrar "0 servicios" mientras desaparece.
  const { mounted, leaving } = usePresence(count > 0, 320);
  const lastCount = useRef(count);
  if (count > 0) lastCount.current = count;
  if (!mounted) return null;
  const shown = count > 0 ? count : lastCount.current;
  return (
    <div className={`selbar ${leaving ? 'is-leaving' : ''}`} role="region" aria-live="polite" aria-label={d.selected(shown)} inert={leaving}>
      <div className="container selbar__inner">
        <span className="selbar__count">{d.selected(shown)}</span>
        <button type="button" className="link" onClick={onClear}>{d.clear}</button>
        <button type="button" className="btn btn--primary" onClick={onContinue}>
          {d.continue} <ArrowIcon className="icon" />
        </button>
      </div>
    </div>
  );
}
