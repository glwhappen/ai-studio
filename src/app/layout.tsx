import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Gemini 创作室 | AI 图片生成工具',
    template: '%s | Gemini 创作室',
  },
  description:
    '使用 Google Gemini API 生成精美图片，管理你的创作项目，探索 AI 艺术的无限可能。',
  keywords: [
    'Gemini',
    'AI 图片生成',
    '人工智能绘画',
    '创意工具',
    'AI 创作',
  ],
  authors: [{ name: 'Gemini Studio' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
