'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ImageGallery } from '@/components/ImageGallery';
import { ProviderSelector } from '@/components/ProviderSelector';
import { ModelSelector } from '@/components/ModelSelector';
import { SizeSelector } from '@/components/SizeSelector';
import { ReferenceImageUploader } from '@/components/ReferenceImageUploader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Image as ImageIcon, Loader2, ExternalLink, Clock } from 'lucide-react';
import Link from 'next/link';

function HomeContent() {
  const searchParams = useSearchParams();
  const {
    apiConfig,
    autoPublic,
    userId,
    images,
    isLoading,
    isLoaded,
    updateApiConfig,
    updateAutoPublic,
    updateProviderConfig,
    switchProvider,
    getCurrentProviderConfig,
    submitGeneration,
    toggleImagePublic,
    deleteImage,
  } = useAppState();

  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useReferenceImage, setUseReferenceImage] = useState(false);
  const [referenceImage, setReferenceImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [activeTab, setActiveTab] = useState('create');

  // 从 URL 参数读取提示词和配置（需要等待 localStorage 状态恢复）
  useEffect(() => {
    // 必须等待状态加载完成后再处理 URL 参数
    if (!isLoaded) return;
    
    const promptParam = searchParams.get('prompt');
    const modelParam = searchParams.get('model');
    const providerParam = searchParams.get('provider');
    const aspectRatioParam = searchParams.get('aspectRatio');
    const imageSizeParam = searchParams.get('imageSize');
    const sizeParam = searchParams.get('size');
    
    // 只有有参数时才处理
    if (!promptParam && !modelParam && !providerParam) return;
    
    if (promptParam) {
      setPrompt(promptParam);
      setActiveTab('create');
    }
    
    // 自动选择供应商
    if (providerParam && (providerParam === 'gemini' || providerParam === 'openai')) {
      switchProvider(providerParam);
    }
    
    // 自动选择模型
    if (modelParam) {
      updateApiConfig({ selectedModel: modelParam });
    }
    
    // 自动选择尺寸参数
    if (aspectRatioParam || imageSizeParam || sizeParam) {
      updateApiConfig({
        useCustomSize: true,
        ...(aspectRatioParam && { aspectRatio: aspectRatioParam }),
        ...(imageSizeParam && { imageSize: imageSizeParam }),
        ...(sizeParam && { openaiSize: sizeParam }),
      });
    }
  }, [searchParams, isLoaded, switchProvider, updateApiConfig]);

  const currentProvider = apiConfig.currentProvider;
  const currentProviderConfig = getCurrentProviderConfig();

  const handleModelChange = (model: string) => {
    updateApiConfig({ selectedModel: model });
  };

  const handleSizeChange = (params: {
    aspectRatio?: string;
    imageSize?: string;
    openaiSize?: string;
    useCustomSize?: boolean;
  }) => {
    updateApiConfig(params);
  };

  const handleReferenceImageChange = (base64: string | null, mimeType: string | null) => {
    if (base64 && mimeType) {
      setReferenceImage({ base64, mimeType });
    } else {
      setReferenceImage(null);
    }
  };

  const handleUseReferenceImageChange = (checked: boolean) => {
    setUseReferenceImage(checked);
    if (!checked) {
      setReferenceImage(null);
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词');
      return;
    }

    if (!apiConfig.selectedModel) {
      setError('请选择模型');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await submitGeneration(prompt.trim(), useReferenceImage ? referenceImage : null);
      setPrompt('');
      setReferenceImage(null);
      setUseReferenceImage(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 统计各状态的图片数量
  const pendingCount = images.filter(img => img.status === 'pending' || img.status === 'processing').length;
  const completedCount = images.filter(img => img.status === 'completed').length;

  // 编辑图片（重新生成）
  const handleEditImage = (image: { prompt: string; model: string; provider: string }) => {
    setPrompt(image.prompt);
    // 切换到对应的供应商
    if (image.provider === 'gemini' || image.provider === 'openai') {
      if (apiConfig.currentProvider !== image.provider) {
        switchProvider(image.provider);
      }
    }
    // 选择模型
    if (image.model) {
      updateApiConfig({ selectedModel: image.model });
    }
    // 切换到创作工作台
    setActiveTab('create');
    setError(null);
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold tracking-tight">
            AI 创作室
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/gallery">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                公开作品集
              </Button>
            </Link>
            <SettingsPanel
              apiConfig={apiConfig}
              autoPublic={autoPublic}
              onUpdateProviderConfig={updateProviderConfig}
              onUpdateAutoPublic={updateAutoPublic}
            />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="create" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              创作工作台
            </TabsTrigger>
            <TabsTrigger value="my-images" className="gap-1.5">
              <ImageIcon className="h-4 w-4" />
              我的作品
              {completedCount > 0 && (
                <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 rounded">
                  {completedCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 创作工作台 */}
          <TabsContent value="create">
            <div className="grid lg:grid-cols-[1fr,1.2fr] gap-6">
              {/* 左侧：生成器 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    创作工作台
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    {/* 供应商选择器 */}
                    <ProviderSelector
                      currentProvider={currentProvider}
                      onProviderChange={switchProvider}
                    />

                    <Separator />

                    {/* 模型选择 */}
                    <div className="space-y-2">
                      <Label className="text-base font-serif">选择模型</Label>
                      <ModelSelector
                        apiConfig={apiConfig}
                        selectedModel={apiConfig.selectedModel}
                        currentProvider={currentProvider}
                        currentProviderConfig={currentProviderConfig}
                        onModelChange={handleModelChange}
                      />
                    </div>

                    {/* 尺寸选择 */}
                    <SizeSelector
                      provider={currentProvider}
                      aspectRatio={apiConfig.aspectRatio}
                      imageSize={apiConfig.imageSize}
                      openaiSize={apiConfig.openaiSize}
                      useCustomSize={apiConfig.useCustomSize}
                      apiKey={currentProviderConfig.apiKey}
                      onSizeChange={handleSizeChange}
                    />

                    <Separator />

                    {/* 提示词输入 */}
                    <div className="space-y-2">
                      <Label htmlFor="prompt" className="text-base font-serif">
                        创作提示词
                      </Label>
                      <Textarea
                        id="prompt"
                        placeholder="描述你想要生成的图片，例如：一只可爱的香蕉在阳光下微笑，水彩画风格"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="min-h-[120px] resize-none"
                        disabled={isSubmitting}
                      />
                    </div>

                    {/* 参考图片（图生图） */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="use-reference"
                          checked={useReferenceImage}
                          onCheckedChange={handleUseReferenceImageChange}
                          disabled={isSubmitting}
                        />
                        <Label
                          htmlFor="use-reference"
                          className="text-sm cursor-pointer"
                        >
                          使用参考图片（图生图）
                        </Label>
                      </div>
                      
                      {useReferenceImage && (
                        <ReferenceImageUploader
                          value={referenceImage?.base64 || null}
                          onChange={handleReferenceImageChange}
                          disabled={isSubmitting}
                        />
                      )}
                    </div>

                    {/* 处理中提示 */}
                    {pendingCount > 0 && (
                      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <Clock className="h-4 w-4 animate-spin" />
                        有 {pendingCount} 个任务正在处理中...
                      </div>
                    )}

                    {error && (
                      <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                        {error}
                      </div>
                    )}

                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !prompt.trim() || !apiConfig.selectedModel}
                      className="w-full h-11"
                      size="lg"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          提交中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          生成图片
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      提交后图片将后台生成，可在「我的作品」查看进度
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* 右侧：最近作品预览 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    最近作品
                    {pendingCount > 0 && (
                      <span className="text-sm font-normal text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="h-3 w-3 animate-spin" />
                        {pendingCount} 处理中
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageGallery
                    images={images.slice(0, 12)}
                    onDeleteImage={deleteImage}
                    onTogglePublic={toggleImagePublic}
                    onEdit={handleEditImage}
                    showStatus={true}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 我的作品 */}
          <TabsContent value="my-images">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="font-serif flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  我的作品集
                  <span className="text-sm font-normal text-muted-foreground ml-auto">
                    {completedCount} 张图片
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ImageGallery
                    images={images}
                    onDeleteImage={deleteImage}
                    onTogglePublic={toggleImagePublic}
                    onEdit={handleEditImage}
                    showStatus={true}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
