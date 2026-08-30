import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import X from 'lucide-react/dist/esm/icons/x';
import { KEY_TOUCH_OPTIONS } from '@pianel/core/helpers/keyTouch';
import { usePiano } from '../../hooks/usePiano';

interface KeyTouchModalProps {
  open: boolean;
  onClose: () => void;
  isLightMode: boolean;
}

export function KeyTouchModal({ open, onClose, isLightMode }: KeyTouchModalProps) {
  const { keyTouch, changeKeyTouch } = usePiano();

  const overlayClass = isLightMode
    ? 'bg-black/30 backdrop-blur-sm'
    : 'bg-black/60 backdrop-blur-sm';

  const contentClass = isLightMode
    ? 'bg-white/95 border-zinc-200 text-zinc-800'
    : 'bg-zinc-900/95 border-zinc-800 text-zinc-200';

  const dividerClass = isLightMode ? 'border-zinc-200' : 'border-zinc-800';
  const headerBgClass = isLightMode ? 'bg-zinc-50/80' : 'bg-zinc-950/80';

  const rowBase =
    'w-full px-4 py-3 rounded-lg border transition-colors flex items-baseline gap-3 text-left';
  const rowInactive = isLightMode
    ? 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700'
    : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800 text-zinc-200';
  const rowActive = isLightMode
    ? 'bg-cyan-50 border-cyan-500 text-cyan-700'
    : 'bg-cyan-900/30 border-cyan-500 text-cyan-300';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClass}`}>
          <Dialog.Content
            className={`relative w-[420px] max-w-[92vw] max-h-[85vh] rounded-2xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${contentClass}`}
            aria-label="Key Touch"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${headerBgClass} ${dividerClass}`}>
              <Dialog.Title className={`text-sm font-bold tracking-widest uppercase ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
                Key Touch
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-zinc-500/20 transition-colors"
                  aria-label="Close"
                >
                  <X className={`w-4 h-4 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`} />
                </button>
              </Dialog.Close>
            </div>

            <div className="px-6 py-5 overflow-y-auto custom-scrollbar flex flex-col gap-2">
              {KEY_TOUCH_OPTIONS.map((option) => {
                const isSelected = option.value === keyTouch;
                return (
                  <button
                    key={option.value}
                    onClick={() => changeKeyTouch(option.value)}
                    className={`${rowBase} ${isSelected ? rowActive : rowInactive}`}
                    aria-pressed={isSelected}
                  >
                    <span className={`font-mono text-sm ${isSelected ? 'font-bold' : ''}`}>
                      {option.label}
                    </span>
                    <span
                      className={`text-[11px] ml-auto ${
                        isSelected
                          ? 'opacity-80'
                          : isLightMode
                            ? 'text-zinc-400'
                            : 'text-zinc-500'
                      }`}
                    >
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
