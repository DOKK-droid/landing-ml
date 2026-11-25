'use client';
/* Monograma ML de la tarjeta ejecutiva, en SVG.
 * `variant="hero"` lo rodea de una escena 3D (globo, aros giratorios y arcos orbitales) dibujada en canvas por
 * view/logoScene.ts, sin WebGL. La marca va entre dos canvas —lo que está detrás de ella y lo que está delante—
 * para que los aros pasen por los dos lados. La escena se pausa fuera de pantalla y con
 * prefers-reduced-motion queda un solo cuadro en reposo.
 *
 * La estela de la primera pata (geometría en view/logoTrail.ts) gira con un corte seco al final del pie y baja por una diagonal de
 * sombra, paralela a la segunda diagonal de la M, por debajo del renglón: el lienzo del SVG no se agranda, el desbordamiento se deja
 * visible (`.logo__svg` en globals.css). */
import { Fragment, memo, useEffect, useId, useRef, type ReactNode } from 'react';
import { startLogoScene } from '../logoScene';
import { GLOW_GROW, MASK_GROW, SEGMENTS, SHAPES, TONE_COLOR, stopCount, stopOffset, type Segment } from '../logoSweep';
import {
  BAND_T, GLOW_T, LEG_STOPS, LEG_TINT, TRAIL, VIOLET,
  bandGradient, diagGradient, f, footGradient, trailDashes, trailDiagPiece, trailFlowPath, trailFoot, trailFootPiece, trailGlow, trailMaskDiag, trailMaskFoot,
} from '../logoTrail';

/** Cromo de las diagonales de la M: claro arriba, un horizonte oscuro marcado y un reflejo más claro abajo (el de la pata está en LEG_STOPS). */
const LEFT_DIAG_STOPS: readonly (readonly [number, string])[] = [[0, '#ffffff'], [0.2, '#eef2f8'], [0.42, '#a9b5c7'], [0.52, '#3e495e'], [0.62, '#7d8aa2'], [0.82, '#d6dee9'], [1, '#b4bfd0']];
const RIGHT_DIAG_STOPS: readonly (readonly [number, string])[] = [[0, '#f1f4f9'], [0.2, '#c9d2de'], [0.42, '#7e8ba1'], [0.52, '#2b3446'], [0.62, '#5f6c84'], [0.84, '#a9b5c7'], [1, '#697590']];

/** Degradados compartidos de la estela (los mismos para todas las líneas): se calculan una sola vez, no por cuadro. */
const SHARED = {
  sd: diagGradient(),
  bn: bandGradient(0.16, BAND_T), gl: bandGradient(0.66, GLOW_T),
};

/**
 * `flow`: la estela lleva un destello por cada línea (solo se anima en el banner de carga: ver `.logo__flow` en globals.css).
 * `sweep`: el logo entero lleva una máscara hecha con copias de sus formas, cada una con un degradado a lo largo de su eje, y encima de cada
 * forma otra copia, clara, con la luz del frente del barrido (view/logoSweep.ts): así el logo aparece y se borra con un barrido.
 * Dónde nace: `'hidden'` con el logo oculto y lo muestra el script; `'visible'` con el logo entero a la vista, para que se vea desde el primer
 * pintado y, si el script no llega, se vea igual: el inicio (lo mueve la escena: `startLogoScene`) y el banner de carga (lo mueve `startSweep`,
 * que al arrancar empieza borrándolo, sin saltos). Sin ninguna de las dos opciones el dibujo no cambia.
 */
export const Logo = memo(function Logo({ variant = 'mark', className, flow = false, sweep }: { variant?: 'mark' | 'hero'; className?: string; flow?: boolean; sweep?: 'hidden' | 'visible' }) {
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

  const grad = (name: string, g: { x1: number; y1: number; x2: number; y2: number; stops: { offset: number; color: string; opacity: number }[] }) => (
    <linearGradient id={id(name)} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
      {g.stops.map((stop, k) => <stop key={k} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />)}
    </linearGradient>
  );

  /** Degradado de un tramo del barrido: a lo largo de su eje (`vis`: de la máscara, nace en 0 u 1 según `sweep`; `lit`: de la luz, nace en 0). */
  const sweepGradient = (seg: Segment, kind: 'vis' | 'lit', color: string) => (
    <linearGradient id={id(`${kind}-${seg.id}`)} data-sweep={`${kind}:${seg.id}`} gradientUnits="userSpaceOnUse" x1={f(seg.a[0])} y1={f(seg.a[1])} x2={f(seg.b[0])} y2={f(seg.b[1])}>
      {Array.from({ length: stopCount(seg) }, (_, k) => <stop key={k} offset={+stopOffset(seg, k).toFixed(4)} stopColor={color} stopOpacity={kind === 'vis' && sweep === 'visible' ? 1 : 0} />)}
    </linearGradient>
  );
  const maskShape = (key: string, points: string, seg: string, grow: number) => (
    <polygon key={key} className="logo__vis" points={points} fill={`url(#${id(`vis-${seg}`)})`} stroke={`url(#${id(`vis-${seg}`)})`} strokeWidth={grow * 2} strokeLinejoin="round" />
  );
  /** Con `sweep`, un trozo del dibujo va dentro de un grupo con su máscara; sin él, el marcado es el de siempre (sin grupo). */
  const masked = (key: string, mask: string, children: ReactNode) => (sweep ? <g key={key} mask={`url(#${id(mask)})`}>{children}</g> : <Fragment key={key}>{children}</Fragment>);

  const defs = (
    <defs>
      <linearGradient id={id('g1')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
        {LEG_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
      </linearGradient>
      <linearGradient id={id('g2')} gradientUnits="userSpaceOnUse" x1="6" y1="0" x2="50" y2="82">
        {LEFT_DIAG_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
      </linearGradient>
      <linearGradient id={id('g3')} gradientUnits="userSpaceOnUse" x1="94" y1="0" x2="50" y2="82">
        {RIGHT_DIAG_STOPS.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
      </linearGradient>
      {/* El lila entra en la pata: un velo violeta, centrado donde sale el pie, que se mezcla con ella (ver LEG_TINT). */}
      <radialGradient id={id('lt')} gradientUnits="userSpaceOnUse" cx={LEG_TINT.cx} cy={LEG_TINT.cy} r={LEG_TINT.r}>
        {LEG_TINT.stops.map((stop, k) => <stop key={k} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />)}
      </radialGradient>
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
      {/* UN solo degradado por línea, partido en dos vectores (un degradado no dobla): `st` sobre la base, desde el gris de la pata, y `sd`
          (compartido) a lo largo de la diagonal. En el corte las dos piezas valen lo mismo (la meseta de violeta): no hay unión visible. */}
      {TRAIL.map((line, i) => <Fragment key={i}>{grad(`st${i}`, footGradient(line))}</Fragment>)}
      {Object.entries(SHARED).map(([name, g]) => <Fragment key={name}>{grad(name, g)}</Fragment>)}
      {/* Resplandor violeta de la estela: un solo desenfoque compartido (uno por línea serían 9 filtros). */}
      <filter id={id('tglow')} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="3" /></filter>
      {/* Los degradados del barrido: dos por tramo, a lo largo de su eje: `vis` es la máscara (lo que se ve del logo) y `lit` la luz del frente
          (apagada). El script les escribe la opacidad de las paradas. */}
      {sweep && SEGMENTS.map((seg) => (
        <Fragment key={seg.id}>
          {sweepGradient(seg, 'vis', '#fff')}
          {sweepGradient(seg, 'lit', TONE_COLOR[seg.tone])}
        </Fragment>
      ))}
      {/* Las máscaras (lo que se ve del logo): copias de sus formas rellenas con el degradado de su tramo. Hay una para la M y la L (sus cinco
          formas, casi pegadas a ellas: MASK_GROW; si se agrandaran, la visibilidad de un tramo se filtraría al vecino y aparecerían o quedarían
          trozos fuera de su turno) y otra para la estela (una banda sobre el pie y otra sobre la diagonal, que llega hasta el polvo). Van aparte
          porque la estela pasa por detrás de la punta de la M: en los mismos píxeles hay dos capas con turnos distintos. Los resplandores, que sí
          se salen de sus formas, llevan cada uno la suya, agrandada (GLOW_GROW), la de la L y la de la estela, y solo los gobiernan a ellos. */}
      {sweep && (
        <>
          <mask id={id('vmshape')} maskUnits="userSpaceOnUse" x="-10" y="-10" width="170" height="130">
            {(Object.keys(SHAPES) as (keyof typeof SHAPES)[]).map((shape) => maskShape(shape, SHAPES[shape], shape, MASK_GROW))}
          </mask>
          <mask id={id('vmtrail')} maskUnits="userSpaceOnUse" x="-10" y="60" width="130" height="120">
            {maskShape('tf', trailMaskFoot(), 'trail-foot', 0)}
            {maskShape('td', trailMaskDiag(), 'trail-diag', 0)}
          </mask>
          <mask id={id('vmglow')} maskUnits="userSpaceOnUse" x="40" y="-30" width="140" height="170">
            {maskShape('gs', SHAPES.stem, 'stem', GLOW_GROW)}
            {maskShape('gf', SHAPES.foot, 'foot', GLOW_GROW)}
          </mask>
          <mask id={id('vmglowt')} maskUnits="userSpaceOnUse" x="0" y="50" width="110" height="130">
            {maskShape('gtf', trailMaskFoot(), 'trail-foot', GLOW_GROW)}
            {maskShape('gtd', trailMaskDiag(), 'trail-diag', GLOW_GROW)}
          </mask>
        </>
      )}
    </defs>
  );

  const monogram = (
    <g className="logo__ml">
      {masked('lglow', 'vmglow', <polygon points="83,42 100,12.1 100,83 146,83 146,100 83,100" fill="#00c8ff" opacity=".6" filter={`url(#${id('glow')})`} />)}
      {masked('leg', 'vmshape', <>
      <polygon points="0,0 17,29.9 17,100 0,100" fill={`url(#${id('g1')})`} />
      <polygon className="logo__leg-tint" points="0,0 17,29.9 17,100 0,100" fill={`url(#${id('lt')})`} />
      </>)}
      {/* La estela va detrás de la M y de la L. Sale del pie de la pata, gira con un corte seco y baja por la diagonal de sombra, paralela a la
          segunda diagonal de la M pero hacia abajo: cruza el renglón de la base y sobresale del lienzo, hacia el vacío, apagándose. */}
      {masked('tfoot', 'vmtrail', <polygon className="logo__trail-foot" points={trailFoot()} fill={`url(#${id('bn')})`} />)}
      {masked('tglow', 'vmglowt', <polygon className="logo__trail-glow" points={trailGlow()} fill={`url(#${id('gl')})`} filter={`url(#${id('tglow')})`} />)}
      {/* Cada línea es una capa con su profundidad (data-z): la escena la desplaza al inclinarse la marca (paralaje). Dentro, las dos piezas
          del cuerpo (base y diagonal) y los trazos que la disuelven. Es una sombra: sin brillos blancos. */}
      {masked('layers', 'vmtrail', <>{TRAIL.map((line, i) => (
        <g key={i} className="logo__trail-layer" data-z={line.z}>
          <polygon className="logo__trail" points={trailFootPiece(line)} fill={`url(#${id(`st${i}`)})`} />
          <polygon className="logo__trail-diag" points={trailDiagPiece(line)} fill={`url(#${id('sd')})`} />
          {trailDashes(line).map((d, k) => (
            <line key={k} className="logo__trail-spark" x1={f(d.x1)} y1={f(d.y1)} x2={f(d.x2)} y2={f(d.y2)} stroke={VIOLET} strokeOpacity={d.o} strokeWidth={f(d.w)} strokeLinecap="round" />
          ))}
          {/* La luz del frente del barrido sobre las dos piezas de la línea (la misma forma, apagada), con el degradado compartido de su tramo. */}
          {sweep && (
            <>
              <polygon className="logo__lit" points={trailFootPiece(line)} fill={`url(#${id('lit-trail-foot')})`} />
              <polygon className="logo__lit" points={trailDiagPiece(line)} fill={`url(#${id('lit-trail-diag')})`} />
            </>
          )}
          {/* El destello: un trazo corto que corre por el eje de la línea (de la pata a su polvo), con un halo más ancho y tenue; lo mueve CSS. */}
          {flow && (
            <>
              <path className="logo__flow-glow" d={trailFlowPath(line)} pathLength={1} strokeWidth={f(line.h * 2)} />
              <path className="logo__flow" d={trailFlowPath(line)} pathLength={1} strokeWidth={f(Math.max(0.7, line.h * 0.9))} />
            </>
          )}
        </g>
      ))}</>)}
      {masked('ml', 'vmshape', <>
      <polygon points="50,58 83,0 100,0 50,87.9" fill={`url(#${id('g3')})`} />
      <polygon points="0,0 17,0 50,58 50,87.9" fill={`url(#${id('g2')})`} />
      <polygon points="83,42 100,12.1 100,83 83,100" fill={`url(#${id('gc')})`} />
      <polygon points="83,100 100,83 146,83 146,100" fill={`url(#${id('gf')})`} />
      {/* La luz del frente del barrido sobre la pata, las dos diagonales, el palo y el pie: la misma forma de cada una, apagada. */}
      {sweep && (Object.keys(SHAPES) as (keyof typeof SHAPES)[]).map((shape) => (
        <polygon key={shape} className="logo__lit" data-shape={shape} points={SHAPES[shape]} fill={`url(#${id(`lit-${shape}`)})`} />
      ))}
      <path d="M17 0L50 58L83 0" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth=".8" />
      <path className="logo__chrome-edge" d="M.6 2V98" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth=".7" />
      <path d="M83 100V42M100 83H146" fill="none" stroke="#d6fcff" strokeOpacity=".7" strokeWidth=".7" />
      </>)}
    </g>
  );

  if (variant === 'mark') {
    return (
      <svg className={['logo__svg', className].filter(Boolean).join(' ')} viewBox="-2 -2 150 104" role="img" aria-label="ML">
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
