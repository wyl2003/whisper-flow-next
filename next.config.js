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
    return config
  },
}

module.exports = nextConfig 