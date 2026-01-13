import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb', // Allow large ZIP uploads
    },
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppress source map upload logs in CI
  silent: true,

  // Organization and project from Sentry dashboard
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps only in production builds
  disableServerWebpackPlugin: process.env.NODE_ENV !== 'production',
  disableClientWebpackPlugin: process.env.NODE_ENV !== 'production',

  // Hide source maps from browser devtools
  hideSourceMaps: true,

  // Automatically instrument API routes
  autoInstrumentServerFunctions: true,

  // Tree shake Sentry debug code in production
  disableLogger: true,
};

// Only wrap with Sentry if DSN is configured
const config = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;

export default config;
