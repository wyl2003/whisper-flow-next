/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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