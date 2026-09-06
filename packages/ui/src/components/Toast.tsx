import { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

export const TOAST_DURATION_MS = 5000;

let _show: ((text: string) => void) | null = null;

export function showToast(text: string): void {
  _show?.(text);
}

interface ToastProps {
  isLightMode: boolean;
}

export function Toast({ isLightMode }: ToastProps) {
  const [text, setText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    _show = (next: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setText(next);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setText('');
      }, TOAST_DURATION_MS);
    };
    return () => {
      _show = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const cardClass = isLightMode
    ? 'bg-white text-zinc-800 border-zinc-200'
    : 'bg-zinc-900 text-zinc-100 border-zinc-800';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="toast"
      className="fixed inset-x-0 bottom-16 z-50 flex justify-center pointer-events-none px-4"
    >
      {text && (
        <span
          key={text}
          className={`max-w-[90vw] rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-2xl ${cardClass} ${
            reduceMotion ? '' : 'animate-toast-in'
          }`}
        >
          {text}
        </span>
      )}
    </div>
  );
}
