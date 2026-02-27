'use client';

import { useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ProjectList } from '@/components/ProjectList';
import { ImageGenerator } from '@/components/ImageGenerator';
import { ImageGallery } from '@/components/ImageGallery';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Menu, Sparkles, Image as ImageIcon } from 'lucide-react';

export default function Home() {
  const {
    state,
    isLoaded,
    updateApiConfig,
    createProject,
    deleteProject,
    selectProject,
    addImage,
    deleteImage,
    getProjectImages,
    getCurrentProject,
  } = useAppState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentProject = getCurrentProject();
  const projectImages = currentProject ? getProjectImages(currentProject.id) : [];

  const handleGenerate = (prompt: string, imageUrl: string, model: string, width: number, height: number) => {
    if (currentProject) {
      addImage({
        url: imageUrl,
        prompt,
        model,
        width,
        height,
        projectId: currentProject.id,
      });
    }
  };

  const handleModelChange = (model: string) => {
    updateApiConfig({ selectedModel: model });
  };

  const handleSizeChange = (width: number, height: number) => {
    updateApiConfig({ imageWidth: width, imageHeight: height });
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
    <div className="flex h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex w-72 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b px-4 h-14">
          <h1 className="font-serif text-xl font-bold tracking-tight">
            Gemini 创作室
          </h1>
          <SettingsPanel
            apiConfig={state.apiConfig}
            onUpdateConfig={updateApiConfig}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <ProjectList
            projects={state.projects}
            currentProjectId={state.currentProjectId}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            onSelectProject={selectProject}
            onOpenSettings={() => setSettingsOpen(true)}
            isApiConfigured={!!state.apiConfig.baseUrl && !!state.apiConfig.apiKey}
          />
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 移动端头部 */}
        <header className="md:hidden flex items-center justify-between border-b px-4 h-14">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex items-center justify-between border-b px-4 h-14">
                <h1 className="font-serif text-lg font-bold">Gemini 创作室</h1>
                <SettingsPanel
                  apiConfig={state.apiConfig}
                  onUpdateConfig={updateApiConfig}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <ProjectList
                  projects={state.projects}
                  currentProjectId={state.currentProjectId}
                  onCreateProject={createProject}
                  onDeleteProject={deleteProject}
                  onSelectProject={(id) => {
                    selectProject(id);
                    setMobileNavOpen(false);
                  }}
                  onOpenSettings={() => {
                    setMobileNavOpen(false);
                    setSettingsOpen(true);
                  }}
                  isApiConfigured={!!state.apiConfig.baseUrl && !!state.apiConfig.apiKey}
                />
              </div>
            </SheetContent>
          </Sheet>
          <h1 className="font-serif text-lg font-bold">Gemini 创作室</h1>
          <SettingsPanel
            apiConfig={state.apiConfig}
            onUpdateConfig={updateApiConfig}
          />
        </header>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto">
          {!currentProject ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="rounded-full bg-primary/10 p-6 mb-4">
                <ImageIcon className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-serif font-semibold mb-2">
                欢迎使用 Gemini 创作室
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                选择一个项目开始创作，或创建新项目来管理你的 AI 图片作品
              </p>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                {state.projects.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    从左侧选择一个项目继续
                  </p>
                ) : (
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => {
                      // 触发创建项目的逻辑
                      const project = createProject(
                        '我的第一个项目',
                        '开始你的 AI 创作之旅'
                      );
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    创建第一个项目
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-6 space-y-6">
              {/* 项目标题 */}
              <div>
                <h2 className="text-2xl font-serif font-semibold">
                  {currentProject.name}
                </h2>
                {currentProject.description && (
                  <p className="text-muted-foreground mt-1">
                    {currentProject.description}
                  </p>
                )}
              </div>

              <Separator />

              {/* 两栏布局 */}
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
                    <ImageGenerator
                      apiConfig={state.apiConfig}
                      projectId={currentProject.id}
                      onGenerate={handleGenerate}
                      onOpenSettings={() => setSettingsOpen(true)}
                      onModelChange={handleModelChange}
                      onSizeChange={handleSizeChange}
                    />
                  </CardContent>
                </Card>

                {/* 右侧：历史记录 */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-serif flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-primary" />
                      作品集
                      <span className="text-sm font-normal text-muted-foreground ml-auto">
                        {projectImages.length} 张图片
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ImageGallery
                      images={projectImages}
                      onDeleteImage={deleteImage}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
