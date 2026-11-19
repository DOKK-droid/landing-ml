/* Monograma ML de la tarjeta ejecutiva, en SVG.
 * `variant="hero"` agrega anillo y arcos con rotación 3D por CSS (sin WebGL),
 * que se desactiva con prefers-reduced-motion. */
import { useId } from 'react';

export function Logo({ variant = 'mark', className }: { variant?: 'mark' | 'hero'; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;

  const defs = (
    <defs>
      <linearGradient id={id('g1')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
        <stop offset="0" stopColor="#d9dfe8" /><stop offset=".55" stopColor="#a3adbc" /><stop offset="1" stopColor="#697485" />
      </linearGradient>
      <linearGradient id={id('g2')} gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="50" y2="82">
        <stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#e3e8ef" /><stop offset="1" stopColor="#a9b3c2" />
      </linearGradient>
      <linearGradient id={id('g3')} gradientUnits="userSpaceOnUse" x1="94" y1="0" x2="50" y2="82">
        <stop offset="0" stopColor="#c3cbd7" /><stop offset=".6" stopColor="#8490a1" /><stop offset="1" stopColor="#525d6d" />
      </linearGradient>
      <linearGradient id={id('gc')} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="100">
        <stop offset="0" stopColor="#a6f9ff" /><stop offset=".4" stopColor="#19e0fb" /><stop offset="1" stopColor="#009fe0" />
      </linearGradient>
      <linearGradient id={id('gf')} gradientUnits="userSpaceOnUse" x1="83" y1="0" x2="146" y2="0">
        <stop offset="0" stopColor="#0086cf" /><stop offset=".35" stopColor="#00c2f2" /><stop offset="1" stopColor="#7df3ff" />
      </linearGradient>
      <linearGradient id={id('ring')} gradientUnits="userSpaceOnUse" x1="-34" y1="-46" x2="158" y2="146">
        <stop offset="0" stopColor="#f4f7fb" /><stop offset=".45" stopColor="#8e99aa" /><stop offset=".7" stopColor="#dfe5ee" /><stop offset="1" stopColor="#6b7687" />
      </linearGradient>
      <linearGradient id={id('arc')} gradientUnits="userSpaceOnUse" x1="-30" y1="-40" x2="150" y2="150">
        <stop offset="0" stopColor="#ff3ea5" /><stop offset=".45" stopColor="#8a3cff" /><stop offset="1" stopColor="#00e0ff" />
      </linearGradient>
      <radialGradient id={id('halo')} gradientUnits="userSpaceOnUse" cx="62" cy="50" r="112">
        <stop offset="0" stopColor="#6a3cff" stopOpacity=".42" /><stop offset=".55" stopColor="#2b5cff" stopOpacity=".16" /><stop offset="1" stopColor="#2b5cff" stopOpacity="0" />
      </radialGradient>
      <filter id={id('glow')} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="4.2" /></filter>
    </defs>
  );

  const monogram = (
    <g className="logo__ml">
      <polygon points="83,42 100,12.1 100,83 146,83 146,100 83,100" fill="#00c8ff" opacity=".6" filter={`url(#${id('glow')})`} />
      <polygon points="0,0 17,29.9 17,100 0,100" fill={`url(#${id('g1')})`} />
      <polygon points="50,58 83,0 100,0 50,87.9" fill={`url(#${id('g3')})`} />
      <polygon points="0,0 17,0 50,58 50,87.9" fill={`url(#${id('g2')})`} />
      <polygon points="83,42 100,12.1 100,83 83,100" fill={`url(#${id('gc')})`} />
      <polygon points="83,100 100,83 146,83 146,100" fill={`url(#${id('gf')})`} />
      <path d="M17 0L50 58L83 0" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth=".7" />
      <path d="M83 100V42M100 83H146" fill="none" stroke="#d6fcff" strokeOpacity=".7" strokeWidth=".7" />
    </g>
  );

  if (variant === 'mark') {
    return (
      <svg className={className} viewBox="-2 -2 150 104" role="img" aria-label="ML">
        {defs}
        {monogram}
      </svg>
    );
  }

  return (
    <div className={`logo3d ${className ?? ''}`} aria-hidden="true">
      <svg className="logo3d__halo" viewBox="-52 -64 228 228">
        {defs}
        <circle cx="62" cy="50" r="112" fill={`url(#${id('halo')})`} />
        <g fill="none" stroke="#8f9dff" strokeWidth=".6" opacity=".35">
          <circle cx="62" cy="50" r="84" />
          <ellipse cx="62" cy="50" rx="28" ry="84" />
          <ellipse cx="62" cy="50" rx="56" ry="84" />
        </g>
      </svg>
      <svg className="logo3d__ring" viewBox="-52 -64 228 228">
        <path d="M135.54 111.71A96 96 0 1 1 155.54 71.60" fill="none" stroke={`url(#${id('ring')})`} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="62" cy="50" r="88.5" fill="none" stroke="#9fb4cc" strokeWidth=".5" strokeDasharray="1.2 3.6" opacity=".55" />
      </svg>
      <svg className="logo3d__arcs" viewBox="-52 -64 228 228">
        <g fill="none" stroke={`url(#${id('arc')})`} strokeLinecap="round" strokeWidth="1.6">
          <path d="M-27.63 101.75A103.5 103.5 0 0 1 47.60 -52.49" />
          <path d="M133.90 124.45A103.5 103.5 0 0 1 83.52 151.24" />
        </g>
        <circle cx="-27.63" cy="101.75" r="2.4" fill="#b99cff" />
        <circle cx="47.60" cy="-52.49" r="2.4" fill="#ff8fcb" />
        <circle cx="133.90" cy="124.45" r="2.4" fill="#7ff2ff" />
      </svg>
      <svg className="logo3d__mark" viewBox="-52 -64 228 228">
        {monogram}
      </svg>
    </div>
  );
}
