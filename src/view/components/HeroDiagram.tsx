'use client';
/* Diagrama de la sección "Tecnología pensada desde su negocio": "su negocio" al centro y los seis servicios como módulos.
 *
 * Se anima con el scroll, no al cargar: a medida que la figura sube por la pantalla, la línea punteada se dibuja en
 * sentido horario como un reloj (una aguja larga marca la punta del trazo y una corta avanza despacio) y las marcas de
 * las horas se encienden al pasar. Cuando el círculo se cierra —con la figura ya entera a la vista, no cortada por el
 * borde de la pantalla— estalla la animación completa: onda expansiva, conexiones, módulos y el centro.
 * Esa parte se dispara una sola vez; lo demás sigue al scroll con algo de inercia (view/clock.ts).
 * Cada módulo lleva a su tarjeta en la sección de servicios. */
import { useEffect, useId, useRef, useState } from 'react';
import { SERVICES } from '@/model/catalog';
import { DICTIONARIES } from '@/model/i18n';
import type { Locale, ServiceId } from '@/model/types';
import { chase, makeEllipse, scrollProgress, visibleFraction } from '../clock';
import { prefersReducedMotion } from '../motion';
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

/** Semiejes de la órbita punteada y semimedidas del recuadro central ("su negocio"). */
const RX = 170;
const RY = 178;
const CORE_HALF = [80, 32] as const;
const ELLIPSE = makeEllipse(RX, RY);
/** La órbita arranca a las 12 y va en sentido horario: dos semiarcos. */
const ORBIT = `M${CX} ${CY - RY}A${RX} ${RY} 0 0 1 ${CX} ${CY + RY}A${RX} ${RY} 0 0 1 ${CX} ${CY - RY}`;
/** Puntos de la línea punteada: un número entero de periodos, para que el patrón cierre sin costura. */
const DASH = `2 ${(ELLIPSE.perimeter / Math.round(ELLIPSE.perimeter / 9) - 2).toFixed(3)}`;
/** Las 12 marcas de las horas, hacia adentro desde la órbita. */
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const p = ELLIPSE.at((i + 1) / 12);
  const l = Math.hypot(p.x, p.y);
  return { k: i + 1, x1: CX + p.x, y1: CY + p.y, x2: CX + p.x * (1 - 11 / l), y2: CY + p.y * (1 - 11 / l) };
});

/** Conector ortogonal (como en un plano): sale del centro y quiebra a 90°. */
function connector([x, y]: [number, number]): string {
  if (x === CX) return `M${CX} ${CY + (y < CY ? -32 : 32)}V${y + (y < CY ? BOX_H / 2 : -BOX_H / 2)}`;
  const sx = CX + (x > CX ? 80 : -80);
  return `M${sx} ${CY}H${x}V${y + (y < CY ? BOX_H / 2 : -BOX_H / 2)}`;
}

/** Aguja: sale del borde del recuadro central (no del centro, que queda tapado) hacia (x, y), relativo al centro. */
function setHand(line: SVGLineElement, x: number, y: number, reach: number) {
  const l = Math.hypot(x, y) || 1;
  const t = Math.min(CORE_HALF[0] / (Math.abs(x / l) || 1e-6), CORE_HALF[1] / (Math.abs(y / l) || 1e-6)) + 3;
  line.setAttribute('x1', (CX + (x / l) * t).toFixed(2));
  line.setAttribute('y1', (CY + (y / l) * t).toFixed(2));
  line.setAttribute('x2', (CX + x * reach).toFixed(2));
  line.setAttribute('y2', (CY + y * reach).toFixed(2));
}

export function HeroDiagram({ locale, selected, onPick }: { locale: Locale; selected: ServiceId[]; onPick: (id: ServiceId) => void }) {
  const d = DICTIONARIES[locale].concept;
  const maskId = `orbit-${useId().replace(/:/g, '')}`;
  const figRef = useRef<HTMLElement>(null);
  const revealRef = useRef<SVGPathElement>(null);
  const minuteRef = useRef<SVGLineElement>(null);
  const hourRef = useRef<SVGLineElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const [complete, setComplete] = useState(false);

  // El reloj sigue al scroll. Todo lo que cambia en cada cuadro se escribe directo en el DOM (sin re-renderizar).
  useEffect(() => {
    const fig = figRef.current, reveal = revealRef.current, minute = minuteRef.current, hour = hourRef.current, head = headRef.current;
    if (!fig || !reveal || !minute || !hour || !head) return;
    // Con "reducir movimiento" no hay barrido ni estallido: el diagrama aparece completo (el CSS fija los estados finales).
    if (prefersReducedMotion()) { setComplete(true); return; }

    const ticks = Array.from(fig.querySelectorAll<SVGLineElement>('.diagram__tick'));
    let target = 0;   // adónde apunta el scroll
    let shown = 0;    // lo que se ve: persigue a `target` con inercia y con un tope de velocidad
    let seen = 0;     // fracción de la figura que está en pantalla
    let lit = 0;
    let raf = 0;
    let last = 0;

    const paint = (p: number) => {
      reveal.style.strokeDashoffset = String(1 - p);
      const tip = ELLIPSE.at(p);
      setHand(minute, tip.x, tip.y, 1);
      const h = ELLIPSE.at(p / 12);
      setHand(hour, h.x, h.y, 0.5);
      head.setAttribute('cx', (CX + tip.x).toFixed(2));
      head.setAttribute('cy', (CY + tip.y).toFixed(2));
      if (p > 0.004) fig.dataset.sweep = ''; else delete fig.dataset.sweep;
      const n = Math.floor(p * 12 + 1e-6);
      if (n !== lit) {
        ticks.forEach((t, i) => t.classList.toggle('is-lit', i < n));
        lit = n;
      }
    };
    const finish = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      setComplete(true);
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      shown = chase(shown, target, dt, 0.85);
      paint(shown);
      if (shown >= 1) {
        // Cerrado: el estallido espera a que la figura se vea (si se pasó de largo, sale al volver a ella).
        if (seen >= 0.6) finish();
        return;
      }
      if (shown !== target) raf = requestAnimationFrame(frame);
    };
    function onScroll() {
      const r = fig!.getBoundingClientRect();
      target = scrollProgress(r.top, r.height, window.innerHeight);
      seen = visibleFraction(r.top, r.height, window.innerHeight);
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <figure ref={figRef} className={`diagram ${complete ? 'is-complete' : ''}`}>
      {/* El viewBox deja un margen alrededor del dibujo: el brillo de los trazos y la onda no se recortan en el borde. */}
      <svg viewBox="-12 -8 484 456" role="img" aria-label={d.diagram}>
        <defs>
          {/* La máscara deja ver la órbita solo hasta donde llega el barrido (trazo grueso con pathLength 1). */}
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-40" y="-40" width="540" height="520">
            <path ref={revealRef} className="diagram__reveal" d={ORBIT} pathLength={1} />
          </mask>
        </defs>

        <path className="diagram__orbit" d={ORBIT} strokeDasharray={DASH} mask={`url(#${maskId})`} />
        <g className="diagram__ticks" aria-hidden="true">
          {TICKS.map((t) => <line key={t.k} className="diagram__tick" x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />)}
        </g>
        <path className="diagram__dim" d="M30 220h20M410 220h20M230 16v14M230 410v14" />

        <g className="diagram__hands" aria-hidden="true">
          <line ref={hourRef} className="diagram__hand diagram__hand--hour" />
          <line ref={minuteRef} className="diagram__hand" />
          <circle ref={headRef} className="diagram__head" r="4.5" cx={CX} cy={CY - RY} />
        </g>

        <ellipse className="diagram__wave" cx={CX} cy={CY} rx={RX} ry={RY} aria-hidden="true" />
        <ellipse className="diagram__wave diagram__wave--b" cx={CX} cy={CY} rx={RX} ry={RY} aria-hidden="true" />

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
