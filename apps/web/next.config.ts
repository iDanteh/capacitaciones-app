import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Permite hot-reload y requests desde otras IPs de la red local en dev
  // (VirtualBox host-only adapter, WSL2, etc.)
  allowedDevOrigins: ['192.168.56.1'],
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
