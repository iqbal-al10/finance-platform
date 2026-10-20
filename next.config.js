/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      // Hanya untuk development: izinkan localhost jika perlu
      ...(process.env.NODE_ENV === 'development'
        ? [
            {
              protocol: 'http',
              hostname: 'localhost',
              pathname: '/**',
            },
          ]
        : []),
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    rules: {},
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },
}

module.exports = nextConfig
