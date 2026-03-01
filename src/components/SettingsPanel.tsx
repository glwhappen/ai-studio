'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Check, Copy, User, LogIn, Wand2, Pencil } from 'lucide-react';
import type { ApiConfig, ApiProvider, ProviderConfig } from '@/types';
import { PROVIDER_INFO } from '@/types';

// 默认配置（内置）
const DEFAULT_CONFIGS: Record<ApiProvider, { baseUrl: string }> = {
  gemini: { baseUrl: 'https://ai.nflow.red' },
  openai: { baseUrl: 'https://ai.nflow.red' },
};

// 默认提示词模板
const DEFAULT_ENHANCE_SYSTEM_PROMPT = `你是一个专业的AI图片生成提示词优化专家。你的任务是优化用户提供的提示词，使其更适合AI图片生成。

优化规则：
1. 保持原有提示词的核心意图和主题不变
2. 添加更多视觉细节描述，如光影、构图、氛围、材质等
3. 添加艺术风格、画质、视角等专业术语
4. 使提示词更加具体和明确，减少歧义
5. 输出的提示词应该更容易让AI理解和生成高质量图片
6. 直接输出优化后的提示词，不要有任何解释或额外文字
7. 输出语言与输入语言保持一致`;

const DEFAULT_ENHANCE_USER_PROMPT = `请优化以下图片生成提示词，使其更加详细和专业，但不要改变原本的意思：

{{prompt}}`;

const DEFAULT_REWRITE_SYSTEM_PROMPT = `你是一个专业的AI图片生成提示词改写专家。你的任务是根据用户的修改指令来改写提示词。

改写规则：
1. 严格遵循用户的修改指令
2. 保留提示词中未被要求修改的部分
3. 改写后的提示词应该更加清晰和具体
4. 直接输出改写后的提示词，不要有任何解释或额外文字
5. 输出语言与输入语言保持一致`;

const DEFAULT_REWRITE_USER_PROMPT = `请根据以下修改指令改写提示词：

原提示词：
{{prompt}}

修改指令：
{{instruction}}`;

// 提示词模板存储 key
const PROMPT_TEMPLATES_KEY = 'ai-prompt-templates';
// 提示词 LLM 配置存储 key
const PROMPT_LLM_CONFIG_KEY = 'ai-prompt-llm-config';

// 提示词模板接口
export interface PromptTemplates {
  enhanceSystemPrompt: string;
  enhanceUserPrompt: string;
  rewriteSystemPrompt: string;
  rewriteUserPrompt: string;
}

// 提示词 LLM 配置接口
export interface PromptLLMConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

// 默认模板
export const DEFAULT_PROMPT_TEMPLATES: PromptTemplates = {
  enhanceSystemPrompt: DEFAULT_ENHANCE_SYSTEM_PROMPT,
  enhanceUserPrompt: DEFAULT_ENHANCE_USER_PROMPT,
  rewriteSystemPrompt: DEFAULT_REWRITE_SYSTEM_PROMPT,
  rewriteUserPrompt: DEFAULT_REWRITE_USER_PROMPT,
};

// 默认 LLM 配置
export const DEFAULT_PROMPT_LLM_CONFIG: PromptLLMConfig = {
  baseUrl: 'https://ai.nflow.red',
  apiKey: '',
  model: 'gpt-5',
};

// 模型信息接口
export interface ModelInfo {
  id: string;
}

// 加载提示词模板
export function loadPromptTemplates(): PromptTemplates {
  if (typeof window === 'undefined') return DEFAULT_PROMPT_TEMPLATES;
  
  try {
    const stored = localStorage.getItem(PROMPT_TEMPLATES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PROMPT_TEMPLATES, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load prompt templates:', e);
  }
  return DEFAULT_PROMPT_TEMPLATES;
}

// 保存提示词模板
export function savePromptTemplates(templates: PromptTemplates): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROMPT_TEMPLATES_KEY, JSON.stringify(templates));
}

// 加载提示词 LLM 配置
export function loadPromptLLMConfig(): PromptLLMConfig {
  if (typeof window === 'undefined') return DEFAULT_PROMPT_LLM_CONFIG;
  
  try {
    const stored = localStorage.getItem(PROMPT_LLM_CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_PROMPT_LLM_CONFIG, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load prompt LLM config:', e);
  }
  return DEFAULT_PROMPT_LLM_CONFIG;
}

// 保存提示词 LLM 配置
export function savePromptLLMConfig(config: PromptLLMConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PROMPT_LLM_CONFIG_KEY, JSON.stringify(config));
}

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
  
  // 提示词模板状态
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplates>(DEFAULT_PROMPT_TEMPLATES);
  const [templatesSaved, setTemplatesSaved] = useState(false);
  
  // 提示词 LLM 配置状态
  const [promptLLMConfig, setPromptLLMConfig] = useState<PromptLLMConfig>(DEFAULT_PROMPT_LLM_CONFIG);
  const [llmConfigSaved, setLLMConfigSaved] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  
  // 临时编辑状态（不显示实际的 apiKey）
  const [geminiConfig, setGeminiConfig] = useState({ 
    ...apiConfig.providers.gemini, 
    apiKey: '' // 始终显示为空
  });
  const [openaiConfig, setOpenaiConfig] = useState({ 
    ...apiConfig.providers.openai, 
    apiKey: '' // 始终显示为空
  });

  // 加载模型列表
  const loadModels = useCallback(async (baseUrl: string, apiKey: string) => {
    setIsLoadingModels(true);
    try {
      const params = new URLSearchParams();
      params.set('baseUrl', baseUrl);
      if (apiKey) params.set('apiKey', apiKey);
      
      const response = await fetch(`/api/models?${params.toString()}`);
      const data = await response.json();
      
      if (data.models && data.models.length > 0) {
        setAvailableModels(data.models);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // 打开时重置为空，不显示实际 key
      setGeminiConfig({ ...apiConfig.providers.gemini, apiKey: '' });
      setOpenaiConfig({ ...apiConfig.providers.openai, apiKey: '' });
      setImportToken('');
      setImportError('');
      // 加载提示词模板
      setPromptTemplates(loadPromptTemplates());
      setTemplatesSaved(false);
      // 加载提示词 LLM 配置
      const llmConfig = loadPromptLLMConfig();
      setPromptLLMConfig(llmConfig);
      setLLMConfigSaved(false);
      // 加载模型列表
      loadModels(llmConfig.baseUrl, llmConfig.apiKey);
    }
    setIsOpen(open);
  };
  
  // 保存提示词模板
  const handleSaveTemplates = () => {
    savePromptTemplates(promptTemplates);
    setTemplatesSaved(true);
    setTimeout(() => setTemplatesSaved(false), 2000);
  };
  
  // 重置提示词模板
  const handleResetTemplates = () => {
    setPromptTemplates(DEFAULT_PROMPT_TEMPLATES);
  };
  
  // 保存提示词 LLM 配置
  const handleSaveLLMConfig = () => {
    savePromptLLMConfig(promptLLMConfig);
    setLLMConfigSaved(true);
    setTimeout(() => setLLMConfigSaved(false), 2000);
  };
  
  // 重置提示词 LLM 配置
  const handleResetLLMConfig = () => {
    setPromptLLMConfig(DEFAULT_PROMPT_LLM_CONFIG);
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">设置</DialogTitle>
          <DialogDescription>
            配置 API 供应商和偏好设置
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preferences">偏好</TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              提示词
            </TabsTrigger>
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
          
          {/* 提示词模板配置 */}
          <TabsContent value="prompts" className="pt-4">
            <div className="space-y-6">
              {/* LLM 配置 */}
              <div className="space-y-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <Label>模型配置</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  配置用于提示词优化的 AI 模型。留空 API Key 则使用内置服务。
                </p>
                
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="llm-baseUrl" className="text-sm">Base URL</Label>
                    <Input
                      id="llm-baseUrl"
                      placeholder={DEFAULT_PROMPT_LLM_CONFIG.baseUrl}
                      value={promptLLMConfig.baseUrl}
                      onChange={(e) => setPromptLLMConfig(prev => ({ 
                        ...prev, 
                        baseUrl: e.target.value 
                      }))}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      留空使用默认地址
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="llm-apiKey" className="text-sm">API Key</Label>
                    <Input
                      id="llm-apiKey"
                      type="password"
                      placeholder="留空使用内置密钥"
                      value={promptLLMConfig.apiKey}
                      onChange={(e) => setPromptLLMConfig(prev => ({ 
                        ...prev, 
                        apiKey: e.target.value 
                      }))}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      可选，留空使用内置服务
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="llm-model" className="text-sm">文本模型</Label>
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id="llm-model"
                            value={promptLLMConfig.model}
                            onChange={(e) => setPromptLLMConfig(prev => ({ 
                              ...prev, 
                              model: e.target.value 
                            }))}
                            onFocus={() => setShowModelDropdown(true)}
                            onBlur={() => {
                              // 延迟关闭，允许点击下拉选项
                              setTimeout(() => setShowModelDropdown(false), 200);
                            }}
                            placeholder="输入或选择模型"
                            className="font-mono text-sm"
                            disabled={isLoadingModels}
                          />
                          {/* 下拉提示列表 */}
                          {showModelDropdown && availableModels.length > 0 && (
                            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {availableModels
                                .filter(m => m.id.toLowerCase().includes(promptLLMConfig.model.toLowerCase()))
                                .slice(0, 15)
                                .map(model => (
                                  <div
                                    key={model.id}
                                    className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent truncate"
                                    onClick={() => {
                                      setPromptLLMConfig(prev => ({ 
                                        ...prev, 
                                        model: model.id 
                                      }));
                                      setShowModelDropdown(false);
                                    }}
                                  >
                                    {model.id}
                                  </div>
                                ))}
                              {availableModels.filter(m => m.id.toLowerCase().includes(promptLLMConfig.model.toLowerCase())).length === 0 && (
                                <div className="px-3 py-1.5 text-sm text-muted-foreground">
                                  无匹配模型
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadModels(promptLLMConfig.baseUrl, promptLLMConfig.apiKey)}
                          disabled={isLoadingModels}
                          title="刷新模型列表"
                        >
                          {isLoadingModels ? (
                            <span className="animate-spin">⟳</span>
                          ) : (
                            '⟳'
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      输入模型名称或从列表中选择，点击刷新按钮获取可用模型
                    </p>
                  </div>
                  
                  <div className="flex justify-between pt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetLLMConfig}
                    >
                      恢复默认
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleSaveLLMConfig}
                    >
                      {llmConfigSaved ? (
                        <>
                          <Check className="h-4 w-4 mr-1 text-green-500" />
                          已保存
                        </>
                      ) : (
                        '保存配置'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-muted-foreground" />
                  <Label>AI优化模板</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  自定义AI优化提示词的行为。使用 <code className="bg-muted px-1 rounded">{'{{prompt}}'}</code> 作为原始提示词的占位符。
                </p>
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm">系统提示词</Label>
                <Textarea
                  value={promptTemplates.enhanceSystemPrompt}
                  onChange={(e) => setPromptTemplates(prev => ({ 
                    ...prev, 
                    enhanceSystemPrompt: e.target.value 
                  }))}
                  className="min-h-[120px] text-sm"
                  placeholder="定义AI的角色和优化规则..."
                />
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm">用户提示词</Label>
                <Textarea
                  value={promptTemplates.enhanceUserPrompt}
                  onChange={(e) => setPromptTemplates(prev => ({ 
                    ...prev, 
                    enhanceUserPrompt: e.target.value 
                  }))}
                  className="min-h-[80px] text-sm"
                  placeholder="包含 {{prompt}} 占位符..."
                />
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <Label>AI改写模板</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  自定义AI改写提示词的行为。使用 <code className="bg-muted px-1 rounded">{'{{prompt}}'}</code> 和 <code className="bg-muted px-1 rounded">{'{{instruction}}'}</code> 作为占位符。
                </p>
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm">系统提示词</Label>
                <Textarea
                  value={promptTemplates.rewriteSystemPrompt}
                  onChange={(e) => setPromptTemplates(prev => ({ 
                    ...prev, 
                    rewriteSystemPrompt: e.target.value 
                  }))}
                  className="min-h-[100px] text-sm"
                  placeholder="定义AI的角色和改写规则..."
                />
              </div>
              
              <div className="space-y-3">
                <Label className="text-sm">用户提示词</Label>
                <Textarea
                  value={promptTemplates.rewriteUserPrompt}
                  onChange={(e) => setPromptTemplates(prev => ({ 
                    ...prev, 
                    rewriteUserPrompt: e.target.value 
                  }))}
                  className="min-h-[80px] text-sm"
                  placeholder="包含 {{prompt}} 和 {{instruction}} 占位符..."
                />
              </div>
              
              <div className="flex justify-between pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleResetTemplates}
                >
                  恢复默认
                </Button>
                <Button 
                  size="sm"
                  onClick={handleSaveTemplates}
                >
                  {templatesSaved ? (
                    <>
                      <Check className="h-4 w-4 mr-1 text-green-500" />
                      已保存
                    </>
                  ) : (
                    '保存模板'
                  )}
                </Button>
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
