import { useId, useState } from 'react';
import Music from 'lucide-react/dist/esm/icons/music-3';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2';
import Headphones from 'lucide-react/dist/esm/icons/headphones';
import Hand from 'lucide-react/dist/esm/icons/hand';
import {
  keyTouchLabel,
  keyTouchShortLabel,
} from '@pianel/core/helpers/keyTouch';
import { usePiano } from '../../hooks/usePiano';
import { useMasterVolume } from '../../hooks/useMasterVolume';
import { useVoicingMode } from '../../hooks/useVoicingMode';
import { TempoModal } from '../../components/modals/TempoModal';
import { MetronomeModal } from '../../components/modals/MetronomeModal';
import { KeyTouchModal } from '../../components/modals/KeyTouchModal';
import { MetronomeIcon } from '../../components/icons/MetronomeIcon';
import { VoicingModeModal } from '../../components/modals/VoicingModeModal';
import { MasterVolumePanel } from '../../components/MasterVolumePanel';
import { VoicingModeButton } from './VoicingModeButton';

interface StatusBarProps {
  isLightMode: boolean;
  compact?: boolean;
}

const BEAT_LABELS = ['0/4', '2/4', '3/4', '4/4', '5/4', '6/4'];

export function StatusBar({ isLightMode, compact = false }: StatusBarProps) {
  const {
    tempo,
    metronomeOn,
    metronomeBeat,
    keyTouch,
    headphonesConnected,
    toggleMetronome,
  } = usePiano();
  const { output, engine } = useMasterVolume();
  const { mode, changeMode } = useVoicingMode();
  const engineVolumeHintId = useId();
  const [showMasterVolume, setShowMasterVolume] = useState(false);
  const [showTempo, setShowTempo] = useState(false);
  const [showMetronome, setShowMetronome] = useState(false);
  const [showKeyTouch, setShowKeyTouch] = useState(false);
  const [showMode, setShowMode] = useState(false);

  const beatLabel = BEAT_LABELS[metronomeBeat] ?? '4/4';
  const keyTouchText =
    keyTouch === undefined ? '—' : keyTouchShortLabel(keyTouch);
  const engineVolumeHint = engine.attenuated
    ? `Engine Volume ${engine.position}`
    : undefined;
  const keyTouchTitle =
    keyTouch === undefined
      ? 'Key touch'
      : `Key touch: ${keyTouchLabel(keyTouch)}`;

  return (
    <div data-statusbar className={`${compact ? 'px-3' : 'px-8'} pb-5 shrink-0`}>
      <div
        className={`w-full flex justify-between items-center border-t pt-3 transition-colors ${
          isLightMode ? 'border-zinc-300' : 'border-zinc-800/50'
        }`}>
        <div className={`flex items-center ${compact ? 'gap-3' : 'gap-6'}`}>
          <div className="flex items-center">
            <>
              <Music className="w-5 h-5 text-zinc-500" />
              <button
                type="button"
                onClick={() => setShowTempo(true)}
                className={`font-mono text-xl cursor-pointer hover:opacity-80 transition-opacity ${
                  isLightMode ? 'text-zinc-700' : 'text-zinc-300'
                }`}
                aria-label="Edit tempo">
                <span className="inline-block min-w-[3ch] text-right tabular-nums">
                  {tempo}
                </span>
              </button>
            </>
          </div>
          <button
            type="button"
            onClick={() => setShowMetronome(true)}
            className={`${compact ? 'tap-target ' : ''}font-mono text-xl cursor-pointer hover:opacity-80 transition-opacity ${
              isLightMode ? 'text-zinc-700' : 'text-zinc-300'
            }`}
            aria-label="Metronome settings">
            {beatLabel}
          </button>
          <button
            type="button"
            onClick={() => setShowKeyTouch(true)}
            title={keyTouchTitle}
            aria-label={keyTouchTitle}
            className={`${compact ? 'tap-target ' : ''}flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity`}>
            <Hand className="w-5 h-5 text-zinc-500" />
            {!compact && (
              <span
                className={`font-mono text-xl ${
                  isLightMode ? 'text-zinc-700' : 'text-zinc-300'
                }`}>
                {keyTouchText}
              </span>
            )}
          </button>
        </div>
        <div className={'pl-2'}>
          <VoicingModeButton
            mode={mode}
            isLightMode={isLightMode}
            onClick={() => setShowMode(true)}
            compact={compact}
          />
        </div>

        <button
          onClick={toggleMetronome}
          aria-label={metronomeOn ? 'Metronome on' : 'Metronome off'}
          className={`${compact ? 'tap-target ' : ''}flex items-center px-2 py-1 rounded-lg transition-colors ${
            isLightMode ? 'hover:bg-zinc-200' : 'hover:bg-zinc-800'
          }`}>
          <MetronomeIcon
            className={`w-5 h-5 ${metronomeOn ? 'text-cyan-500' : 'text-zinc-500'}`}
          />
        </button>

        <MasterVolumePanel
          open={showMasterVolume}
          onOpenChange={setShowMasterVolume}
          isLightMode={isLightMode}
          compact={compact}
          trigger={
            <button
              type="button"
              aria-label="Master Volume"
              title={engineVolumeHint}
              aria-describedby={engineVolumeHint ? engineVolumeHintId : undefined}
              className={`${compact ? 'tap-target ' : ''}flex items-center gap-2.5 pl-3 py-1.5 rounded-xl transition-colors ${
                isLightMode ? 'hover:bg-zinc-200' : 'hover:bg-zinc-800'
              }`}>
              <span className="relative inline-flex">
                {headphonesConnected === true ? (
                  <Headphones
                    className="w-5 h-5 text-zinc-500"
                    aria-label="Headphones connected"
                  />
                ) : (
                  <Volume2
                    className="w-5 h-5 text-zinc-500"
                    aria-label="Speakers"
                  />
                )}
                {engine.attenuated && (
                  <span
                    data-engine-attenuated
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 pointer-events-none"
                  />
                )}
              </span>
              {!compact && (
                <span
                  className={`font-mono text-xl inline-block min-w-[3ch] text-left tabular-nums ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  {output.position}
                </span>
              )}
            </button>
          }
        />
        {engineVolumeHint && (
          <span id={engineVolumeHintId} hidden>
            {engineVolumeHint}
          </span>
        )}
      </div>

      <TempoModal
        open={showTempo}
        onClose={() => setShowTempo(false)}
        isLightMode={isLightMode}
      />

      <MetronomeModal
        open={showMetronome}
        onClose={() => setShowMetronome(false)}
        isLightMode={isLightMode}
      />

      <KeyTouchModal
        open={showKeyTouch}
        onClose={() => setShowKeyTouch(false)}
        isLightMode={isLightMode}
      />

      <VoicingModeModal
        open={showMode}
        onClose={() => setShowMode(false)}
        isLightMode={isLightMode}
        currentMode={mode}
        onSelect={changeMode}
      />
    </div>
  );
}
