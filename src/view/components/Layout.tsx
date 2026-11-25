/* Cabecera, selector de idioma, pie y botón de emergencia. */
import Link from 'next/link';
import { site } from '@/config/site';
import { crmEnabled } from '@/model/crm';
import { DICTIONARIES, LOCALE_NAMES } from '@/model/i18n';
import { buildWhatsAppUrl } from '@/model/message';
import { pagePath, type Page } from '@/model/seo';
import { LOCALES, type Locale } from '@/model/types';
import { LinkedInIcon, MailIcon, WhatsAppIcon } from './Icons';
import { Logo } from './Logo';

/**
 * Cabecera. `page` es la página en la que está: en el inicio (`home`) el menú salta a las secciones y el logo vuelve al
 * principio del relevamiento (`onHome`); en las tarifas (`rates`) lleva de vuelta al inicio, así que usa direcciones completas.
 *
 * Entre el inicio y las tarifas se navega con `<Link>` (sin recargar: la página, el banner de carga y los scripts ya están).
 * El selector de idioma, en cambio, es un `<a>` normal a propósito: cada idioma es otra página con su propio <html> y su propio
 * script de reanudación, y cambiar de idioma tiene que cargarla entera.
 */
export function SiteHeader({ locale, onHome, compact, page = 'home' }: { locale: Locale; onHome?: () => void; compact?: boolean; page?: Page }) {
  const d = DICTIONARIES[locale];
  const home = pagePath('home', locale);
  // En el inicio alcanza con el ancla (es la misma página); desde otra hay que volver al inicio y de ahí bajar a la sección.
  const section = (id: string, label: string) =>
    page === 'home' ? <a href={`#${id}`}>{label}</a> : <Link href={`${home}#${id}`}>{label}</Link>;
  const brand = (
    <>
      <Logo className="brand__mark" />
      <span className="brand__text">
        <strong>Mariano Lemos Barbaro</strong>
        <small>{d.role}</small>
      </span>
    </>
  );
  return (
    <header className="header">
      <div className="container header__inner">
        {onHome ? (
          // En el inicio no se navega: el logo vuelve al principio del relevamiento.
          <a className="brand" href={home} onClick={(e) => { e.preventDefault(); onHome(); }}>{brand}</a>
        ) : (
          <Link className="brand" href={home}>{brand}</Link>
        )}
        {!compact && (
          <nav className="header__nav" aria-label="Principal">
            {section('servicios', d.nav.services)}
            <Link href={pagePath('rates', locale)} aria-current={page === 'rates' ? 'page' : undefined}>{d.nav.rates}</Link>
            {section('enfoque', d.nav.approach)}
            <a href="#contacto">{d.nav.contact}</a>
          </nav>
        )}
        <LanguageSwitcher locale={locale} page={page} />
      </div>
    </header>
  );
}

/** Cada enlace lleva a la misma página en el otro idioma (desde las tarifas, a las tarifas). */
export function LanguageSwitcher({ locale, page = 'home' }: { locale: Locale; page?: Page }) {
  return (
    <nav className="lang" aria-label={DICTIONARIES[locale].nav.language}>
      {LOCALES.map((l) => (
        <a key={l} href={pagePath(page, l)} hrefLang={l} lang={l} aria-current={l === locale ? 'true' : undefined} title={LOCALE_NAMES[l]}>
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

export function EmergencyButton({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale].emergency;
  return (
    <a className="emergency" href={buildWhatsAppUrl(d.message)} target="_blank" rel="noopener noreferrer" aria-label={d.label}>
      <span className="emergency__pulse" aria-hidden="true" />
      <WhatsAppIcon className="icon" />
      <span className="emergency__full">{d.label}</span>
      <span className="emergency__short" aria-hidden="true">24/7</span>
    </a>
  );
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const d = DICTIONARIES[locale];
  return (
    <footer className="footer" id="contacto">
      <div className="container footer__inner" data-reveal>
        <div className="footer__brand">
          <Logo className="footer__mark" />
          <div>
            <strong>Mariano Lemos Barbaro</strong>
            <p>{d.role}</p>
            <p className="footer__tagline">{d.tagline}</p>
          </div>
        </div>
        <ul className="footer__contact">
          <li>
            <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="icon" /> {site.whatsappDisplay} <span className="badge">24/7</span>
            </a>
          </li>
          <li>
            <a href={`mailto:${site.email}`}><MailIcon className="icon" /> {site.email}</a>
          </li>
          <li>
            <a href={site.linkedin} target="_blank" rel="noopener noreferrer"><LinkedInIcon className="icon" /> {d.footer.linkedin}</a>
          </li>
        </ul>
      </div>
      <div className="container footer__legal">
        <p>{crmEnabled() ? d.footer.privacyCrm : d.footer.privacy}</p>
        <p>{d.footer.rights(new Date().getFullYear())}</p>
      </div>
    </footer>
  );
}
