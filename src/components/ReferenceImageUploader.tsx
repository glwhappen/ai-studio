'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ImageUp, X, Image as ImageIcon } from 'lucide-react';

interface ReferenceImageUploaderProps {
  value: string | null;
  onChange: (base64: string | null, mimeType: string | null) => void;
  disabled?: boolean;
}

export function ReferenceImageUploader({ value, onChange, disabled }: ReferenceImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // data:image/png;base64,xxxxx
      const matches = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (matches) {
        onChange(matches[2], matches[1]); // base64 data, mime type
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = () => {
    onChange(null, null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative inline-block">
          <img
            src={`data:image/*;base64,${value}`}
            alt="参考图片"
            className="max-h-32 rounded-lg border shadow-sm"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleRemove}
            disabled={disabled}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Card
          className={`border-dashed cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <div className="rounded-full bg-muted p-2 mb-2">
              <ImageUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              拖拽或点击上传参考图片
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              支持图生图（编辑模式）
            </p>
          </div>
        </Card>
      )}
      
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
    </div>
  );
}
