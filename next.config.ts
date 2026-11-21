import type { NextConfig } from 'next';

/**
 * Sitio 100 % estático: no hay servidor, base de datos ni API.
 * Vercel lo publica como CDN; también puede servirse desde cualquier hosting.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Identificador de build estable (el commit, o "local"): sin esto Next genera uno al azar en cada build y
  // el manifiesto de integridad cambiaría aunque el código sea el mismo. Ver docs/SEGURIDAD.md.
  generateBuildId: async () => process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
};

export default nextConfig;
