import type { Metadata, Viewport } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'AI 创作室 | 多模型图片生成工具',
    template: '%s | AI 创作室',
  },
  description:
    '支持 Gemini、GPT Image 等多种 AI 绘图模型，一键生成精美图片，管理你的创作项目，探索 AI 艺术的无限可能。',
  keywords: [
    'Gemini',
    'GPT Image',
    'DALL-E',
    'AI 图片生成',
    '人工智能绘画',
    '创意工具',
    'AI 创作',
    '图生图',
  ],
  authors: [{ name: 'AI Studio' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN" translate="no">
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
