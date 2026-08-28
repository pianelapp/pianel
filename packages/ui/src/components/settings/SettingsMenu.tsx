import * as Dialog from '@radix-ui/react-dialog';
import X from 'lucide-react/dist/esm/icons/x';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right';
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from './categories';

interface SettingsMenuProps {
  isLightMode: boolean;
  onSelect: (id: SettingsCategoryId) => void;
  onClose: () => void;
}

export function SettingsMenu({
  isLightMode,
  onSelect,
  onClose,
}: SettingsMenuProps) {
  const overlayClass = isLightMode
    ? 'bg-black/30 backdrop-blur-sm'
    : 'bg-black/60 backdrop-blur-sm';
  const contentClass = isLightMode
    ? 'bg-white border-zinc-200'
    : 'bg-zinc-900 border-zinc-800';
  const titleClass = isLightMode ? 'text-zinc-800' : 'text-zinc-100';
  const labelClass = isLightMode ? 'text-zinc-700' : 'text-zinc-300';
  const glyphClass = isLightMode ? 'text-zinc-600' : 'text-zinc-400';
  const rowClass = isLightMode ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800/40';

  return (
    <Dialog.Root
      open
      onOpenChange={next => {
        if (!next) onClose();
      }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClass}`}>
          <Dialog.Content
            data-settings-menu
            aria-describedby={undefined}
            className={`relative w-[300px] max-w-[calc(100vw-2rem)] p-2 rounded-2xl shadow-2xl border transition-colors ${contentClass}`}>
            <div className="flex items-center justify-between pl-3 pr-1 py-1">
              <Dialog.Title
                className={`text-sm font-bold tracking-wide ${titleClass}`}>
                Settings
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  data-settings-menu-close
                  aria-label="Close"
                  className="tap-target rounded-full hover:bg-zinc-500/20 transition-colors">
                  <X className={`w-5 h-5 ${glyphClass}`} />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex flex-col gap-0.5">
              {SETTINGS_CATEGORIES.map(category => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    type="button"
                    data-settings-category={category.id}
                    onClick={() => onSelect(category.id)}
                    className={`tap-target w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${rowClass}`}>
                    <Icon className={`w-5 h-5 shrink-0 ${glyphClass}`} />
                    <span
                      className={`flex-1 min-w-0 truncate text-sm font-medium ${labelClass}`}>
                      {category.label}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${glyphClass}`}
                    />
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
