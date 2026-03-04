/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: { serverComponentsExternalPackages: ['socket.io-client'] },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'storage.googleapis.com' }] },
};

module.exports = nextConfig;
