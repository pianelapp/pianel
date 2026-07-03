import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import X from 'lucide-react/dist/esm/icons/x';
import Star from 'lucide-react/dist/esm/icons/star';
import { useTones } from '../../hooks/useTones';
import { useFavorites } from '../../hooks/useFavorites';
import type { ToneCategory } from '@pianel/core/types/types';

interface CategoryPickerModalProps {
  open: boolean;
  onClose: () => void;
  isLightMode: boolean;
}

export function CategoryPickerModal({ open, onClose, isLightMode }: CategoryPickerModalProps) {
  const { categories, activeTone, selectTone } = useTones();
  const { isFavorite } = useFavorites();

  const initialCategory: ToneCategory = categories.find(c => c.id === activeTone?.category) ?? categories[0] ?? { id: 0, name: 'Piano', tones: [] };
  const [selectedCategory, setSelectedCategory] = useState<ToneCategory>(initialCategory);

  const overlayClass = isLightMode
    ? 'bg-black/30 backdrop-blur-sm'
    : 'bg-black/60 backdrop-blur-sm';

  const contentClass = isLightMode
    ? 'bg-white/95 border-zinc-200 text-zinc-800'
    : 'bg-zinc-900/95 border-zinc-800 text-zinc-200';

  const categoryItemBase = 'w-full text-left px-3 py-2 rounded-lg text-xs font-mono tracking-wide transition-all border';
  const categoryItemActive = isLightMode
    ? 'bg-cyan-50 border-cyan-200 text-cyan-700'
    : 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300';
  const categoryItemInactive = isLightMode
    ? 'border-transparent hover:bg-zinc-100 text-zinc-700'
    : 'border-transparent hover:bg-zinc-800/40 text-zinc-300';

  const toneItemBase = 'w-full flex items-center justify-between p-2 rounded-lg transition-all border';
  const toneItemActive = isLightMode
    ? 'bg-orange-50 border-orange-200'
    : 'bg-orange-500/10 border-orange-900/50';
  const toneItemInactive = isLightMode
    ? 'border-transparent hover:bg-zinc-100'
    : 'border-transparent hover:bg-zinc-800/40';

  const dividerClass = isLightMode ? 'border-zinc-200' : 'border-zinc-800';
  const headerBgClass = isLightMode ? 'bg-zinc-50/80' : 'bg-zinc-950/80';
  const scrollbarClass = 'custom-scrollbar';

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`fixed inset-0 z-50 flex items-center justify-center ${overlayClass}`}>
          <Dialog.Content
            className={`relative w-[680px] h-[480px] rounded-3xl shadow-2xl border flex flex-col overflow-hidden transition-colors ${contentClass}`}
            aria-label="Category and Tone Picker"
          >
            <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${headerBgClass} ${dividerClass}`}>
              <Dialog.Title className={`text-sm font-bold tracking-widest uppercase ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
                Select Tone
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

            <div className="flex flex-1 min-h-0">
              <div className={`w-[180px] shrink-0 flex flex-col border-r ${dividerClass}`}>
                <span className={`block text-[9px] font-bold tracking-widest uppercase px-3 pt-3 pb-1.5 ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Categories
                </span>
                <div className={`flex-1 overflow-y-auto px-2 pb-3 ${scrollbarClass}`}>
                  <div className="flex flex-col gap-0.5">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat)}
                        className={`${categoryItemBase} ${selectedCategory.id === cat.id ? categoryItemActive : categoryItemInactive}`}
                      >
                        <span className="block truncate">{cat.name}</span>
                        <span className={`text-[9px] mt-0.5 block ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {cat.tones.length} tones
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col">
                <span className={`block text-[9px] font-bold tracking-widest uppercase px-4 pt-3 pb-1.5 ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {selectedCategory.name} ({selectedCategory.tones.length})
                </span>
                <div className={`flex-1 overflow-y-auto px-3 pb-3 ${scrollbarClass}`}>
                  <div className="flex flex-col gap-0.5">
                    {selectedCategory.tones.map(tone => {
                      const isActive = activeTone?.id === tone.id;
                      const isFav = isFavorite(tone.id);
                      return (
                        <button
                          key={tone.id}
                          onClick={() => { selectTone(tone); onClose(); }}
                          className={`${toneItemBase} ${isActive ? toneItemActive : toneItemInactive}`}
                        >
                          <div className="flex flex-col items-start min-w-0">
                            <span
                              className={`font-mono text-xs tracking-wide font-bold truncate ${
                                isActive
                                  ? isLightMode
                                    ? 'text-orange-600'
                                    : 'text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]'
                                  : isLightMode
                                  ? 'text-zinc-700'
                                  : 'text-zinc-300'
                              }`}
                            >
                              {tone.name}
                            </span>
                            <span className={`text-[9px] font-mono mt-0.5 ${isActive ? (isLightMode ? 'text-orange-400' : 'text-orange-600/70') : (isLightMode ? 'text-zinc-400' : 'text-zinc-600')}`}>
                              {tone.isGM2 ? 'GM2' : 'SN'}
                            </span>
                          </div>
                          {isFav && (
                            <Star
                              className={`w-3 h-3 shrink-0 ml-2 ${isLightMode ? 'text-orange-400' : 'text-orange-500'}`}
                              fill="currentColor"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
