'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Wand2, 
  Globe, 
  ThumbsUp, 
  Share2, 
  RefreshCw,
  Settings,
  Zap,
  Layers,
  Users,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: Sparkles,
    title: '多模型 AI 生成',
    description: '支持 Gemini 和 OpenAI 格式的 API，可自由选择不同模型进行创作，满足多样化需求。',
  },
  {
    icon: Wand2,
    title: '图生图创作',
    description: '上传参考图片，基于现有图片进行 AI 再创作，实现风格迁移和图片编辑。',
  },
  {
    icon: Zap,
    title: '异步生成处理',
    description: '提交任务后立即返回，后台自动处理，无需等待，提升创作效率。',
  },
  {
    icon: Layers,
    title: '多种尺寸选择',
    description: '支持 1:1、16:9、9:16 等多种宽高比，以及 1K、2K 等不同分辨率。',
  },
  {
    icon: Globe,
    title: '公开作品集',
    description: '一键将作品公开到社区，展示你的创意，发现更多精彩作品。',
  },
  {
    icon: RefreshCw,
    title: '随机发现',
    description: '随机排序功能，每次刷新都有新发现，探索意想不到的创意灵感。',
  },
  {
    icon: ThumbsUp,
    title: '互动反馈',
    description: '点赞、点踩功能，为喜欢的作品投票，优质内容更容易被发现。',
  },
  {
    icon: Share2,
    title: '分享传播',
    description: '一键分享作品链接，让更多人看到你的创作，传播创意与灵感。',
  },
  {
    icon: Settings,
    title: '灵活配置',
    description: '自定义 API Key 和 Base URL，支持多种 AI 服务提供商，灵活切换。',
  },
  {
    icon: Users,
    title: '身份同步',
    description: '通过用户 Token 导入导出，实现跨设备身份同步，作品永不丢失。',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold tracking-tight">
            功能介绍
          </h1>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回首页
            </Button>
          </Link>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        {/* 介绍卡片 */}
        <Card className="mb-8">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-4">
                <ImageIcon className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-serif">
              AI 创作室
            </CardTitle>
            <p className="text-muted-foreground mt-2 text-lg">
              多模型 AI 图片生成工具，让创意触手可及
            </p>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>
              AI 创作室是一个功能丰富的 AI 图片生成平台，支持多种 AI 模型，
              提供图生图、异步生成、作品分享等功能，帮助你轻松创作精彩作品。
            </p>
          </CardContent>
        </Card>

        {/* 功能列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="group hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-3 shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 开始使用 */}
        <Card className="mt-8">
          <CardContent className="py-8 text-center">
            <h2 className="text-xl font-semibold mb-2">开始创作</h2>
            <p className="text-muted-foreground mb-6">
              配置你的 API Key，输入创意提示词，即可开始 AI 图片创作之旅
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/">
                <Button size="lg">
                  <Sparkles className="h-5 w-5 mr-2" />
                  立即创作
                </Button>
              </Link>
              <Link href="/gallery">
                <Button variant="outline" size="lg">
                  <Globe className="h-5 w-5 mr-2" />
                  浏览作品集
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 使用说明 */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">快速开始</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
                <span>点击右上角「设置」按钮，配置你的 API Key 和 Base URL（支持 Gemini 和 OpenAI 格式）</span>
              </li>
              <li className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
                <span>选择想要使用的模型，不同模型有不同的特点和效果</span>
              </li>
              <li className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
                <span>输入创意提示词，描述你想要生成的图片内容</span>
              </li>
              <li className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">4</span>
                <span>（可选）上传参考图片，实现图生图创作</span>
              </li>
              <li className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">5</span>
                <span>点击「开始创作」，等待 AI 生成你的作品</span>
              </li>
              <li className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">6</span>
                <span>作品生成后可下载、分享或公开到作品集</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </main>

      {/* 底部 */}
      <footer className="border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>AI 创作室 · 让创意触手可及</p>
        </div>
      </footer>
    </div>
  );
}
