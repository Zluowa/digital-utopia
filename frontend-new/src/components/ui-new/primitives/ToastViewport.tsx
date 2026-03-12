// @input: ToastContext — toasts array + dismissToast
// @output: Fixed bottom-left toast stack with slide-in animation
// @position: App shell — rendered once in SharedAppLayout

import { useEffect, useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useToast, type ToastItem, type ToastTone } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

const TONE_CLASSES: Record<ToastTone, string> = {
  info: 'border-sky-500/30 bg-sky-950/80 text-sky-100',
  success: 'border-emerald-500/30 bg-emerald-950/80 text-emerald-100',
  warn: 'border-amber-500/30 bg-amber-950/80 text-amber-100',
  error: 'border-red-500/30 bg-red-950/80 text-red-100',
};

const TONE_DOT: Record<ToastTone, string> = {
  info: 'bg-sky-400',
  success: 'bg-emerald-400',
  warn: 'bg-amber-400',
  error: 'bg-red-400',
};

function AnimatedToast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <li
      className={cn(
        'pointer-events-auto rounded border shadow-lg backdrop-blur-xl',
        'transition-[transform,opacity] duration-200 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        TONE_CLASSES[toast.tone]
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[toast.tone])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5">{toast.title}</p>
          {toast.body && (
            <p className="mt-0.5 text-xs leading-4 opacity-70">{toast.body}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="关闭通知"
          onClick={() => onDismiss(toast.id)}
          className="mt-0.5 shrink-0 rounded p-0.5 opacity-50 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </li>
  );
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-3 left-3 z-[120] w-full max-w-xs"
    >
      <ol className="flex flex-col-reverse gap-2">
        {toasts.map((toast) => (
          <AnimatedToast key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </ol>
    </aside>
  );
}
