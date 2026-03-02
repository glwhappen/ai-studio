/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 部署需要 standalone 输出
  output: 'standalone',
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
