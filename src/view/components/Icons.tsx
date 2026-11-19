/* Íconos de línea (24×24, trazo 1.6). */
import type { IconName } from '@/model/types';

const paths: Record<IconName, React.ReactNode> = {
  consultoria: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      <circle cx="18.5" cy="6.5" r="2.5" />
      <path d="M20.3 8.3L22 10" />
    </>
  ),
  desarrollo: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M9 9l-2.5 2.5L9 14M15 9l2.5 2.5L15 14M12.8 8.5l-1.6 6" />
      <path d="M8 21h8" />
    </>
  ),
  gestion: (
    <>
      <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" />
      <path d="M8.5 6h7M7.2 8.2l3.6 7.6M16.8 8.2l-3.6 7.6" />
    </>
  ),
  infraestructura: (
    <>
      <rect x="4" y="3" width="16" height="6" rx="1.5" /><rect x="4" y="11" width="16" height="6" rx="1.5" />
      <path d="M8 6h.01M8 14h.01M12 17v4M8 21h8" />
    </>
  ),
  ia: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
      <path d="M9.5 15l1.5-6h2l1.5 6M10 13h4M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
    </>
  ),
  soporte: (
    <>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.3-.3-2.4z" />
    </>
  ),
};

export function ServiceIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21l1.6-4.8A9 9 0 1 1 8 19.4L3 21z" />
      <path d="M9 8.5c0 3.3 2.7 6 6 6l1-1.5-2-1-1 .7a3.6 3.6 0 0 1-1.6-1.6l.7-1-1-2L9 8.5z" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ArrowIcon({ className, dir = 'right' }: { className?: string; dir?: 'right' | 'left' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={dir === 'left' ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 7l8.5 6.5L20.5 7" />
    </svg>
  );
}

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10.5V17M8 7.5v.01M12 17v-6.5M12 13.2c0-1.6 1-2.7 2.5-2.7S17 11.5 17 13.2V17" />
    </svg>
  );
}
