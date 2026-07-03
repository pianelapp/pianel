import React, { useState } from 'react';
import Music from 'lucide-react/dist/esm/icons/music-2';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Volume2 from 'lucide-react/dist/esm/icons/volume-2';
import Headphones from 'lucide-react/dist/esm/icons/headphones';
import { usePiano } from '../../hooks/usePiano';
import { useVoicingMode } from '../../hooks/useVoicingMode';
import { TempoModal } from '../../components/modals/TempoModal';
import { MetronomeModal } from '../../components/modals/MetronomeModal';
import { VoicingModeModal } from '../../components/modals/VoicingModeModal';
import { VoicingModeButton } from './VoicingModeButton';

interface StatusBarProps {
  isLightMode: boolean;
}

const BEAT_LABELS = ['0/4', '2/4', '3/4', '4/4', '5/4', '6/4'];

export function StatusBar({ isLightMode }: StatusBarProps) {
  const { volume, tempo, metronomeOn, metronomeBeat, headphonesConnected, changeVolume, toggleMetronome } = usePiano();
  const { mode, changeMode } = useVoicingMode();
  const [showVolume, setShowVolume] = useState(false);
  const [showTempo, setShowTempo] = useState(false);
  const [showMetronome, setShowMetronome] = useState(false);
  const [showMode, setShowMode] = useState(false);

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = Math.round(Math.max(0, Math.min(100, 100 - (y / rect.height) * 100)));
    changeVolume(percentage);
  };

  const handleVolumeWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const step = Math.sign(e.deltaY);
    if (step === 0) return;
    const next = Math.max(0, Math.min(100, volume + step));
    if (next !== volume) changeVolume(next);
  };

  const beatLabel = BEAT_LABELS[metronomeBeat] ?? '4/4';

  return (
    <div className="px-8 pb-5 shrink-0">
      <div
        className={`w-full flex justify-between items-center border-t pt-3 transition-colors ${
          isLightMode ? 'border-zinc-300' : 'border-zinc-800/50'
        }`}
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-zinc-500" />
            <button
              type="button"
              onClick={() => setShowTempo(true)}
              className={`font-mono text-xl cursor-pointer hover:opacity-80 transition-opacity ${
                isLightMode ? 'text-zinc-700' : 'text-zinc-300'
              }`}
              aria-label="Edit tempo"
            >
              = <span className="inline-block min-w-[3ch] text-right tabular-nums">{tempo}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowMetronome(true)}
            className={`font-mono text-xl cursor-pointer hover:opacity-80 transition-opacity ${
              isLightMode ? 'text-zinc-700' : 'text-zinc-300'
            }`}
            aria-label="Metronome settings"
          >
            {beatLabel}
          </button>
          <VoicingModeButton
            mode={mode}
            isLightMode={isLightMode}
            onClick={() => setShowMode(true)}
          />
        </div>

        <button
          onClick={toggleMetronome}
          className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
            isLightMode ? 'hover:bg-zinc-200' : 'hover:bg-zinc-800'
          }`}
        >
          <Clock className={`w-5 h-5 ${metronomeOn ? 'text-cyan-500' : 'text-zinc-500'}`} />
          <span className={`font-mono text-xl uppercase tracking-widest ${metronomeOn ? (isLightMode ? 'text-cyan-700' : 'text-cyan-400') : 'text-zinc-500'}`}>
            {metronomeOn ? 'On' : 'Off'}
          </span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-colors ${
              isLightMode ? 'hover:bg-zinc-200' : 'hover:bg-zinc-800'
            }`}
          >
            {headphonesConnected === true ? (
              <Headphones className="w-5 h-5 text-zinc-500" aria-label="Headphones connected" />
            ) : (
              <Volume2 className="w-5 h-5 text-zinc-500" aria-label="Speakers" />
            )}
            <span className={`font-mono text-xl inline-block min-w-[3ch] text-left tabular-nums ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
              {volume}
            </span>
          </button>

          {showVolume && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowVolume(false)}
            >
              <div
                className={`absolute bottom-12 right-6 w-28 py-6 rounded-[2rem] flex flex-col items-center shadow-2xl border transition-colors z-50 ${
                  isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }`}
                onClick={(e) => e.stopPropagation()}
                onWheel={handleVolumeWheel}
              >
                <div className={`text-4xl font-light tracking-tighter ${isLightMode ? 'text-zinc-800' : 'text-zinc-100'}`}>
                  {volume}%
                </div>
                <div className={`text-xs font-bold tracking-widest mt-1 mb-5 ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  VOL
                </div>
                <div className={`text-xs font-bold mb-2 ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  100%
                </div>
                <div
                  className={`w-10 h-44 rounded-full relative overflow-hidden cursor-pointer shadow-[inset_0_3px_10px_rgba(0,0,0,0.15)] ${
                    isLightMode ? 'bg-zinc-100 border border-zinc-200' : 'bg-zinc-950 border border-zinc-800'
                  }`}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    handleVolumeChange(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 1) handleVolumeChange(e);
                  }}
                >
                  <div
                    className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-75 ${
                      isLightMode ? 'bg-[#519B9F]' : 'bg-cyan-600'
                    }`}
                    style={{ height: `${volume}%` }}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-[3px] ${isLightMode ? 'bg-zinc-800' : 'bg-cyan-200/80'}`} />
                  </div>
                </div>
                <div className={`text-xs font-bold mt-2 mb-6 ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  0%
                </div>
                <button
                  onClick={() => setShowVolume(false)}
                  className={`text-sm font-bold tracking-widest px-3 py-1.5 rounded-lg ${
                    isLightMode
                      ? 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  CLOSE
                </button>
              </div>
            </div>
          )}
        </div>
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
