import React, { useCallback, useMemo } from "react";
import { useAppSettingsStore, usePerformanceStore } from "../../store";
import {
  captureQuickToneSlot,
  slotIdentityEquals,
  slotShortLabel,
} from "@pianel/core/helpers/quickToneSlot";
import type { QuickToneSlot } from "@pianel/core/types/quickToneSlot";
import type { CaptureSource } from "@pianel/core/helpers/quickToneSlot";
import { useTones } from "../../hooks/useTones";
import { getPianoService } from "../../hooks/usePiano";
import { HardwareButton } from "../../components/controls/HardwareButton";
import { useLongPress } from "../../hooks/useLongPress";
import { showAlert } from "../../components/modals/AlertModal";

interface QuickToneSlotsProps {
  isLightMode: boolean;
}

export function QuickToneSlots({ isLightMode }: QuickToneSlotsProps) {
  const quickToneSlots = useAppSettingsStore((s) => s.quickToneSlots);
  const setQuickToneSlot = useAppSettingsStore((s) => s.setQuickToneSlot);

  // Pinned to 'right' purely to gain access to `findToneById`. The active-tone
  // identity check pulls live values from the performance store below so it
  // stays correct regardless of which tab is active.
  const { findToneById } = useTones('right');

  // Subscribe to each perf field individually — returning a fresh object from
  // a single selector would fail Zustand's identity check every render and
  // cause an infinite loop.
  const voiceMode = usePerformanceStore((s) => s.voiceMode);
  const activeTone = usePerformanceStore((s) => s.activeTone);
  const leftTone = usePerformanceStore((s) => s.leftTone ?? null);
  const dualTone2 = usePerformanceStore((s) => s.dualTone2 ?? null);
  const splitPoint = usePerformanceStore((s) => s.splitPoint);
  const balance = usePerformanceStore((s) => s.balance);
  const dualBalance = usePerformanceStore((s) => s.dualBalance);
  const splitLeftShift = usePerformanceStore((s) => s.splitLeftShift);
  const splitRightShift = usePerformanceStore((s) => s.splitRightShift);
  const dualT1Shift = usePerformanceStore((s) => s.dualT1Shift);
  const dualT2Shift = usePerformanceStore((s) => s.dualT2Shift);

  const perfSnapshot = useMemo<CaptureSource>(
    () => ({
      voiceMode,
      activeTone,
      leftTone,
      dualTone2,
      splitPoint,
      balance,
      dualBalance,
      splitLeftShift,
      splitRightShift,
      dualT1Shift,
      dualT2Shift,
    }),
    [
      voiceMode,
      activeTone,
      leftTone,
      dualTone2,
      splitPoint,
      balance,
      dualBalance,
      splitLeftShift,
      splitRightShift,
      dualT1Shift,
      dualT2Shift,
    ],
  );

  const handleClick = useCallback(
    (slot: QuickToneSlot | null, index: 0 | 1 | 2) => {
      if (slot === null) {
        // Capture current voicing-mode state into the slot.
        const snapshot = captureQuickToneSlot(perfSnapshot);
        // Guard: don't save an empty slot (no right tone means there's nothing
        // useful to recall).
        if (!snapshot.rightToneId) return;
        setQuickToneSlot(index, snapshot);
        return;
      }
      // Apply the captured slot.
      getPianoService()?.applyQuickToneSlot(slot);
    },
    [perfSnapshot, setQuickToneSlot],
  );

  // Shared clear-confirmation gate for both the mouse right-click and the touch
  // long-press. Clears the slot only when the dialog resolves confirmed.
  const requestClearSlot = useCallback(
    async (index: 0 | 1 | 2) => {
      // Nothing to clear on an empty slot — skip the destructive prompt.
      if (quickToneSlots[index] === null) return;
      const confirmed = await showAlert({
        variant: "error",
        title: "Clear slot?",
        message: "Clear this Quick-assign slot? This cannot be undone.",
        confirmLabel: "Clear",
        cancelLabel: "Cancel",
      });
      if (confirmed) setQuickToneSlot(index, null);
    },
    [quickToneSlots, setQuickToneSlot],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, index: 0 | 1 | 2) => {
      // Suppress the native context menu and open the confirm gate.
      e.preventDefault();
      void requestClearSlot(index);
    },
    [requestClearSlot],
  );

  const slotEntries: Array<{ slot: QuickToneSlot | null; index: 0 | 1 | 2 }> = [
    { slot: quickToneSlots[0], index: 0 },
    { slot: quickToneSlots[1], index: 1 },
    { slot: quickToneSlots[2], index: 2 },
  ];

  return (
    <div className="flex gap-3 h-20 w-full max-w-[500px]">
      {slotEntries.map(({ slot, index }) => {
        const isEmpty = slot === null;
        const isActive =
          !isEmpty && slotIdentityEquals(slot, perfSnapshot);
        const label = slot
          ? slotShortLabel(slot, (id) => findToneById(id)?.name)
          : "Empty";
        const modeBadge =
          slot && slot.voiceMode !== "single"
            ? slot.voiceMode.toUpperCase()
            : null;

        return (
          <QuickToneSlotButton
            key={index}
            index={index}
            isEmpty={isEmpty}
            onClick={() => handleClick(slot, index)}
            onContextMenu={(e) => handleContextMenu(e, index)}
            onClear={requestClearSlot}
            active={isActive}
            isLightMode={isLightMode}
            className="flex-1 h-full flex flex-col gap-1.5 relative overflow-hidden"
          >
            <div
              className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                isActive
                  ? isLightMode
                    ? "bg-orange-500 shadow-sm"
                    : "bg-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,1)]"
                  : isLightMode
                  ? isEmpty
                    ? "bg-zinc-200"
                    : "bg-zinc-300"
                  : isEmpty
                  ? "bg-zinc-800"
                  : "bg-zinc-700"
              }`}
            />
            {modeBadge && (
              <span
                className={`absolute top-1.5 left-2 text-[9px] font-bold tracking-widest ${
                  isLightMode ? "text-cyan-700" : "text-cyan-400"
                }`}
              >
                {modeBadge}
              </span>
            )}
            <span
              className={`text-base font-bold text-center px-1.5 ${
                isEmpty
                  ? isLightMode
                    ? "text-zinc-400 italic"
                    : "text-zinc-600 italic"
                  : isLightMode
                  ? "text-zinc-600"
                  : "text-zinc-300"
              }`}
            >
              {label}
            </span>
            {isEmpty && (
              <span
                className={`text-xs text-center px-1 ${
                  isLightMode ? "text-zinc-300" : "text-zinc-700"
                }`}
              >
                click to assign
              </span>
            )}
          </QuickToneSlotButton>
        );
      })}
    </div>
  );
}

interface QuickToneSlotButtonProps {
  index: 0 | 1 | 2;
  isEmpty: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClear: (index: 0 | 1 | 2) => void;
  active: boolean;
  isLightMode: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Thin per-slot wrapper that calls `useLongPress` once (hooks cannot run inside
 * the inline slot `.map`) and forwards the recognizer bindings + suppression
 * styles through the button primitive. The touch long-press converges on the
 * same `onClear` gate the mouse right-click uses.
 */
function QuickToneSlotButton({
  index,
  isEmpty,
  onClick,
  onContextMenu,
  onClear,
  active,
  isLightMode,
  className,
  children,
}: QuickToneSlotButtonProps) {
  // Keep the recognizer inert on empty slots so it neither opens the (no-op)
  // clear gate nor arms the click-suppression guard that would swallow the
  // following assign-tap.
  const longPress = useLongPress({
    enabled: !isEmpty,
    onLongPress: () => onClear(index),
  });
  return (
    <HardwareButton
      onClick={onClick}
      onContextMenu={onContextMenu}
      longPress={longPress}
      active={active}
      isLightMode={isLightMode}
      className={className}
    >
      {children}
    </HardwareButton>
  );
}
