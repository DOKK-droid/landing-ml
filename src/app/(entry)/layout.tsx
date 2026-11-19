/* Layout raíz mínimo de la entrada "/": sólo redirige al idioma del navegador. */
export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ background: '#0b2140', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
