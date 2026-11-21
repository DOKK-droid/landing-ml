/* Ilustraciones técnicas propias de cada servicio (estilo plano de arquitectura).
 * Clases: .a-l línea base · .a-a acento del servicio · .a-f relleno tenue · .a-d cota punteada */
import { memo } from 'react';
import type { ServiceId } from '@/model/types';

const ART: Record<ServiceId, React.ReactNode> = {
  consultoria: (
    <>
      <path className="a-d" d="M28 160V58M24 160h8M24 58h8" />
      <path className="a-l" d="M44 164H286M44 164V36" />
      <g className="a-f">
        <rect x="62" y="124" width="24" height="40" />
        <rect x="98" y="104" width="24" height="60" />
        <rect x="134" y="114" width="24" height="50" />
        <rect x="170" y="84" width="24" height="80" />
        <rect x="206" y="96" width="24" height="68" />
      </g>
      <g className="a-l">
        <rect x="62" y="124" width="24" height="40" />
        <rect x="98" y="104" width="24" height="60" />
        <rect x="134" y="114" width="24" height="50" />
        <rect x="170" y="84" width="24" height="80" />
        <rect x="206" y="96" width="24" height="68" />
      </g>
      <polyline className="a-a" points="74,116 110,96 146,104 182,72 218,84 252,50" />
      <g className="a-dot">
        <circle cx="74" cy="116" r="3.5" /><circle cx="110" cy="96" r="3.5" /><circle cx="146" cy="104" r="3.5" />
        <circle cx="182" cy="72" r="3.5" /><circle cx="218" cy="84" r="3.5" /><circle cx="252" cy="50" r="3.5" />
      </g>
      <circle className="a-l a-glass" cx="236" cy="66" r="34" />
      <path className="a-l a-thick" d="M261 91l26 26" />
    </>
  ),
  desarrollo: (
    <>
      <rect className="a-l a-glass" x="34" y="30" width="192" height="134" rx="7" />
      <path className="a-l" d="M34 50h192" />
      <g className="a-dot"><circle cx="46" cy="40" r="3" /><circle cx="57" cy="40" r="3" /><circle cx="68" cy="40" r="3" /></g>
      <rect className="a-f" x="44" y="60" width="44" height="94" rx="3" />
      <path className="a-l" d="M52 72h28M52 84h22M52 96h26M52 108h18" />
      <rect className="a-l" x="98" y="60" width="118" height="44" rx="3" />
      <path className="a-a" d="M132 72l-10 10 10 10M182 72l10 10-10 10M162 68l-10 28" />
      <path className="a-l" d="M98 116h118M98 128h90M98 140h104" />
      <path className="a-d" d="M226 75h22M248 75v-16h12M226 135h22M248 135v16h12" />
      <rect className="a-l a-glass" x="260" y="44" width="40" height="30" rx="3" />
      <rect className="a-l a-glass" x="260" y="136" width="40" height="30" rx="3" />
      <path className="a-l" d="M260 54h40M260 146h40" />
    </>
  ),
  gestion: (
    <>
      <path className="a-d" d="M160 100L72 52M160 100L248 52M160 100L72 150M160 100L248 150" />
      <circle className="a-f" cx="160" cy="100" r="30" />
      <circle className="a-a" cx="160" cy="100" r="30" />
      <path className="a-a" d="M146 100h28M160 86v28" />
      <g className="a-l a-glass">
        <rect x="48" y="28" width="48" height="48" rx="8" />
        <rect x="224" y="28" width="48" height="48" rx="8" />
        <rect x="48" y="126" width="48" height="48" rx="8" />
        <rect x="224" y="126" width="48" height="48" rx="8" />
      </g>
      {/* carrito */}
      <path className="a-l" d="M58 42h6l5 20h18l4-14H67" /><circle className="a-dot" cx="72" cy="67" r="2.5" /><circle className="a-dot" cx="84" cy="67" r="2.5" />
      {/* personas */}
      <circle className="a-l" cx="243" cy="45" r="6" /><circle className="a-l" cx="256" cy="47" r="5" /><path className="a-l" d="M232 66c1-9 6-12 11-12s10 3 11 12M252 66c0-6 3-9 6-9s6 3 7 9" />
      {/* caja */}
      <path className="a-l" d="M58 144l14-7 14 7v18l-14 7-14-7zM58 144l14 7 14-7M72 151v18" />
      {/* factura */}
      <path className="a-l" d="M236 136h24v30l-4-3-4 3-4-3-4 3-4-3-4 3zM241 145h14M241 152h14M241 159h8" />
    </>
  ),
  infraestructura: (
    <>
      <rect className="a-l a-glass" x="44" y="30" width="84" height="140" rx="5" />
      <g className="a-l"><path d="M44 62h84M44 94h84M44 126h84M44 158h84" /></g>
      <g className="a-f"><rect x="54" y="40" width="44" height="12" rx="2" /><rect x="54" y="72" width="44" height="12" rx="2" /><rect x="54" y="104" width="44" height="12" rx="2" /><rect x="54" y="136" width="44" height="12" rx="2" /></g>
      <g className="a-acc-dot"><circle cx="112" cy="46" r="3" /><circle cx="112" cy="78" r="3" /><circle cx="112" cy="110" r="3" /><circle cx="112" cy="142" r="3" /></g>
      <path className="a-l a-glass" d="M210 78a22 22 0 0 1 42-8 18 18 0 0 1 22 18 16 16 0 0 1-14 16h-58a18 18 0 0 1 8-34z" />
      <path className="a-a" d="M128 62h40v-4h34M128 126h48v28h52" />
      <rect className="a-l a-glass" x="228" y="140" width="64" height="26" rx="4" />
      <g className="a-dot"><circle cx="240" cy="153" r="2.5" /><circle cx="250" cy="153" r="2.5" /><circle cx="260" cy="153" r="2.5" /><circle cx="270" cy="153" r="2.5" /></g>
      <path className="a-d" d="M260 104v36" />
      <rect className="a-l" x="174" y="104" width="22" height="18" rx="3" /><path className="a-l" d="M179 104v-6a6 6 0 0 1 12 0v6" />
    </>
  ),
  ia: (
    <>
      <path className="a-l a-glass" d="M54 32h66l20 20v116H54z" />
      <path className="a-l" d="M120 32v20h20" />
      <path className="a-l" d="M68 70h56M68 84h48M68 98h56M68 112h40M68 126h52M68 140h30" />
      <path className="a-a" d="M42 44V26h18M152 44V26h-18M42 156v18h18M152 156v18h-18" />
      <path className="a-a a-scan" d="M46 100h102" />
      <path className="a-d" d="M164 100h22" />
      <g className="a-l">
        <path d="M196 64l46 -14M196 64l46 36M196 64l46 86M196 136l46 -86M196 136l46 -36M196 136l46 14M242 50l40 50M242 100l40 0M242 150l40 -50" />
      </g>
      <g className="a-node"><circle cx="196" cy="64" r="8" /><circle cx="196" cy="136" r="8" /><circle cx="242" cy="50" r="8" /><circle cx="242" cy="100" r="8" /><circle cx="242" cy="150" r="8" /></g>
      <circle className="a-f" cx="282" cy="100" r="13" /><circle className="a-a" cx="282" cy="100" r="13" />
    </>
  ),
  soporte: (
    <>
      <path className="a-l a-glass" d="M60 40h150v100H60z" />
      <path className="a-l" d="M40 150h190l-10 14H50z" />
      <path className="a-a" d="M72 96h28l8-22 12 44 10-30 6 8h56" />
      <path className="a-l a-thick" d="M196 122l46-46" />
      <path className="a-l a-glass" d="M246 52a18 18 0 0 0-22 22l6 6 16-16-6-6z" />
      <circle className="a-l a-glass" cx="262" cy="140" r="28" />
      <path className="a-a" d="M262 124v16l11 7" />
      <path className="a-d" d="M262 106v-6M262 180v-6M228 140h-6M302 140h-6" />
    </>
  ),
};

/** Memoizado: las seis láminas no cambian al marcar o desmarcar servicios. */
export const ServiceArt = memo(function ServiceArt({ id }: { id: ServiceId }) {
  return (
    <svg className="art" viewBox="0 0 320 200" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {ART[id]}
    </svg>
  );
});
