import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'base.tachyonfuture.com',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  output: 'standalone',
};

export default nextConfig;
