import { useMemo, useState } from 'react';
import Unplug from 'lucide-react/dist/esm/icons/unplug';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { usePerformCursor } from '../../hooks/usePerformCursor';
import { useSetlists } from '../../hooks/useSetlists';
import { useSongs } from '../../hooks/useSongs';
import { useConnection } from '../../hooks/useConnection';
import { usePerformanceStore } from '../../store';
import { statusBadgeClass } from '../../helpers/sceneBadge';
import { StatusBar } from '../display/StatusBar';
import { AdvanceButton } from './AdvanceButton';
import { CurrentScene } from './CurrentScene';
import { SceneRail } from './SceneRail';
import { SongPicker, type SongPickerEntry } from './SongPicker';
import { slotIdentityEquals } from '@pianel/core/helpers/quickToneSlot';
import type { CaptureSource } from '@pianel/core/helpers/quickToneSlot';

interface PerformModeProps {
  isLightMode: boolean;
}

export function PerformMode({ isLightMode }: PerformModeProps) {
  const cursor = usePerformCursor();
  const { isCustomized, setlists, resolveEntry } = useSetlists();
  const { songs } = useSongs();
  const tier = useBreakpoint();
  const connection = useConnection();
  const [pickerOpen, setPickerOpen] = useState(false);

  const voiceMode = usePerformanceStore(s => s.voiceMode);
  const activeTone = usePerformanceStore(s => s.activeTone);
  const leftTone = usePerformanceStore(s => s.leftTone ?? null);
  const dualTone2 = usePerformanceStore(s => s.dualTone2 ?? null);
  const splitPoint = usePerformanceStore(s => s.splitPoint);
  const balance = usePerformanceStore(s => s.balance);
  const dualBalance = usePerformanceStore(s => s.dualBalance);
  const splitLeftShift = usePerformanceStore(s => s.splitLeftShift);
  const splitRightShift = usePerformanceStore(s => s.splitRightShift);
  const dualT1Shift = usePerformanceStore(s => s.dualT1Shift);
  const dualT2Shift = usePerformanceStore(s => s.dualT2Shift);

  const captureSource = useMemo<CaptureSource>(
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

  const setlist =
    cursor.setlistId !== null
      ? (setlists.find(s => s.id === cursor.setlistId) ?? null)
      : null;

  const pickerEntries = useMemo<SongPickerEntry[]>(() => {
    if (!setlist) return [];
    return setlist.entries.map((_, index) => {
      const resolved = resolveEntry(setlist.id, index);
      return {
        name: resolved?.name ?? 'Missing song',
        sceneCount: resolved?.scenes.length ?? 0,
        isCustomized: isCustomized(setlist.id, index),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setlist, resolveEntry, isCustomized, songs]);

  if (!cursor.isPerforming || !cursor.song) return null;

  const stacked = tier.viewport === 'mobile';
  const total = cursor.song.scenes.length;
  const setlistId = cursor.setlistId;
  const customized = setlistId !== null && isCustomized(setlistId, cursor.entryIndex);
  const isModified = cursor.scene
    ? !slotIdentityEquals(cursor.scene.snapshot.voiceModeSnapshot, captureSource)
    : false;
  const showDisconnectedBanner = connection.status !== 'connected';
  const canGoBack = cursor.sceneIndex > 0 || cursor.hasPrevSong;

  const handleAdvance = () => {
    if (cursor.nextTarget.kind === 'scene') void cursor.nextScene();
    if (cursor.nextTarget.kind === 'song') void cursor.nextSong();
  };

  const handlePrev = () => {
    if (cursor.sceneIndex > 0) {
      void cursor.prevScene().catch(() => {});
    } else if (cursor.entryIndex > 0) {
      void cursor.prevSong().catch(() => {});
    }
  };

  const handleJumpScene = (index: number) => {
    void cursor.jumpToScene(index);
  };

  const handleJumpSong = (index: number) => {
    void cursor.jumpToSong(index);
    setPickerOpen(false);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${
        isLightMode ? 'bg-slate-100' : 'bg-zinc-950'
      }`}>
      {showDisconnectedBanner && (
        <div
          data-connection-banner
          className={`shrink-0 flex items-center justify-center gap-2 py-1.5 text-xs font-bold tracking-widest text-white ${
            isLightMode ? 'bg-red-500' : 'bg-red-600'
          }`}>
          <Unplug className="w-3.5 h-3.5" />
          PIANO DISCONNECTED
        </div>
      )}

      <div
        data-perform-header
        className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
          isLightMode
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900 border-zinc-800'
        }`}>
        <div className="flex items-center gap-2 min-w-0">
          {setlistId !== null ? (
            <button
              type="button"
              data-song-title
              onClick={() => setPickerOpen(true)}
              className={`truncate text-base font-extrabold uppercase tracking-widest transition-opacity hover:opacity-80 ${
                isLightMode ? 'text-zinc-800' : 'text-zinc-200'
              }`}>
              {cursor.song.name}
            </button>
          ) : (
            <span
              className={`truncate text-base font-extrabold uppercase tracking-widest ${
                isLightMode ? 'text-zinc-800' : 'text-zinc-200'
              }`}>
              {cursor.song.name}
            </span>
          )}
          {customized && (
            <span
              data-song-edited
              className={`shrink-0 ${statusBadgeClass('amber', isLightMode, true)}`}>
              edited
            </span>
          )}
        </div>

        <span
          className={`shrink-0 font-mono text-sm font-bold tracking-wider ${
            isLightMode ? 'text-zinc-400' : 'text-zinc-600'
          }`}>
          {stacked
            ? `${cursor.sceneIndex + 1}/${total}`
            : `SCENE ${cursor.sceneIndex + 1} / ${total}`}
        </span>

        <button
          type="button"
          onClick={cursor.exit}
          className={`shrink-0 text-xs font-bold tracking-widest border rounded-md px-2.5 py-1 transition-colors ${
            isLightMode
              ? 'text-zinc-500 border-zinc-300 hover:text-zinc-800 hover:bg-zinc-100'
              : 'text-zinc-500 border-zinc-700 hover:text-zinc-100 hover:bg-zinc-800'
          }`}>
          EXIT
        </button>
      </div>

      {stacked ? (
        <div data-layout="stacked" className="flex-1 min-h-0 flex flex-col">
          {cursor.scene && (
            <div
              data-scrolls
              className={`min-h-0 overflow-y-auto custom-scrollbar border-b ${
                isLightMode ? 'border-zinc-200' : 'border-zinc-800'
              }`}>
              <CurrentScene
                scene={cursor.scene}
                isLightMode={isLightMode}
                stacked
                isModified={isModified}
              />
            </div>
          )}
          <SceneRail
            scenes={cursor.song.scenes}
            currentIndex={cursor.sceneIndex}
            isLightMode={isLightMode}
            onJump={handleJumpScene}
          />
          <AdvanceButton
            target={cursor.nextTarget}
            isLightMode={isLightMode}
            stacked
            onAdvance={handleAdvance}
            onPrev={handlePrev}
            canGoBack={canGoBack}
          />
          <StatusBar isLightMode={isLightMode} compact />
        </div>
      ) : (
        <>
          <div data-layout="columns" className="flex-1 min-h-0 flex">
            <div
              className={`w-[32%] min-h-0 flex flex-col border-r ${
                isLightMode ? 'border-zinc-200' : 'border-zinc-800'
              }`}>
              <SceneRail
                scenes={cursor.song.scenes}
                currentIndex={cursor.sceneIndex}
                isLightMode={isLightMode}
                onJump={handleJumpScene}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <div data-scrolls className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {cursor.scene && (
                  <CurrentScene
                    scene={cursor.scene}
                    isLightMode={isLightMode}
                    stacked={false}
                    isModified={isModified}
                  />
                )}
              </div>
              <AdvanceButton
                target={cursor.nextTarget}
                isLightMode={isLightMode}
                stacked={false}
                onAdvance={handleAdvance}
                onPrev={handlePrev}
                canGoBack={canGoBack}
              />
            </div>
          </div>
          <StatusBar isLightMode={isLightMode} compact={false} />
        </>
      )}

      {pickerOpen && setlistId !== null && setlist && (
        <SongPicker
          setlistName={setlist.name}
          entries={pickerEntries}
          entryIndex={cursor.entryIndex}
          sceneIndex={cursor.sceneIndex}
          isLightMode={isLightMode}
          onJump={handleJumpSong}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
