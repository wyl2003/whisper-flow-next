/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/_next/static/media/:path*\\.worker\\.ts',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/javascript; charset=utf-8',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node': false,
    }

    config.module.rules.push({
      test: /\.mjs$/,
      type: 'javascript/auto',
    })

    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    }

    return config
  },
}

module.exports = nextConfig 