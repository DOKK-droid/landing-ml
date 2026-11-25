import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // Las pruebas con jsdom tardan lo que tarde en arrancar el entorno, y eso varía mucho con la carga de la máquina
  // (el mismo test pasó de 4,5 s a 10 s sin tocar nada): con el límite por defecto de 5 s fallaban sin que hubiera un error.
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // `next/link` agrega o quita la barra final según esta variable, que el build define a partir de `trailingSlash: true` (next.config.ts).
    // Sin ella, en las pruebas un enlace a "/es/tarifas/" saldría como "/es/tarifas": se reproduce lo que hace el build.
    env: { __NEXT_TRAILING_SLASH: 'true' },
  },
});
