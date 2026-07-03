import { useState, useEffect } from 'react';
import Music from 'lucide-react/dist/esm/icons/music';
import X from 'lucide-react/dist/esm/icons/x';

interface MIDIDeviceInfo {
  id: string;
  name: string;
}

interface MIDIDeviceChooserProps {
  isLightMode: boolean;
}

// ─── Module-level state ───────────────────────────────────────────────────────

let _resolve: ((id: string | null) => void) | null = null;
let _devices: MIDIDeviceInfo[] = [];
let _setOpen: ((v: boolean) => void) | null = null;
let _setDeviceList: ((d: MIDIDeviceInfo[]) => void) | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function requestMIDIDeviceSelection(
  devices: MIDIDeviceInfo[],
): Promise<string | null> {
  _devices = devices;
  return new Promise(resolve => {
    _resolve = resolve;
    _setDeviceList?.([...devices]);
    _setOpen?.(true);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MIDIDeviceChooser({ isLightMode }: MIDIDeviceChooserProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deviceList, setDeviceList] = useState<MIDIDeviceInfo[]>([]);

  useEffect(() => {
    _setOpen = setIsOpen;
    _setDeviceList = setDeviceList;
    return () => {
      _setOpen = null;
      _setDeviceList = null;
    };
  }, []);

  const handleSelect = (id: string) => {
    const resolve = _resolve;
    _resolve = null;
    _devices = [];
    setIsOpen(false);
    setDeviceList([]);
    resolve?.(id);
  };

  const handleCancel = () => {
    const resolve = _resolve;
    _resolve = null;
    _devices = [];
    setIsOpen(false);
    setDeviceList([]);
    resolve?.(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={`w-80 rounded-3xl p-6 shadow-2xl border transition-colors ${
          isLightMode
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Music
              className={`w-6 h-6 ${isLightMode ? 'text-cyan-600' : 'text-cyan-400'}`}
            />
            <h2
              className={`text-lg font-bold ${isLightMode ? 'text-zinc-800' : 'text-zinc-100'}`}
            >
              Select Piano
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 rounded-full hover:bg-zinc-500/20 transition-colors"
          >
            <X
              className={`w-5 h-5 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}
            />
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {deviceList.map(device => (
            <button
              key={device.id}
              onClick={() => handleSelect(device.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-colors border ${
                isLightMode
                  ? 'border-zinc-200 hover:bg-zinc-50 hover:border-cyan-300 text-zinc-800'
                  : 'border-zinc-800 hover:bg-zinc-800/60 hover:border-cyan-700 text-zinc-200'
              }`}
            >
              <div className="font-semibold text-base">
                {device.name || 'Unknown Device'}
              </div>
              <div
                className={`text-xs mt-0.5 font-mono ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`}
              >
                {device.id}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleCancel}
          className={`w-full text-sm font-bold tracking-widest py-2 rounded-lg transition-colors ${
            isLightMode
              ? 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}
