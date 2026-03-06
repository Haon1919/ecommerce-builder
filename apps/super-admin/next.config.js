/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['socket.io-client'],
  images: { unoptimized: true, remotePatterns: [{ protocol: 'https', hostname: 'storage.googleapis.com' }] },
};

module.exports = nextConfig;
