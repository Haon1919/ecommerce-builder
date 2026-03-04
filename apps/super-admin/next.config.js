/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.STATIC_EXPORT === 'true' ? 'export' : 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  experimental: { serverComponentsExternalPackages: ['socket.io-client'] },
  images: { unoptimized: true, remotePatterns: [{ protocol: 'https', hostname: 'storage.googleapis.com' }] },
};

module.exports = nextConfig;
