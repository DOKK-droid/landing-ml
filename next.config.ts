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
};

export default nextConfig;
