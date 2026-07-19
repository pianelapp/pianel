import { useRef, useState } from 'react';
import { useChord } from '../../hooks/useChord';
import { MARQUEE_MASK_IMAGE, useMarquee } from '../../hooks/useMarquee';
import { AccidentalQuickSwitch } from '../../components/modals/AccidentalQuickSwitch';

interface ChordDisplayProps {
  isLightMode: boolean;
}

// Press-and-hold threshold for the touch-web quick switch (Req 8.2).
const LONG_PRESS_MS = 500;

export function ChordDisplay({ isLightMode }: ChordDisplayProps) {
  const chord = useChord();
  const { trackRef, textRef, overflows, marqueeStyle } = useMarquee();

  // 009-settings-preferences (Task 6.2): local open state for the quick switch.
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setQuickSwitchOpen(true);
    }, LONG_PRESS_MS);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // Desktop right-click: suppress the native menu and open the quick switch.
    e.preventDefault();
    setQuickSwitchOpen(true);
  };

  const panelStyles = isLightMode
    ? 'bg-zinc-200/80 border-zinc-300 shadow-[inset_0_3px_10px_rgba(0,0,0,0.05)]'
    : 'bg-zinc-900/80 border-zinc-800/80 shadow-[inset_0_5px_25px_rgba(0,0,0,0.8)]';

  const displayName = chord.name || '—';

  return (
    <div
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerMove={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      className={`relative w-full max-w-[500px] min-w-0 min-h-[100px] border-2 rounded-2xl h-24 transition-colors ${panelStyles}`}>
      <span className="absolute top-3 left-0 right-0 text-center text-xs font-bold tracking-[0.2em] uppercase text-zinc-500 pointer-events-none">
        Real-Time Chord
      </span>

      <div
        ref={trackRef}
        className={`absolute inset-x-4 top-0 bottom-0 flex items-center overflow-hidden ${
          overflows ? 'justify-start' : 'justify-center'
        }`}
        style={{
          WebkitMaskImage: MARQUEE_MASK_IMAGE,
          maskImage: MARQUEE_MASK_IMAGE,
        }}>
        <span
          ref={textRef}
          style={marqueeStyle}
          className={`font-mono text-2xl leading-none font-bold tracking-widest whitespace-nowrap ${
            isLightMode
              ? 'text-cyan-700'
              : 'text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]'
          } ${overflows ? 'animate-marquee-x' : ''}`}>
          {displayName}
        </span>
      </div>

      {chord.noteCount > 0 && (
        <span
          className={`absolute bottom-2 left-0 right-0 text-center text-xs font-mono pointer-events-none ${
            isLightMode ? 'text-zinc-400' : 'text-zinc-500'
          }`}>
          {chord.noteCount} {chord.noteCount === 1 ? 'note' : 'notes'}
        </span>
      )}

      <AccidentalQuickSwitch
        isLightMode={isLightMode}
        open={quickSwitchOpen}
        onClose={() => setQuickSwitchOpen(false)}
      />
    </div>
  );
}
