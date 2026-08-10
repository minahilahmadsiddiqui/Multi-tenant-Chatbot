/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "firebase-admin",
      "pdf-parse",
      "mammoth",
      "@qdrant/js-client-rest",
    ],
  },
};

export default nextConfig;
