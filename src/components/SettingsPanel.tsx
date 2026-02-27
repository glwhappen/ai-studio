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
import { Settings, Check, AlertCircle } from 'lucide-react';
import type { ApiConfig, ApiProvider, ProviderConfig } from '@/types';
import { PROVIDER_INFO } from '@/types';

interface SettingsPanelProps {
  apiConfig: ApiConfig;
  onUpdateProviderConfig: (provider: ApiProvider, config: Partial<ProviderConfig>) => void;
}

export function SettingsPanel({ apiConfig, onUpdateProviderConfig }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // 临时编辑状态
  const [geminiConfig, setGeminiConfig] = useState({ ...apiConfig.providers.gemini });
  const [openaiConfig, setOpenaiConfig] = useState({ ...apiConfig.providers.openai });

  // 检查是否有已配置的供应商
  const hasAnyConfigured = Object.values(apiConfig.providers).some(p => p.enabled && p.baseUrl && p.apiKey);
  const configuredCount = Object.values(apiConfig.providers).filter(p => p.enabled && p.baseUrl && p.apiKey).length;

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // 打开时同步状态
      setGeminiConfig({ ...apiConfig.providers.gemini });
      setOpenaiConfig({ ...apiConfig.providers.openai });
    }
    setIsOpen(open);
  };

  const handleSaveProvider = (provider: ApiProvider) => {
    const config = provider === 'gemini' ? geminiConfig : openaiConfig;
    onUpdateProviderConfig(provider, config);
  };

  const renderProviderTab = (
    provider: ApiProvider,
    config: ProviderConfig,
    setConfig: React.Dispatch<React.SetStateAction<ProviderConfig>>
  ) => {
    const info = PROVIDER_INFO[provider];
    const isValid = config.baseUrl && config.apiKey;

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
            placeholder="https://api.example.com"
            value={config.baseUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
            className="font-mono text-sm"
            disabled={!config.enabled}
          />
          <p className="text-xs text-muted-foreground">
            {provider === 'gemini' 
              ? 'Gemini API 的基础地址' 
              : 'OpenAI 兼容 API 的基础地址'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${provider}-apiKey`}>API Key</Label>
          <Input
            id={`${provider}-apiKey`}
            type="password"
            placeholder="输入你的 API Key"
            value={config.apiKey}
            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            className="font-mono text-sm"
            disabled={!config.enabled}
          />
          <p className="text-xs text-muted-foreground">
            {provider === 'gemini' 
              ? '你的 Gemini API 密钥' 
              : '你的 OpenAI 兼容 API 密钥'}
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button 
            onClick={() => handleSaveProvider(provider)} 
            disabled={!config.enabled || !isValid}
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
          className="relative h-9 w-9"
        >
          <Settings className="h-4 w-4" />
          {hasAnyConfigured ? (
            <span className="absolute -right-0.5 -top-0.5 h-5 min-w-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-medium px-1">
              {configuredCount}
            </span>
          ) : (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">API 配置</DialogTitle>
          <DialogDescription>
            配置多个 API 供应商，支持 Gemini 和 OpenAI 兼容格式
          </DialogDescription>
        </DialogHeader>
        
        {!hasAnyConfigured && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>请至少配置一个供应商才能生成图片</span>
          </div>
        )}

        <Tabs defaultValue={apiConfig.currentProvider} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gemini" className="flex items-center gap-1.5">
              <span>{PROVIDER_INFO.gemini.icon}</span>
              <span>Gemini</span>
              {apiConfig.providers.gemini.enabled && apiConfig.providers.gemini.apiKey && (
                <Check className="h-3 w-3 text-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="openai" className="flex items-center gap-1.5">
              <span>{PROVIDER_INFO.openai.icon}</span>
              <span>GPT Image</span>
              {apiConfig.providers.openai.enabled && apiConfig.providers.openai.apiKey && (
                <Check className="h-3 w-3 text-primary" />
              )}
            </TabsTrigger>
          </TabsList>
          
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
