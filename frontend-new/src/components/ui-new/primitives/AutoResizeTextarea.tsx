// @input: value, onChange, onKeyDown 等基础 textarea props
// @output: 自动高度调整的 textarea 组件（forwardRef）
// @position: 输入框基础组件，用于聊天输入框等场景

import { forwardRef, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  preventNewlines?: boolean;
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, onChange, onKeyDown, placeholder, rows = 1, disabled, className, preventNewlines = true }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;

    const resize = useCallback(() => {
      const el = typeof textareaRef === 'object' ? textareaRef?.current : null;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [textareaRef]);

    useEffect(() => { resize(); }, [value, resize]);

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          const val = preventNewlines ? e.target.value.replace(/\n/g, '') : e.target.value;
          onChange(val);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={cn('resize-none overflow-hidden bg-transparent outline-none', className)}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
