/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["mammoth", "unpdf"],
    // Never reuse a cached copy of a dynamic page (the ranking must reflect the latest upload).
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
