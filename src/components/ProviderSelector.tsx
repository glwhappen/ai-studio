'use client';

import { Button } from '@/components/ui/button';
import { PROVIDER_INFO, type ApiProvider } from '@/types';
import { cn } from '@/lib/utils';

interface ProviderSelectorProps {
  currentProvider: ApiProvider;
  onProviderChange: (provider: ApiProvider) => void;
  disabled?: boolean;
}

export function ProviderSelector({
  currentProvider,
  onProviderChange,
  disabled = false,
}: ProviderSelectorProps) {
  const providers: ApiProvider[] = ['gemini', 'openai'];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        API 供应商
      </label>
      <div className="flex gap-2">
        {providers.map((provider) => {
          const info = PROVIDER_INFO[provider];
          const isSelected = currentProvider === provider;

          return (
            <Button
              key={provider}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              disabled={disabled}
              onClick={() => onProviderChange(provider)}
              className={cn(
                'flex-1 h-auto py-3 flex flex-col items-center gap-1',
                isSelected && 'ring-2 ring-ring ring-offset-2'
              )}
            >
              <span className="text-xl">{info.icon}</span>
              <span className="text-sm font-medium">{info.name}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {PROVIDER_INFO[currentProvider].description}
      </p>
    </div>
  );
}
