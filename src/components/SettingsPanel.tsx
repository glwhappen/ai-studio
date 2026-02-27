'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Check } from 'lucide-react';
import type { ApiConfig, ApiProvider, ProviderConfig } from '@/types';
import { PROVIDER_INFO } from '@/types';

// 默认配置（内置）
const DEFAULT_CONFIGS: Record<ApiProvider, { baseUrl: string }> = {
  gemini: { baseUrl: 'https://ai.nflow.red' },
  openai: { baseUrl: 'https://ai.nflow.red' },
};

interface SettingsPanelProps {
  apiConfig: ApiConfig;
  autoPublic: boolean;
  onUpdateProviderConfig: (provider: ApiProvider, config: Partial<ProviderConfig>) => void;
  onUpdateAutoPublic: (autoPublic: boolean) => void;
}

export function SettingsPanel({ apiConfig, autoPublic, onUpdateProviderConfig, onUpdateAutoPublic }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // 临时编辑状态（不显示实际的 apiKey）
  const [geminiConfig, setGeminiConfig] = useState({ 
    ...apiConfig.providers.gemini, 
    apiKey: '' // 始终显示为空
  });
  const [openaiConfig, setOpenaiConfig] = useState({ 
    ...apiConfig.providers.openai, 
    apiKey: '' // 始终显示为空
  });

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // 打开时重置为空，不显示实际 key
      setGeminiConfig({ ...apiConfig.providers.gemini, apiKey: '' });
      setOpenaiConfig({ ...apiConfig.providers.openai, apiKey: '' });
    }
    setIsOpen(open);
  };

  const handleSaveProvider = (provider: ApiProvider) => {
    const config = provider === 'gemini' ? geminiConfig : openaiConfig;
    // 如果用户输入了新的 apiKey，使用用户的；否则保留原有配置
    const finalConfig: Partial<ProviderConfig> = {
      enabled: config.enabled,
      baseUrl: config.baseUrl || DEFAULT_CONFIGS[provider].baseUrl,
    };
    // 只有用户输入了新的 key 才更新
    if (config.apiKey && config.apiKey.trim()) {
      finalConfig.apiKey = config.apiKey.trim();
    }
    onUpdateProviderConfig(provider, finalConfig);
  };

  const renderProviderTab = (
    provider: ApiProvider,
    config: ProviderConfig & { apiKey: string },
    setConfig: React.Dispatch<React.SetStateAction<ProviderConfig>>
  ) => {
    const info = PROVIDER_INFO[provider];
    const hasCustomKey = !!apiConfig.providers[provider].apiKey && 
                          apiConfig.providers[provider].apiKey.length > 0;

    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{info.icon}</span>
            <div>
              <div className="font-medium">{info.name}</div>
              <div className="text-xs text-muted-foreground">{info.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor={`${provider}-enabled`} className="text-sm">
              启用
            </Label>
            <Switch
              id={`${provider}-enabled`}
              checked={config.enabled}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${provider}-baseUrl`}>Base URL</Label>
          <Input
            id={`${provider}-baseUrl`}
            placeholder={DEFAULT_CONFIGS[provider].baseUrl}
            value={config.baseUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
            className="font-mono text-sm"
            disabled={!config.enabled}
          />
          <p className="text-xs text-muted-foreground">
            留空使用默认地址
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${provider}-apiKey`}>API Key</Label>
          <Input
            id={`${provider}-apiKey`}
            type="password"
            placeholder={hasCustomKey ? "已配置自定义密钥（留空保持不变）" : "留空使用内置密钥"}
            value={config.apiKey}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            className="font-mono text-sm"
            disabled={!config.enabled}
          />
          <p className="text-xs text-muted-foreground">
            {hasCustomKey 
              ? "输入新密钥可覆盖当前配置" 
              : "可选，留空使用内置服务"}
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button 
            onClick={() => handleSaveProvider(provider)} 
            disabled={!config.enabled}
            size="sm"
          >
            保存配置
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">设置</DialogTitle>
          <DialogDescription>
            配置 API 供应商和偏好设置
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preferences">偏好</TabsTrigger>
            <TabsTrigger value="gemini" className="flex items-center gap-1.5">
              <span>{PROVIDER_INFO.gemini.icon}</span>
              <span>Gemini</span>
              {apiConfig.providers.gemini.enabled && (
                <Check className="h-3 w-3 text-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="openai" className="flex items-center gap-1.5">
              <span>{PROVIDER_INFO.openai.icon}</span>
              <span>GPT Image</span>
              {apiConfig.providers.openai.enabled && (
                <Check className="h-3 w-3 text-primary" />
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="preferences" className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-public">自动公开作品</Label>
                  <p className="text-xs text-muted-foreground">
                    生成完成后自动将作品添加到公开作品集
                  </p>
                </div>
                <Switch
                  id="auto-public"
                  checked={autoPublic}
                  onCheckedChange={onUpdateAutoPublic}
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="gemini">
            {renderProviderTab('gemini', geminiConfig, setGeminiConfig)}
          </TabsContent>
          
          <TabsContent value="openai">
            {renderProviderTab('openai', openaiConfig, setOpenaiConfig)}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
