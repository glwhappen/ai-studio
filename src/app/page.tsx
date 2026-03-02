'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { SettingsPanel, loadPromptTemplates, loadPromptLLMConfig } from '@/components/SettingsPanel';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Sparkles, Image as ImageIcon, Loader2, ExternalLink, Clock, HelpCircle, Wand2, Pencil, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
    fetchImages,
    submitGeneration,
    toggleImagePublic,
    deleteImage,
    updateUserId,
  } = useAppState();

  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useReferenceImage, setUseReferenceImage] = useState(false);
  const [referenceImage, setReferenceImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [activeTab, setActiveTab] = useState('create');
  
  // AI优化相关状态
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isRewriteDialogOpen, setIsRewriteDialogOpen] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  // 直接生成相关状态（每个任务独立执行，不阻塞）
  const [directGenerateResults, setDirectGenerateResults] = useState<Array<{ status: 'pending' | 'generating' | 'success' | 'error'; instruction: string; error?: string }>>([]);

  // 提示词历史记录（用于撤销/重做）
  const [promptHistory, setPromptHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const skipHistoryRef = useRef(false);

  // 更新提示词并记录历史
  const updatePromptWithHistory = useCallback((newPrompt: string) => {
    // 始终更新 prompt 值
    setPrompt(newPrompt);
    
    // 如果标记跳过历史记录，则只更新值不记录历史
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    
    // 只有内容真正变化时才记录
    if (newPrompt !== promptHistory[historyIndex]) {
      // 截断后面的历史
      const newHistory = [...promptHistory.slice(0, historyIndex + 1), newPrompt];
      // 限制历史记录数量
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      setPromptHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [promptHistory, historyIndex]);

  // 撤销
  const undoPrompt = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      skipHistoryRef.current = true;
      setPrompt(promptHistory[newIndex]);
    }
  }, [historyIndex, promptHistory]);

  // 重做
  const redoPrompt = useCallback(() => {
    if (historyIndex < promptHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      skipHistoryRef.current = true;
      setPrompt(promptHistory[newIndex]);
    }
  }, [historyIndex, promptHistory]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoPrompt();
      }
      // Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoPrompt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoPrompt, redoPrompt]);

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
    const referenceImageUrlParam = searchParams.get('referenceImageUrl');
    
    // 只有有参数时才处理
    if (!promptParam && !modelParam && !providerParam) return;
    
    if (promptParam) {
      // 使用 ref 标记这是历史更新，避免重复记录
      skipHistoryRef.current = true;
      setPrompt(promptParam);
      // 重置历史记录
      setPromptHistory(['', promptParam]);
      setHistoryIndex(1);
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
    
    // 处理参考图 URL
    if (referenceImageUrlParam) {
      setUseReferenceImage(true);
      // 从 URL 加载图片并转换为 base64
      fetch(referenceImageUrlParam)
        .then(res => res.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const mimeType = blob.type || 'image/png';
            setReferenceImage({ base64: base64.split(',')[1], mimeType });
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => {
          console.error('Failed to load reference image:', err);
          setUseReferenceImage(false);
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

  // AI优化提示词
  const handleEnhancePrompt = async () => {
    if (!prompt.trim() || isEnhancing) return;
    
    setIsEnhancing(true);
    try {
      // 读取用户自定义模板
      const templates = loadPromptTemplates();
      
      const response = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          mode: 'enhance',
          enhanceSystemPrompt: templates.enhanceSystemPrompt,
          enhanceUserPrompt: templates.enhanceUserPrompt,
          // 传递 LLM 配置
          ...loadPromptLLMConfig(),
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        updatePromptWithHistory(data.enhancedPrompt);
      } else {
        setError(data.error || '优化失败');
      }
    } catch (err) {
      setError('优化失败，请重试');
    } finally {
      setIsEnhancing(false);
    }
  };

  // AI改写提示词
  const handleRewritePrompt = async () => {
    if (!prompt.trim() || !rewriteInstruction.trim() || isRewriting) return;
    
    setIsRewriting(true);
    try {
      // 读取用户自定义模板
      const templates = loadPromptTemplates();
      // 读取用户 LLM 配置
      const llmConfig = loadPromptLLMConfig();
      
      const response = await fetch('/api/prompt/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt, 
          mode: 'rewrite', 
          instruction: rewriteInstruction,
          rewriteSystemPrompt: templates.rewriteSystemPrompt,
          rewriteUserPrompt: templates.rewriteUserPrompt,
          // 传递 LLM 配置
          ...llmConfig,
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        updatePromptWithHistory(data.enhancedPrompt);
        setIsRewriteDialogOpen(false);
        setRewriteInstruction('');
      } else {
        setError(data.error || '改写失败');
      }
    } catch (err) {
      setError('改写失败，请重试');
    } finally {
      setIsRewriting(false);
    }
  };

  // 直接生成（后台改写并绘图，立即返回，可连续提交多个任务）
  const handleDirectGenerate = () => {
    if (!prompt.trim() || !rewriteInstruction.trim()) return;
    
    const currentInstruction = rewriteInstruction;
    
    // 添加到结果列表
    const resultIndex = directGenerateResults.length;
    setDirectGenerateResults(prev => [...prev, { 
      status: 'generating', 
      instruction: currentInstruction 
    }]);
    
    // 清空输入框，让用户可以继续输入新的指令
    setRewriteInstruction('');
    
    // 后台执行改写和生成（不阻塞用户操作）
    (async () => {
      try {
        // 1. 先改写提示词
        const templates = loadPromptTemplates();
        const llmConfig = loadPromptLLMConfig();
        
        const rewriteResponse = await fetch('/api/prompt/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt, 
            mode: 'rewrite', 
            instruction: currentInstruction,
            rewriteSystemPrompt: templates.rewriteSystemPrompt,
            rewriteUserPrompt: templates.rewriteUserPrompt,
            ...llmConfig,
          }),
        });
        
        const rewriteData = await rewriteResponse.json();
        if (!rewriteData.success) {
          setDirectGenerateResults(prev => prev.map((r, i) => 
            i === resultIndex ? { ...r, status: 'error', error: rewriteData.error || '改写失败' } : r
          ));
          return;
        }
        
        const enhancedPrompt = rewriteData.enhancedPrompt;
        
        // 2. 提交生成任务（后台执行）
        const currentConfig = getCurrentProviderConfig();
        const submitResponse = await fetch('/api/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            model: apiConfig.selectedModel,
            provider: currentProvider,
            baseUrl: currentConfig.baseUrl,
            apiKey: currentConfig.apiKey,
            userId: userId,
            isPublic: autoPublic,
            aspectRatio: apiConfig.aspectRatio,
            imageSize: apiConfig.imageSize,
            size: apiConfig.openaiSize,
            referenceImage: referenceImage?.base64,
            referenceImageMime: referenceImage?.mimeType,
          }),
        });
        
        const submitData = await submitResponse.json();
        
        if (submitData.success) {
          setDirectGenerateResults(prev => prev.map((r, i) => 
            i === resultIndex ? { ...r, status: 'success' } : r
          ));
          // 刷新图片列表
          fetchImages();
        } else {
          setDirectGenerateResults(prev => prev.map((r, i) => 
            i === resultIndex ? { ...r, status: 'error', error: submitData.error || '生成失败' } : r
          ));
        }
      } catch (err) {
        setDirectGenerateResults(prev => prev.map((r, i) => 
          i === resultIndex ? { ...r, status: 'error', error: '请求失败' } : r
        ));
      }
    })();
  };

  // 清空提示词
  const handleClearPrompt = () => {
    skipHistoryRef.current = true;
    setPrompt('');
    setPromptHistory(['']);
    setHistoryIndex(0);
    setError(null);
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
      skipHistoryRef.current = true;
      setPrompt('');
      setPromptHistory(['']);
      setHistoryIndex(0);
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
  const handleEditImage = (image: { 
    prompt: string; 
    model: string; 
    provider: string;
    config?: Record<string, unknown> | null;
  }) => {
    // 直接设置状态
    skipHistoryRef.current = true;
    setPrompt(image.prompt);
    setPromptHistory(['', image.prompt]);
    setHistoryIndex(1);
    setActiveTab('create');
    
    // 自动选择供应商
    if (image.provider === 'gemini' || image.provider === 'openai') {
      switchProvider(image.provider);
    }
    
    // 自动选择模型
    if (image.model) {
      updateApiConfig({ selectedModel: image.model });
    }
    
    // 传递尺寸参数
    if (image.config) {
      const sizeConfig: {
        useCustomSize: boolean;
        aspectRatio?: string;
        imageSize?: string;
        openaiSize?: string;
      } = { useCustomSize: true };
      
      if (image.config.aspectRatio) sizeConfig.aspectRatio = image.config.aspectRatio as string;
      if (image.config.imageSize) sizeConfig.imageSize = image.config.imageSize as string;
      if (image.config.size) sizeConfig.openaiSize = image.config.size as string;
      
      updateApiConfig(sizeConfig);
      
      // 处理参考图 URL
      if (image.config.referenceImageUrl) {
        setUseReferenceImage(true);
        fetch(image.config.referenceImageUrl as string)
          .then(res => res.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              const mimeType = blob.type || 'image/png';
              setReferenceImage({ base64: base64.split(',')[1], mimeType });
            };
            reader.readAsDataURL(blob);
          })
          .catch(err => {
            console.error('Failed to load reference image:', err);
            setUseReferenceImage(false);
          });
      }
    }
    
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
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-serif text-xl font-bold tracking-tight">
            AI 创作室
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/about">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <HelpCircle className="h-4 w-4" />
                功能介绍
              </Button>
            </Link>
            <Link href="/gallery">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                公开作品集
              </Button>
            </Link>
            <SettingsPanel
              apiConfig={apiConfig}
              autoPublic={autoPublic}
              userId={userId}
              onUpdateProviderConfig={updateProviderConfig}
              onUpdateAutoPublic={updateAutoPublic}
              onUpdateUserId={updateUserId}
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
            <div className="space-y-6">
              {/* 上半部分：配置 + 创作（电脑端左右两栏，手机端单栏） */}
              <div className="grid lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
                
                {/* 左侧：配置选项 */}
                <Card className="lg:h-fit lg:sticky lg:top-20">
                  <CardHeader className="pb-3 lg:hidden">
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      创作配置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-5">
                    <div className="space-y-4">
                      {/* 供应商选择器 */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">供应商</Label>
                        <ProviderSelector
                          currentProvider={currentProvider}
                          onProviderChange={switchProvider}
                        />
                      </div>

                      {/* 模型选择 */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">模型</Label>
                        <ModelSelector
                          apiConfig={apiConfig}
                          selectedModel={apiConfig.selectedModel}
                          currentProvider={currentProvider}
                          currentProviderConfig={currentProviderConfig}
                          onModelChange={handleModelChange}
                        />
                      </div>

                      {/* 尺寸选择 */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">图片尺寸</Label>
                        <SizeSelector
                          provider={currentProvider}
                          aspectRatio={apiConfig.aspectRatio}
                          imageSize={apiConfig.imageSize}
                          openaiSize={apiConfig.openaiSize}
                          useCustomSize={apiConfig.useCustomSize}
                          apiKey={currentProviderConfig.apiKey}
                          onSizeChange={handleSizeChange}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 右侧：创作区域 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif flex items-center gap-2">
                      <Wand2 className="h-5 w-5 text-primary" />
                      创作提示词
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-5">
                    <div className="space-y-4">
                      {/* 提示词输入 */}
                      <div className="space-y-2">
                        <Textarea
                          id="prompt"
                          placeholder="描述你想要生成的图片，例如：一只可爱的香蕉在阳光下微笑，水彩画风格"
                          value={prompt}
                          onChange={(e) => updatePromptWithHistory(e.target.value)}
                          className="min-h-[140px] lg:min-h-[160px] resize-none"
                          disabled={isSubmitting}
                        />
                        {/* 提示词操作按钮 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* 撤销/重做 */}
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={undoPrompt}
                              disabled={historyIndex <= 0 || isSubmitting}
                              className="h-7 w-7 p-0"
                              title="撤销 (Ctrl+Z)"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={redoPrompt}
                              disabled={historyIndex >= promptHistory.length - 1 || isSubmitting}
                              className="h-7 w-7 p-0"
                              title="重做 (Ctrl+Y)"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                              </svg>
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearPrompt}
                            disabled={!prompt.trim() || isSubmitting}
                            className="h-7 px-2 text-xs"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            清空
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleEnhancePrompt}
                            disabled={!prompt.trim() || isSubmitting || isEnhancing}
                            className="h-7 px-2 text-xs"
                          >
                            {isEnhancing ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3 mr-1" />
                            )}
                            AI优化
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsRewriteDialogOpen(true)}
                            disabled={!prompt.trim() || isSubmitting}
                            className="h-7 px-2 text-xs"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            改写
                          </Button>
                        </div>
                      </div>

                      {/* 参考图片（图生图） */}
                      <div className="space-y-2">
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
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                          <Clock className="h-4 w-4 animate-spin" />
                          有 {pendingCount} 个任务正在处理中...
                        </div>
                      )}

                      {error && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2.5">
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
              </div>

              {/* 下半部分：最近作品 */}
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

      {/* AI改写对话框 */}
      <Dialog open={isRewriteDialogOpen} onOpenChange={(open) => {
        setIsRewriteDialogOpen(open);
        if (!open) {
          // 关闭时清空结果
          setDirectGenerateResults([]);
        }
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              AI改写提示词
            </DialogTitle>
            <DialogDescription>
              告诉AI你想要如何修改提示词，例如：把主角换成猫咪、改成油画风格、增加夜景氛围等
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rewrite-instruction">修改指令</Label>
              <Textarea
                id="rewrite-instruction"
                placeholder="输入你想要的修改内容...&#10;例如：把主角换成一只橘猫、改成水彩画风格、增加黄昏的光线效果"
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isRewriting}
              />
            </div>
            
            {/* 直接生成结果列表 */}
            {directGenerateResults.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">生成记录</Label>
                <div className="max-h-[150px] overflow-y-auto space-y-1.5">
                  {directGenerateResults.map((result, index) => (
                    <div 
                      key={index} 
                      className={`flex items-center gap-2 text-xs p-2 rounded ${
                        result.status === 'success' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                        result.status === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                        result.status === 'generating' ? 'bg-primary/10 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {result.status === 'generating' && <Loader2 className="h-3 w-3 animate-spin" />}
                      {result.status === 'success' && <CheckCircle className="h-3 w-3" />}
                      {result.status === 'error' && <AlertCircle className="h-3 w-3" />}
                      <span className="truncate flex-1">{result.instruction}</span>
                      {result.status === 'success' && <span className="text-[10px]">已提交</span>}
                      {result.status === 'error' && <span className="text-[10px]">{result.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsRewriteDialogOpen(false);
                  setRewriteInstruction('');
                }}
                className="flex-1 sm:flex-none"
              >
                关闭
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="secondary"
                onClick={handleRewritePrompt}
                disabled={!rewriteInstruction.trim() || isRewriting}
                className="flex-1 sm:flex-none"
              >
                {isRewriting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    改写中...
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-2" />
                    改写
                  </>
                )}
              </Button>
              <Button 
                onClick={handleDirectGenerate}
                disabled={!rewriteInstruction.trim() || !userId}
                className="flex-1 sm:flex-none"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                直接生成
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
