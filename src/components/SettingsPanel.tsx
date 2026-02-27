'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Settings, Check, AlertCircle } from 'lucide-react';
import type { ApiConfig } from '@/types';

interface SettingsPanelProps {
  apiConfig: ApiConfig;
  onUpdateConfig: (config: Partial<ApiConfig>) => void;
}

export function SettingsPanel({ apiConfig, onUpdateConfig }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState(apiConfig.baseUrl);
  const [apiKey, setApiKey] = useState(apiConfig.apiKey);

  const handleSave = () => {
    onUpdateConfig({ baseUrl, apiKey });
    setIsOpen(false);
  };

  const isConfigured = apiConfig.baseUrl && apiConfig.apiKey;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
        >
          <Settings className="h-4 w-4" />
          {isConfigured ? (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary">
              <Check className="h-2 w-2 text-primary-foreground p-0.5" />
            </span>
          ) : (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">API 配置</DialogTitle>
          <DialogDescription>
            配置你的 Gemini API 参数以开始生成图片
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {!isConfigured && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>请先配置 API 参数才能生成图片</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              placeholder="https://generativelanguage.googleapis.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Gemini API 的基础地址
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="输入你的 API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              你的 Gemini API 密钥
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!baseUrl || !apiKey}>
              保存配置
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
