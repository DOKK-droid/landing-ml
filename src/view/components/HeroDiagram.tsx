'use client';
/* Diagrama del inicio: "su negocio" al centro y los seis servicios como módulos.
 * Las conexiones se dibujan una sola vez al cargar (único movimiento automático del sitio).
 * Cada módulo lleva a su tarjeta en la sección de servicios. */
import { SERVICES } from '@/model/catalog';
import { DICTIONARIES } from '@/model/i18n';
import type { Locale, ServiceId } from '@/model/types';
import { ICON_PATHS } from './Icons';

const CX = 230;
const CY = 220;
const BOX_W = 164;
const BOX_H = 46;
const POS: Record<ServiceId, [number, number]> = {
  consultoria: [230, 56],
  desarrollo: [368, 138],
  gestion: [368, 302],
  infraestructura: [230, 384],
  ia: [92, 302],
  soporte: [92, 138],
};

/** Conector ortogonal (como en un plano): sale del centro y quiebra a 90°. */
function connector([x, y]: [number, number]): string {
  if (x === CX) return `M${CX} ${CY + (y < CY ? -32 : 32)}V${y + (y < CY ? BOX_H / 2 : -BOX_H / 2)}`;
  const sx = CX + (x > CX ? 80 : -80);
  return `M${sx} ${CY}H${x}V${y + (y < CY ? BOX_H / 2 : -BOX_H / 2)}`;
}

export function HeroDiagram({ locale, selected, onPick }: { locale: Locale; selected: ServiceId[]; onPick: (id: ServiceId) => void }) {
  const d = DICTIONARIES[locale].hero;
  return (
    <figure className="diagram">
      <svg viewBox="0 0 460 440" role="img" aria-label={d.diagram}>
        <ellipse className="diagram__orbit" cx={CX} cy={CY} rx="170" ry="178" />
        <path className="diagram__dim" d="M30 220h20M410 220h20M230 16v14M230 410v14" />

        {SERVICES.map((svc, i) => (
          <path
            key={`c-${svc.id}`}
            className={`diagram__link ${selected.includes(svc.id) ? 'is-on' : ''}`}
            d={connector(POS[svc.id])}
            style={{ '--c': svc.color, '--i': i } as React.CSSProperties}
            pathLength={1}
          />
        ))}

        <g className="diagram__core">
          <rect x={CX - 80} y={CY - 32} width="160" height="64" rx="10" />
          <text x={CX} y={CY + 6} textAnchor="middle">{d.center}</text>
        </g>

        {SERVICES.map((svc, i) => {
          const [x, y] = POS[svc.id];
          const on = selected.includes(svc.id);
          return (
            <a
              key={svc.id}
              href={`#svc-${svc.id}`}
              className={`diagram__node ${on ? 'is-on' : ''}`}
              style={{ '--c': svc.color, '--i': i } as React.CSSProperties}
              onClick={(e) => { e.preventDefault(); onPick(svc.id); }}
              aria-label={svc.title[locale]}
            >
              <rect x={x - BOX_W / 2} y={y - BOX_H / 2} width={BOX_W} height={BOX_H} rx="8" />
              <svg x={x - BOX_W / 2 + 12} y={y - 11} width="22" height="22" viewBox="0 0 24 24" className="diagram__icon" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICON_PATHS[svc.id]}
              </svg>
              <text x={x - BOX_W / 2 + 42} y={y + 5}>{svc.short[locale]}</text>
            </a>
          );
        })}
      </svg>
    </figure>
  );
}
