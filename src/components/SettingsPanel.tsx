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
import { Settings, Check, Copy, User, LogIn } from 'lucide-react';
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
  userId: string | null;
  onUpdateProviderConfig: (provider: ApiProvider, config: Partial<ProviderConfig>) => void;
  onUpdateAutoPublic: (autoPublic: boolean) => void;
  onUpdateUserId?: (userId: string) => void;
}

export function SettingsPanel({ 
  apiConfig, 
  autoPublic, 
  userId,
  onUpdateProviderConfig, 
  onUpdateAutoPublic,
  onUpdateUserId 
}: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importToken, setImportToken] = useState('');
  const [importError, setImportError] = useState('');
  
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
      setImportToken('');
      setImportError('');
    }
    setIsOpen(open);
  };
  
  // 复制用户 token
  const handleCopyToken = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };
  
  // 导入用户 token（用于在其他设备恢复身份）
  const handleImportToken = () => {
    const token = importToken.trim();
    
    // 验证 token 格式（64 位十六进制）
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setImportError('无效的 Token 格式，应为 64 位十六进制字符');
      return;
    }
    
    // 保存到 localStorage
    localStorage.setItem('ai-image-user-token', token);
    
    // 通知父组件更新
    if (onUpdateUserId) {
      onUpdateUserId(token);
    }
    
    // 清空输入
    setImportToken('');
    setImportError('');
    
    // 提示成功
    alert('身份已恢复，页面将刷新以应用更改');
    window.location.reload();
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
            <div className="space-y-6">
              {/* 用户身份 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <Label>用户身份</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  此 Token 用于标识你的身份，可在不同设备间同步作品。复制后粘贴到其他设备即可恢复身份。
                </p>
                
                {/* 显示当前 token */}
                <div className="flex gap-2">
                  <Input
                    value={userId || ''}
                    readOnly
                    className="font-mono text-xs bg-muted/50"
                    placeholder="加载中..."
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToken}
                    title="复制 Token"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {/* 导入 token */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">导入身份</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    在其他设备复制了 Token？粘贴到这里恢复身份。
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={importToken}
                      onChange={(e) => {
                        setImportToken(e.target.value);
                        setImportError('');
                      }}
                      placeholder="粘贴 64 位 Token..."
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      onClick={handleImportToken}
                      disabled={!importToken.trim()}
                    >
                      导入
                    </Button>
                  </div>
                  {importError && (
                    <p className="text-xs text-destructive">{importError}</p>
                  )}
                </div>
              </div>
              
              <div className="border-t pt-4">
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
