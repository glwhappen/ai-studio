import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Docker 部署需要 standalone 输出
  output: 'standalone',
  // outputFileTracingRoot: path.resolve(__dirname, '../../'),
  /* config options here */
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

export default nextConfig;
