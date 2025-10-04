/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better error detection
  reactStrictMode: true,

  // Skip TypeScript type checking during build (for faster deployment)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://195.201.6.244',
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://195.201.6.244/api',
  },

  // API rewrites disabled for Railway deployment (backend on separate Hetzner server)
  // Frontend will call API directly using NEXT_PUBLIC_API_URL
  async rewrites() {
    return [];
  },

  // Optimize images
  images: {
    domains: ['images.chesscomfiles.com', 'lichess1.org'],
    formats: ['image/avif', 'image/webp'],
  },

  // Optimize bundle size
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@tanstack/react-query',
      'date-fns'
    ],
  },

  // Webpack configuration for bundle optimization
  webpack: (config, { isServer }) => {
    // Code splitting optimization
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared components
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
            // Chess-specific libraries in separate chunk
            chess: {
              name: 'chess',
              test: /[\\/]node_modules[\\/](chess\.js|react-chessboard)[\\/]/,
              priority: 30,
              chunks: 'all',
            },
            // Charts library in separate chunk
            charts: {
              name: 'charts',
              test: /[\\/]node_modules[\\/](recharts)[\\/]/,
              priority: 25,
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },

  // Enable compression
  compress: true,

  // Production source maps (disable for smaller builds)
  productionBrowserSourceMaps: false,

  // Headers for security and caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;