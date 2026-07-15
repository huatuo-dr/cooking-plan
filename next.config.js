/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生产构建输出 standalone 模式（减小镜像体积）
  output: 'standalone',
  // 允许上传图片的服务端处理
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
}

module.exports = nextConfig
