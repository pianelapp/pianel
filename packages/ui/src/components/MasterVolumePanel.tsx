import * as Popover from '@radix-ui/react-popover';
import { useId, useRef, type ReactElement } from 'react';
import { useMasterVolume } from '../hooks/useMasterVolume';
import { Fader, type FaderMarkSpec } from './controls/Fader';

interface MasterVolumePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLightMode: boolean;
  compact: boolean;
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

const REGULAR_FADER_HEIGHT = '10rem';
const COMPACT_FADER_HEIGHT = '8rem';

interface StripProps {
  kind: 'engine' | 'output';
  shortName: string;
  fullName: string;
  caption: string;
  value: number;
  onValueChange: (value: number) => void;
  disabled: boolean;
  isLightMode: boolean;
  height: string;
}

function Strip({
  kind,
  shortName,
  fullName,
  caption,
  value,
  onValueChange,
  disabled,
  isLightMode,
  height,
}: StripProps) {
  const captionId = useId();
  const nameTone = isLightMode ? 'text-zinc-500' : 'text-zinc-400';
  const readoutTone = isLightMode ? 'text-zinc-800' : 'text-zinc-100';
  const captionTone = isLightMode ? 'text-zinc-400' : 'text-zinc-500';

  return (
    <div data-strip={kind} className="flex w-28 flex-col items-center gap-1">
      <span
        data-strip-name
        title={fullName}
        className={`text-[10px] font-bold tracking-widest ${nameTone}`}>
        {shortName}
      </span>
      <span
        data-readout
        className={`font-mono text-2xl leading-none tabular-nums ${readoutTone}${
          disabled ? ' opacity-40' : ''
        }`}>
        {value}
      </span>
      <Fader
        label={fullName}
        value={value}
        onValueChange={onValueChange}
        marks={MASTER_VOLUME_MARKS}
        height={height}
        disabled={disabled}
        isLightMode={isLightMode}
        describedById={captionId}
        className="mt-2 mb-1"
      />
      <span
        id={captionId}
        data-caption
        className={`text-center text-[10px] leading-tight ${captionTone}`}>
        {caption}
      </span>
    </div>
  );
}

export function MasterVolumePanel({
  open,
  onOpenChange,
  isLightMode,
  compact,
  trigger,
}: MasterVolumePanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { output, engine, changeOutputVolume, changeEngineVolume } =
    useMasterVolume();
  const height = compact ? COMPACT_FADER_HEIGHT : REGULAR_FADER_HEIGHT;

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={contentRef}
          role="dialog"
          aria-label="Master Volume"
          tabIndex={-1}
          {...MASTER_VOLUME_PANEL_PLACEMENT}
          onOpenAutoFocus={event => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          className={`z-50 flex gap-4 rounded-2xl border p-4 shadow-2xl outline-hidden ${
            isLightMode
              ? 'bg-white border-zinc-200'
              : 'bg-zinc-900 border-zinc-800'
          }`}>
          <Strip
            kind="engine"
            shortName="ENGINE"
            fullName="Engine Volume"
            caption={
              engine.available
                ? 'Piano sound + USB recording'
                : 'Not available on this piano'
            }
            value={engine.position}
            onValueChange={changeEngineVolume}
            disabled={!engine.available}
            isLightMode={isLightMode}
            height={height}
          />
          <Strip
            kind="output"
            shortName="OUTPUT"
            fullName="Output Volume"
            caption="Speakers & phones, incl. USB/BT in"
            value={output.position}
            onValueChange={changeOutputVolume}
            disabled={false}
            isLightMode={isLightMode}
            height={height}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
