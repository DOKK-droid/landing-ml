/* Cabecera, selector de idioma, pie y botón de emergencia. */
import { site } from '@/config/site';
import { DICTIONARIES, LOCALE_NAMES } from '@/model/i18n';
import { buildWhatsAppUrl } from '@/model/message';
import { LOCALES, type Locale } from '@/model/types';
import { LinkedInIcon, MailIcon, WhatsAppIcon } from './Icons';
import { Logo } from './Logo';

export function SiteHeader({ locale, onHome, compact }: { locale: Locale; onHome: () => void; compact?: boolean }) {
  const d = DICTIONARIES[locale];
  return (
    <header className="header">
      <div className="container header__inner">
        <a className="brand" href={`/${locale}/`} onClick={(e) => { e.preventDefault(); onHome(); }}>
          <Logo className="brand__mark" />
          <span className="brand__text">
            <strong>Mariano Lemos Barbaro</strong>
            <small>{d.role}</small>
          </span>
        </a>
        {!compact && (
          <nav className="header__nav" aria-label="Principal">
            <a href="#servicios">{d.nav.services}</a>
            <a href="#enfoque">{d.nav.approach}</a>
            <a href="#contacto">{d.nav.contact}</a>
          </nav>
        )}
        <LanguageSwitcher locale={locale} />
      </div>
    </header>
  );
}

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  return (
    <nav className="lang" aria-label={DICTIONARIES[locale].nav.language}>
      {LOCALES.map((l) => (
        <a key={l} href={`/${l}/`} hrefLang={l} lang={l} aria-current={l === locale ? 'true' : undefined} title={LOCALE_NAMES[l]}>
          {l.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

export function EmergencyButton({ locale, raised }: { locale: Locale; raised?: boolean }) {
  const d = DICTIONARIES[locale].emergency;
  return (
    <a className={`emergency ${raised ? 'emergency--raised' : ''}`} href={buildWhatsAppUrl(d.message)} target="_blank" rel="noopener noreferrer" aria-label={d.label}>
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
        <p>{d.footer.privacy}</p>
        <p>{d.footer.rights(new Date().getFullYear())}</p>
      </div>
    </footer>
  );
}
