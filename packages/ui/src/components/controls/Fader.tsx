import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import type { Fader as FaderPrimitive } from '@audio-ui/react/fader';
import { Fader as RegistryFader } from '../audio-ui/fader';
import { cn } from '../../lib/utils';

export type FaderMarkSpec = number | { value: number; label: string };

export interface FaderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  onValueCommitted?: (value: number) => void;
  formatValueText?: (value: number) => string;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  marks?: ReadonlyArray<FaderMarkSpec>;
  height?: string;
  disabled?: boolean;
  isLightMode: boolean;
  describedById?: string;
  className?: string;
}

const INTEGER_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  useGrouping: false,
};

function toRange(raw: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(raw)));
}

export function Fader({
  label,
  value,
  onValueChange,
  onValueCommitted,
  formatValueText,
  min = 0,
  max = 100,
  step = 1,
  largeStep = 10,
  marks,
  height = '10rem',
  disabled = false,
  isLightMode,
  describedById,
  className,
}: FaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const current = toRange(value, min, max);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const guard = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if (!event.defaultPrevented) event.preventDefault();
    };
    node.addEventListener('wheel', guard, { passive: false });
    return () => node.removeEventListener('wheel', guard);
  }, []);

  const handleChange = useCallback(
    (next: number, details: FaderPrimitive.Root.ChangeEventDetails) => {
      if (details.reason === 'reset') {
        details.cancel();
        return;
      }
      const clamped = toRange(next, min, max);
      if (clamped === current) return;
      onValueChange(clamped);
    },
    [current, min, max, onValueChange],
  );

  const handleCommit = useCallback(
    (next: number, details: FaderPrimitive.Root.CommitEventDetails) => {
      if (details.reason === 'reset' || !onValueCommitted) return;
      onValueCommitted(toRange(next, min, max));
    },
    [min, max, onValueCommitted],
  );

  const style = { '--fader-min-height': height, height } as CSSProperties;

  return (
    <div
      ref={rootRef}
      data-disabled={disabled ? '' : undefined}
      className={cn('pianel-fader', !isLightMode && 'dark', 'inline-flex', className)}
      style={style}>
      <RegistryFader
        aria-label={label}
        aria-describedby={describedById}
        orientation="vertical"
        min={min}
        max={max}
        step={step}
        largeStep={largeStep}
        value={current}
        disabled={disabled}
        locale="en-US"
        format={INTEGER_FORMAT}
        marks={marks}
        thumbMarks={3}
        valueLabel="hidden"
        formatValue={formatValueText}
        onValueChange={handleChange}
        onValueCommitted={handleCommit}
      />
    </div>
  );
}
