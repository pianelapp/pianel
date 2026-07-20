import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import LibraryBig from 'lucide-react/dist/esm/icons/library-big';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import Star from 'lucide-react/dist/esm/icons/star';
import { useTones } from '../hooks/useTones';
import { useFavorites } from '../hooks/useFavorites';
import type { Tone } from '@pianel/core/types/types';

interface LibrarySidebarProps {
  isLightMode: boolean;
  className?: string;
  onAfterSelect?: () => void;
}

const FAVORITES_IDX = -1;

export function LibrarySidebar({
  isLightMode,
  className,
  onAfterSelect,
}: LibrarySidebarProps) {
  const {
    slot,
    categories,
    activeTone,
    selectTone,
    searchByName,
    categoryIndex,
    setCategoryIndex,
  } = useTones();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesSelected, setFavoritesSelected] = useState(false);
  const tonesScrollRef = useRef<HTMLDivElement>(null);

  const selectedCategoryIdx = useMemo(() => {
    if (categories.length === 0) return 0;
    return Math.max(0, Math.min(categoryIndex, categories.length - 1));
  }, [categoryIndex, categories.length]);

  const selectedCategory = categories[selectedCategoryIdx];

  useEffect(() => {
    tonesScrollRef.current?.scrollTo({ top: 0 });
    // `slot` triggers a scroll-reset when the user switches Tone 1 ↔ Tone 2,
    // since the right column repopulates with the other slot's category.
  }, [selectedCategoryIdx, favoritesSelected, slot]);

  const searchResults = useMemo((): Tone[] => {
    if (!searchQuery.trim()) return [];
    return searchByName(searchQuery);
  }, [searchQuery, searchByName]);

  const isSearching = searchQuery.trim().length > 0;

  const handleCategoryClick = useCallback(
    (idx: number) => {
      setFavoritesSelected(false);
      setCategoryIndex(idx);
    },
    [setCategoryIndex],
  );

  const handleFavoritesClick = useCallback(() => {
    setFavoritesSelected(true);
  }, []);

  const handleToneClick = useCallback(
    (tone: Tone) => {
      selectTone(tone);
      onAfterSelect?.();
    },
    [selectTone, onAfterSelect],
  );

  const handleStarClick = useCallback(
    (e: React.MouseEvent, toneId: string) => {
      e.stopPropagation();
      toggleFavorite(toneId);
    },
    [toggleFavorite],
  );

  const containerClass = isLightMode
    ? 'bg-zinc-50 border-zinc-200 shadow-[2px_0_10px_rgba(0,0,0,0.02)]'
    : 'bg-zinc-950 border-zinc-800 shadow-[2px_0_15px_rgba(0,0,0,0.4)]';

  const dividerClass = isLightMode ? 'border-zinc-200' : 'border-zinc-800';

  const categoryItemBase =
    'w-full text-left px-3 py-2 rounded-lg transition-all border';
  const categoryItemActive = isLightMode
    ? 'bg-cyan-50 border-cyan-200 text-cyan-700'
    : 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300';
  const categoryItemInactive = isLightMode
    ? 'border-transparent hover:bg-zinc-100 text-zinc-700'
    : 'border-transparent hover:bg-zinc-800/40 text-zinc-300';

  const toneItemBase =
    'w-full flex items-center justify-between p-2 rounded-lg transition-all border';
  const toneItemActive = isLightMode
    ? 'bg-orange-50 border-orange-200'
    : 'bg-orange-500/10 border-orange-900/50';
  const toneItemInactive = isLightMode
    ? 'border-transparent hover:bg-zinc-100'
    : 'border-transparent hover:bg-zinc-800/40';

  const sectionHeaderClass = `block text-xs font-bold tracking-widest uppercase px-3 pt-3 pb-1.5 ${
    isLightMode ? 'text-zinc-400' : 'text-zinc-600'
  }`;

  const renderToneRow = (tone: Tone, options?: { showCategory?: boolean }) => {
    const isActive = activeTone?.id === tone.id;
    const isFav = isFavorite(tone.id);
    const subtitleSegments: string[] = [];
    if (options?.showCategory) subtitleSegments.push(tone.categoryName);
    subtitleSegments.push(tone.isGM2 ? 'GM2' : 'SN');
    const starActiveColor = isLightMode ? 'text-orange-400' : 'text-orange-500';
    const starInactiveColor = isLightMode
      ? 'text-zinc-300 hover:text-orange-400'
      : 'text-zinc-700 hover:text-orange-500';
    return (
      <div
        key={tone.id}
        className={`${toneItemBase} ${isActive ? toneItemActive : toneItemInactive}`}>
        <button
          onClick={() => handleToneClick(tone)}
          aria-pressed={isActive}
          className="flex flex-col items-start min-w-0 flex-1 text-left">
          <span
            className={`text-lg tracking-wide font-bold truncate ${
              isActive
                ? isLightMode
                  ? 'text-orange-600'
                  : 'text-orange-500 drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]'
                : isLightMode
                  ? 'text-zinc-700'
                  : 'text-zinc-300'
            }`}>
            {tone.name}
          </span>
          <span
            className={`text-sm mt-0.5 ${
              isActive
                ? isLightMode
                  ? 'text-orange-400'
                  : 'text-orange-600/70'
                : isLightMode
                  ? 'text-zinc-400'
                  : 'text-zinc-600'
            }`}>
            {subtitleSegments.join(' · ')}
          </span>
        </button>
        <button
          onClick={e => handleStarClick(e, tone.id)}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFav}
          className="p-1 rounded-full transition-colors hover:bg-zinc-500/10 shrink-0 ml-2">
          <Star
            className={`w-4 h-4 transition-colors ${isFav ? starActiveColor : starInactiveColor}`}
            fill={isFav ? 'currentColor' : 'none'}
          />
        </button>
      </div>
    );
  };

  const rightColumnLabel = favoritesSelected
    ? `Favorites (${favorites.length})`
    : selectedCategory
      ? `${selectedCategory.name} (${selectedCategory.tones.length})`
      : '— (0)';

  const rightColumnTones = favoritesSelected
    ? favorites
    : (selectedCategory?.tones ?? []);

  const rightColumnEmptyText = favoritesSelected
    ? 'No favorites yet. Tap the star on a tone to add it.'
    : 'No tones in this category';

  return (
    <div
      className={`h-full flex flex-col border-r transition-colors z-10 ${containerClass} ${className ?? 'w-[30vw] shrink-0'}`}>
      {/* Header + search */}
      <div className="p-4 pb-2 shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <LibraryBig
            className={`w-6 h-6 ${isLightMode ? 'text-[#519B9F]' : 'text-cyan-500'}`}
          />
          <h2
            className={`text-2xl font-bold tracking-wide ${
              isLightMode ? 'text-zinc-800' : 'text-zinc-100'
            }`}>
            Library
          </h2>
        </div>

        <div className="relative">
          <Search
            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              isLightMode ? 'text-zinc-400' : 'text-zinc-500'
            }`}
          />
          <input
            type="text"
            placeholder="Search tones..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-9 py-2 text-lg rounded-md outline-none transition-all ${
              isLightMode
                ? 'bg-zinc-200/50 border border-zinc-300 text-zinc-800 placeholder-zinc-500 focus:border-[#519B9F] focus:ring-1 focus:ring-[#519B9F]/20'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)] focus:border-cyan-700'
            }`}
          />
          {searchQuery.length > 0 && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors hover:bg-zinc-500/20 ${
                isLightMode
                  ? 'text-zinc-400 hover:text-zinc-600'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Body: two columns when idle, single column when searching */}
      {isSearching ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <span className={sectionHeaderClass}>
            Search Results ({searchResults.length})
          </span>
          <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
            {searchResults.length === 0 ? (
              <span
                className={`block text-base px-1 py-2 ${
                  isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                No tones match &ldquo;{searchQuery}&rdquo;
              </span>
            ) : (
              <div className="flex flex-col gap-0.5">
                {searchResults.map(t =>
                  renderToneRow(t, { showCategory: true }),
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex">
          {/* Categories column (with Favorites pinned at top) */}
          <div
            className={`shrink-0 basis-[45%] min-w-[110px] flex flex-col border-r ${dividerClass}`}>
            <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
              <div className="flex flex-col gap-0.5">
                <button
                  key={FAVORITES_IDX}
                  onClick={handleFavoritesClick}
                  aria-pressed={favoritesSelected}
                  className={`${categoryItemBase} ${favoritesSelected ? categoryItemActive : categoryItemInactive}`}>
                  <span className="flex items-center gap-2 text-lg font-bold tracking-wide truncate">
                    <Star
                      className={`w-4 h-4 shrink-0 ${
                        favoritesSelected
                          ? isLightMode
                            ? 'text-orange-500'
                            : 'text-orange-400'
                          : isLightMode
                            ? 'text-zinc-400'
                            : 'text-zinc-500'
                      }`}
                      fill="currentColor"
                    />
                    Favorites
                  </span>
                  <span
                    className={`text-sm mt-0.5 block ${
                      isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                    {favorites.length}{' '}
                    {favorites.length === 1 ? 'tone' : 'tones'}
                  </span>
                </button>
                {categories.map((cat, idx) => {
                  const isActive =
                    !favoritesSelected && idx === selectedCategoryIdx;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(idx)}
                      aria-pressed={isActive}
                      className={`${categoryItemBase} ${isActive ? categoryItemActive : categoryItemInactive}`}>
                      <span className="block text-lg font-bold tracking-wide truncate">
                        {cat.name}
                      </span>
                      <span
                        className={`text-sm mt-0.5 block ${
                          isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                        }`}>
                        {cat.tones.length} tones
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tones column */}
          <div className="flex-1 min-w-0 flex flex-col">
            <span className={sectionHeaderClass}>{rightColumnLabel}</span>
            <div
              ref={tonesScrollRef}
              className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
              {rightColumnTones.length === 0 ? (
                <span
                  className={`block text-base px-1 py-2 ${
                    isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                  {rightColumnEmptyText}
                </span>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {rightColumnTones.map(t =>
                    renderToneRow(t, { showCategory: favoritesSelected }),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
