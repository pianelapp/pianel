import React, { useState } from 'react';
import { ToneSelector } from './ToneSelector';
import { ToneSlotTabs } from './ToneSlotTabs';
import { ChordDisplay } from './ChordDisplay';
import { QuickToneSlots } from './QuickToneSlots';
import { VoicingOptionsModal } from '../../components/modals/VoicingOptionsModal';
import { useVoicingMode } from '../../hooks/useVoicingMode';

interface DisplayScreenProps {
  isLightMode: boolean;
}

export function DisplayScreen({ isLightMode }: DisplayScreenProps) {
  const { mode, activeSlot, setActiveSlot } = useVoicingMode();
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8 gap-5 pb-2">
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
  );
}
