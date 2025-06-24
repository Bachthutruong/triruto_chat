import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // TypeScript and ESLint configuration
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Images configuration for external sources
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Disable error overlay and console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Production optimizations
  swcMinify: true,
  
  // Disable strict mode in production to avoid development warnings
  reactStrictMode: process.env.NODE_ENV !== 'production',
  
  // Webpack configuration to disable error overlay
  webpack: (config: any, { dev, isServer }: { dev: boolean; isServer: boolean }) => {
    if (dev && !isServer) {
      // Disable error overlay in development
      config.devtool = false;
      
      // Disable the error overlay plugin
      const plugins = config.plugins || [];
      config.plugins = plugins.filter((plugin: any) => {
        return plugin.constructor.name !== 'ReactDevOverlayPlugin';
      });
    }
    return config;
  },
  
  // Custom server configuration
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  
  // Environment variables to disable error reporting
  env: {
    DISABLE_ERROR_OVERLAY: 'true',
  },
};

export default nextConfig;
