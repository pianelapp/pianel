import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import X from 'lucide-react/dist/esm/icons/x';
import { useBreakpoint } from '../../hooks/useBreakpoint';

interface SettingsPanelProps {
  title: string;
  widthClass: string;
  isLightMode: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function SettingsPanel({
  title,
  widthClass,
  isLightMode,
  onClose,
  children,
}: SettingsPanelProps) {
  const { viewport } = useBreakpoint();
  const isSheet = viewport === 'mobile';

  const overlayClass = isLightMode
    ? 'bg-black/30 backdrop-blur-sm'
    : 'bg-black/60 backdrop-blur-sm';
  const contentClass = isLightMode
    ? 'bg-white border-zinc-200 text-zinc-800'
    : 'bg-zinc-900 border-zinc-800 text-zinc-200';
  const headerBgClass = isLightMode ? 'bg-zinc-50/80' : 'bg-zinc-950/80';
  const dividerClass = isLightMode ? 'border-zinc-200' : 'border-zinc-800';
  const titleClass = isLightMode ? 'text-zinc-700' : 'text-zinc-300';
  const iconClass = isLightMode ? 'text-zinc-500' : 'text-zinc-300';

  const shapeClass = isSheet
    ? 'fixed inset-0 w-full h-full rounded-none'
    : `relative ${widthClass} max-w-[calc(100vw-2rem)] max-h-[85vh] rounded-3xl`;

  return (
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open) onClose();
      }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClass}`}>
          <Dialog.Content
            data-settings-panel
            data-panel-mode={isSheet ? 'sheet' : 'floating'}
            aria-describedby={undefined}
            className={`shadow-2xl border flex flex-col overflow-hidden transition-colors ${shapeClass} ${contentClass}`}>
            <div
              className={`flex items-center justify-between gap-3 px-5 py-3 border-b shrink-0 ${headerBgClass} ${dividerClass}`}>
              <Dialog.Title
                className={`text-sm font-bold tracking-widest uppercase truncate ${titleClass}`}>
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  data-panel-close
                  aria-label="Close"
                  className="tap-target shrink-0 rounded-full hover:bg-zinc-500/20 transition-colors">
                  <X className={`w-4 h-4 ${iconClass}`} />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
              {children}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
