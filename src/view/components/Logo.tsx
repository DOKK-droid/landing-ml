'use client';
/* Monograma ML de la tarjeta ejecutiva, en SVG.
 * `variant="hero"` lo rodea de una escena 3D (globo, aros giratorios y arcos orbitales) dibujada en canvas por
 * view/logoScene.ts, sin WebGL. La marca va entre dos canvas —lo que está detrás de ella y lo que está delante—
 * para que los aros pasen por los dos lados. La escena se pausa fuera de pantalla y con
 * prefers-reduced-motion queda un solo cuadro en reposo. */
import { memo, useEffect, useId, useRef } from 'react';
import { startLogoScene } from '../logoScene';

export const Logo = memo(function Logo({ variant = 'mark', className }: { variant?: 'mark' | 'hero'; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${n}-${uid}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const markRef = useRef<SVGSVGElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current, back = backRef.current, mark = markRef.current, front = frontRef.current;
    if (!root || !back || !mark || !front) return;
    return startLogoScene(root, back, front, mark);
  }, []);

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
      <radialGradient id={id('halo')} gradientUnits="userSpaceOnUse" cx="62" cy="50" r="112">
        <stop offset="0" stopColor="#6a3cff" stopOpacity=".42" /><stop offset=".55" stopColor="#2b5cff" stopOpacity=".16" /><stop offset="1" stopColor="#2b5cff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id('shadow')} cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#000" stopOpacity=".55" /><stop offset="1" stopColor="#000" stopOpacity="0" />
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
    // El contenedor exterior lleva la entrada (opacity) para no afectar a la perspectiva de la marca.
    <div className={`logo3d-wrap ${className ?? ''}`} aria-hidden="true">
      <div ref={rootRef} className="logo3d">
        <svg className="logo3d__halo" viewBox="-52 -64 228 228">
          {defs}
          <circle cx="62" cy="50" r="112" fill={`url(#${id('halo')})`} />
          <ellipse cx="73" cy="122" rx="58" ry="8" fill={`url(#${id('shadow')})`} />
        </svg>
        <canvas ref={backRef} className="logo3d__cv" />
        <svg ref={markRef} className="logo3d__mark" viewBox="-52 -64 228 228">
          {monogram}
        </svg>
        <canvas ref={frontRef} className="logo3d__cv" />
      </div>
    </div>
  );
});
