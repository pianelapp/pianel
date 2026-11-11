import * as Popover from '@radix-ui/react-popover';
import Pin from 'lucide-react/dist/esm/icons/pin';
import { useId, useRef, useState, type ReactElement } from 'react';
import { useMasterVolume } from '../hooks/useMasterVolume';
import { Fader, type FaderMarkSpec } from './controls/Fader';

type StripKind = 'engine' | 'output';

type PinState = Record<StripKind, boolean>;

interface MasterVolumePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLightMode: boolean;
  trigger: ReactElement;
}

export const MASTER_VOLUME_MARKS: ReadonlyArray<FaderMarkSpec> = [
  { value: 0, label: '0' },
  25,
  50,
  75,
  { value: 100, label: '100' },
];

export const MASTER_VOLUME_PANEL_PLACEMENT = {
  side: 'top',
  align: 'end',
  sideOffset: 8,
  collisionPadding: 16,
} as const;

export const MASTER_VOLUME_FADER_HEIGHT = '60vh';

const UNPINNED: PinState = { engine: false, output: false };

interface StripProps {
  kind: StripKind;
  shortName: string;
  fullName: string;
  unavailableNote?: string;
  value: number;
  onValueChange: (value: number) => void;
  disabled: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  isLightMode: boolean;
}

function Strip({
  kind,
  shortName,
  fullName,
  unavailableNote,
  value,
  onValueChange,
  disabled,
  pinned,
  onTogglePin,
  isLightMode,
}: StripProps) {
  const noteId = useId();
  const nameTone = isLightMode ? 'text-zinc-500' : 'text-zinc-400';
  const readoutTone = isLightMode ? 'text-zinc-800' : 'text-zinc-100';
  const pinTone = pinned
    ? 'text-cyan-500'
    : isLightMode
      ? 'text-zinc-400 hover:text-zinc-600'
      : 'text-zinc-500 hover:text-zinc-300';

  return (
    <div
      data-strip={kind}
      data-pinned={pinned ? '' : undefined}
      className="flex w-20 flex-col items-center gap-1">
      <button
        type="button"
        data-pin
        aria-label={`Pin ${fullName}`}
        aria-pressed={pinned}
        title={pinned ? `Unpin ${fullName}` : `Pin ${fullName}`}
        onClick={onTogglePin}
        className={`tap-target flex items-center justify-center rounded-lg p-1.5 transition-colors ${pinTone}`}>
        <Pin
          className={`h-4 w-4 transition-transform ${pinned ? 'fill-current' : 'rotate-45'}`}
          aria-hidden="true"
        />
      </button>
      <span
        data-strip-name
        title={fullName}
        className={`text-[10px] font-bold tracking-widest ${nameTone}`}>
        {shortName}
      </span>
      <Fader
        label={fullName}
        value={value}
        onValueChange={onValueChange}
        marks={MASTER_VOLUME_MARKS}
        height={MASTER_VOLUME_FADER_HEIGHT}
        disabled={disabled}
        isLightMode={isLightMode}
        describedById={unavailableNote ? noteId : undefined}
        className="mt-4 mb-3"
      />
      <span
        data-readout
        className={`translate-x-5 font-sans text-xl font-semibold leading-none tabular-nums ${readoutTone}${
          disabled ? ' opacity-40' : ''
        }`}>
        {value}
      </span>
      {unavailableNote && (
        <span id={noteId} data-unavailable className="sr-only">
          {unavailableNote}
        </span>
      )}
    </div>
  );
}

export function MasterVolumePanel({
  open,
  onOpenChange,
  isLightMode,
  trigger,
}: MasterVolumePanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pins, setPins] = useState<PinState>(UNPINNED);
  const pinsRef = useRef<PinState>(UNPINNED);
  const [collapsed, setCollapsed] = useState(false);
  const { output, engine, changeOutputVolume, changeEngineVolume } =
    useMasterVolume();

  const visible = (kind: StripKind) => !collapsed || pins[kind];

  const handleOpenChange = (next: boolean) => {
    if (!next && collapsed) {
      setCollapsed(false);
      return;
    }
    setCollapsed(false);
    onOpenChange(next);
  };

  const keepPinned = (event: Event) => {
    if (!pinsRef.current.engine && !pinsRef.current.output) return;
    event.preventDefault();
    setCollapsed(true);
  };

  const togglePin = (kind: StripKind) => {
    const next = { ...pinsRef.current, [kind]: !pinsRef.current[kind] };
    pinsRef.current = next;
    setPins(next);
    if (collapsed && !next.engine && !next.output) {
      setCollapsed(false);
      onOpenChange(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger ref={triggerRef} asChild>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={contentRef}
          role="dialog"
          aria-label="Master Volume"
          data-collapsed={collapsed ? '' : undefined}
          tabIndex={-1}
          {...MASTER_VOLUME_PANEL_PLACEMENT}
          onOpenAutoFocus={event => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onEscapeKeyDown={keepPinned}
          onInteractOutside={event => {
            const target = event.target as Node | null;
            if (target && triggerRef.current?.contains(target)) return;
            keepPinned(event);
          }}
          className={`z-50 flex gap-1 rounded-2xl border pl-1 pr-3 py-3 shadow-2xl backdrop-blur-sm outline-hidden ${
            isLightMode
              ? 'bg-white/40 border-zinc-200'
              : 'bg-zinc-900/40 border-zinc-800'
          }`}>
          {visible('engine') && (
            <Strip
              kind="engine"
              shortName="ENGINE"
              fullName="Engine Volume"
              unavailableNote={
                engine.available ? undefined : 'Not available on this piano'
              }
              value={engine.position}
              onValueChange={changeEngineVolume}
              disabled={!engine.available}
              pinned={pins.engine}
              onTogglePin={() => togglePin('engine')}
              isLightMode={isLightMode}
            />
          )}
          {visible('output') && (
            <Strip
              kind="output"
              shortName="OUTPUT"
              fullName="Output Volume"
              value={output.position}
              onValueChange={changeOutputVolume}
              disabled={false}
              pinned={pins.output}
              onTogglePin={() => togglePin('output')}
              isLightMode={isLightMode}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
