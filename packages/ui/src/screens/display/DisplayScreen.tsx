import React, { useState } from 'react';
import { ToneSelector } from './ToneSelector';
import { ToneSlotTabs } from './ToneSlotTabs';
import { ChordDisplay } from './ChordDisplay';
import { QuickToneSlots } from './QuickToneSlots';
import { CaptureBar } from './CaptureBar';
import { VoicingOptionsModal } from '../../components/modals/VoicingOptionsModal';
import { useVoicingMode } from '../../hooks/useVoicingMode';
import { useSongs } from '../../hooks/useSongs';

interface DisplayScreenProps {
  isLightMode: boolean;
  armedSongId: string | null;
  onArm: (songId: string | null) => void;
  compact?: boolean;
}

export function DisplayScreen({
  isLightMode,
  armedSongId,
  onArm,
  compact = false,
}: DisplayScreenProps) {
  const { mode, activeSlot, setActiveSlot } = useVoicingMode();
  const { songs, captureScene } = useSongs();
  const [optionsOpen, setOptionsOpen] = useState(false);

  const armedSong = armedSongId
    ? (songs.find(s => s.id === armedSongId) ?? null)
    : null;

  return (
    <div className="w-full h-full flex flex-col">
      {armedSong && (
        <CaptureBar
          song={armedSong}
          isLightMode={isLightMode}
          compact={compact}
          onCapture={() => captureScene(armedSong.id)}
          onDone={() => onArm(null)}
        />
      )}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="min-h-full flex flex-col items-center justify-center px-8 gap-5 py-2">
          <ToneSlotTabs
            mode={mode}
            activeSlot={activeSlot}
            onChangeSlot={setActiveSlot}
            onOpenOptions={() => setOptionsOpen(true)}
            isLightMode={isLightMode}
          />
          <ToneSelector isLightMode={isLightMode} />
          <ChordDisplay isLightMode={isLightMode} />
          <QuickToneSlots isLightMode={isLightMode} />

          <VoicingOptionsModal
            open={optionsOpen}
            onClose={() => setOptionsOpen(false)}
            isLightMode={isLightMode}
            mode={mode}
          />
        </div>
      </div>
    </div>
  );
}
