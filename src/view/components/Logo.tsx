/* Monograma ML plano: "M" en el color del texto, "L" en el acento. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-2 -2 150 104" role="img" aria-label="ML">
      <g fill="currentColor">
        <polygon points="0,0 17,29.9 17,100 0,100" opacity=".9" />
        <polygon points="0,0 17,0 50,58 50,87.9" />
        <polygon points="50,58 83,0 100,0 50,87.9" opacity=".75" />
      </g>
      <g fill="var(--accent)">
        <polygon points="83,42 100,12.1 100,83 83,100" />
        <polygon points="83,100 100,83 146,83 146,100" />
      </g>
    </svg>
  );
}
