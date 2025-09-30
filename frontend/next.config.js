/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better error detection
  reactStrictMode: true,

  // Fix the API rewrite to use correct port
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3007/api/:path*', // Fixed port from 3005 to 3007
      },
    ];
  },

  // Enable SWC minification
  swcMinify: true,

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