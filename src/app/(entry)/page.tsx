import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Mariano Lemos Barbaro', robots: { index: false } };

/** Detecta el idioma del navegador (pt / en / es por defecto) y redirige. */
const script = `(function(){var l=(navigator.languages||[navigator.language||'es']).map(function(x){return String(x).slice(0,2).toLowerCase()});var t='es';for(var i=0;i<l.length;i++){if(l[i]==='es'||l[i]==='pt'||l[i]==='en'){t=l[i];break}}location.replace('/'+t+'/'+location.hash)})();`;

export default function Entry() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <noscript>
        <meta httpEquiv="refresh" content="0; url=/es/" />
      </noscript>
      <p style={{ padding: 24 }}>
        <a href="/es/" style={{ color: '#7ff2ff' }}>Español</a> · <a href="/pt/" style={{ color: '#7ff2ff' }}>Português</a> · <a href="/en/" style={{ color: '#7ff2ff' }}>English</a>
      </p>
    </>
  );
}
