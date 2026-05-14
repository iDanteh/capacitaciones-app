import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Cloudflare R2 public bucket
        protocol: 'https',
        hostname: '**.r2.dev',
      },
      {
        // Cloudflare custom domain para assets
        protocol: 'https',
        hostname: '**.cloudflare.com',
      },
      {
        // Mux thumbnails de video
        protocol: 'https',
        hostname: 'image.mux.com',
      },
    ],
  },
  // Habilitar output standalone para Docker (cuando sea necesario)
  // output: 'standalone',
};

export default nextConfig;
