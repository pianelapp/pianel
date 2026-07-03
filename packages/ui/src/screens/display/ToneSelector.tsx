import React, { useRef, useState, useCallback } from "react";
import Minus from "lucide-react/dist/esm/icons/minus";
import Plus from "lucide-react/dist/esm/icons/plus";
import Undo2 from "lucide-react/dist/esm/icons/undo-2";
import { useTones } from "../../hooks/useTones";
import { useFavorites } from "../../hooks/useFavorites";
import { MARQUEE_MASK_IMAGE, useMarquee } from "../../hooks/useMarquee";
import { HardwareButton } from "../../components/controls/HardwareButton";
import { ToneActionsModal } from "../../components/modals/ToneActionsModal";

interface ToneSelectorProps {
  isLightMode: boolean;
}

const LONG_PRESS_MS = 500;

export function ToneSelector({ isLightMode }: ToneSelectorProps) {
  const {
    activeTone,
    currentCategory,
    nextTone,
    prevTone,
    nextCategory,
    prevCategory,
    toneHistory,
    undo,
  } = useTones();
  // Each tone-slot (Tone 1 / Lower / Tone 2) keeps its own history, so the
  // undo arrow is available whenever the currently-edited slot has a history.
  const canUndo = toneHistory.length > 0;
  const { isFavorite, toggleFavorite } = useFavorites();

  const [actionsOpen, setActionsOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toneName = activeTone?.name ?? "No Tone";
  const categoryName = activeTone?.categoryName ?? currentCategory.name;
  const toneIsFavorite = activeTone ? isFavorite(activeTone.id) : false;

  const { trackRef, textRef, overflows, marqueeStyle } = useMarquee();

  const panelStyles = isLightMode
    ? "bg-zinc-200/80 border-zinc-300 shadow-[inset_0_3px_10px_rgba(0,0,0,0.05)]"
    : "bg-zinc-900/80 border-zinc-800/80 shadow-[inset_0_5px_25px_rgba(0,0,0,0.8)]";

  const openActions = useCallback(() => {
    if (!activeTone) return;
    setActionsOpen(true);
  }, [activeTone]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // ignore right-click here — contextmenu handler covers it
      clearLongPress();
      longPressTimerRef.current = setTimeout(openActions, LONG_PRESS_MS);
    },
    [clearLongPress, openActions],
  );

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerLeave = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      openActions();
    },
    [openActions],
  );

  const handleToggleFavorite = useCallback(() => {
    if (!activeTone) return;
    toggleFavorite(activeTone.id);
  }, [activeTone, toggleFavorite]);

  const handleSetAsDefault = useCallback(() => {
    // Placeholder — mirrors mobile (T043). Will store default tone in appSettingsStore.
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[500px]">
      {/* Category Row — compact, cyan, non-interactive panel */}
      <div className="flex items-center gap-4 w-full">
        <HardwareButton
          className="w-12 h-12 shrink-0"
          onClick={prevCategory}
          isLightMode={isLightMode}
        >
          <Minus className="w-5 h-5" />
        </HardwareButton>

        <div
          className={`relative flex-1 min-w-0 flex flex-col items-center justify-center border-2 rounded-2xl h-16 ${panelStyles}`}
        >
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">
            Category
          </span>
          <span
            className={`font-mono text-2xl leading-none font-bold tracking-wide whitespace-nowrap truncate px-4 ${
              isLightMode
                ? "text-cyan-700"
                : "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
            }`}
          >
            {categoryName}
          </span>
        </div>

        <HardwareButton
          className="w-12 h-12 shrink-0"
          onClick={nextCategory}
          isLightMode={isLightMode}
        >
          <Plus className="w-5 h-5" />
        </HardwareButton>
      </div>

      {/* Tone Row — large, orange, long-press / right-click for actions */}
      <div className="flex items-center gap-4 w-full">
        <HardwareButton
          className="w-12 h-12 shrink-0"
          onClick={prevTone}
          isLightMode={isLightMode}
        >
          <Minus className="w-5 h-5" />
        </HardwareButton>

        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
          onContextMenu={handleContextMenu}
          className={`relative flex-1 min-w-0 flex items-center justify-center border-2 rounded-2xl h-24 select-none cursor-pointer ${panelStyles}`}
        >
          <div
            ref={trackRef}
            className={`absolute inset-y-0 left-5 flex items-center overflow-hidden ${
              canUndo ? "right-12" : "right-5"
            } ${overflows ? "justify-start" : "justify-center"}`}
            style={
              overflows
                ? {
                    WebkitMaskImage: MARQUEE_MASK_IMAGE,
                    maskImage: MARQUEE_MASK_IMAGE,
                  }
                : undefined
            }
          >
            <span
              ref={textRef}
              style={marqueeStyle}
              className={`font-mono text-3xl leading-none font-bold tracking-wide whitespace-nowrap ${
                isLightMode
                  ? "text-orange-600"
                  : "text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]"
              } ${overflows ? "animate-marquee-x" : ""}`}
            >
              {toneName}
            </span>
          </div>

          {canUndo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                undo();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-3 p-2 rounded-full transition-colors hover:bg-zinc-500/20 active:bg-zinc-500/40 shrink-0"
              aria-label="Undo Tone"
            >
              <Undo2
                className={`w-5 h-5 ${
                  isLightMode
                    ? "text-cyan-700"
                    : "text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]"
                }`}
              />
            </button>
          )}
        </div>

        <HardwareButton
          className="w-12 h-12 shrink-0"
          onClick={nextTone}
          isLightMode={isLightMode}
        >
          <Plus className="w-5 h-5" />
        </HardwareButton>
      </div>

      <ToneActionsModal
        tone={activeTone}
        open={actionsOpen}
        isFavorite={toneIsFavorite}
        isLightMode={isLightMode}
        onToggleFavorite={handleToggleFavorite}
        onSetAsDefault={handleSetAsDefault}
        onClose={() => setActionsOpen(false)}
      />
    </div>
  );
}
