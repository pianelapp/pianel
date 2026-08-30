export interface KeyTouchOption {
  value: number;
  label: string;
  short: string;
  description: string;
}

// DT1 01 00 02 1D, one byte: 0=Fix 1=Super Light 2=Light 3=Medium 4=Heavy 5=Super Heavy.
export const KEY_TOUCH_OPTIONS: readonly KeyTouchOption[] = [
  {
    value: 0,
    label: 'Fix',
    short: 'FIX',
    description: 'One velocity, however you play',
  },
  {
    value: 1,
    label: 'Super Light',
    short: 'S.LT',
    description: 'Loudest for the least effort',
  },
  {value: 2, label: 'Light', short: 'LT', description: 'Loud with a soft touch'},
  {value: 3, label: 'Medium', short: 'MED', description: 'Standard response'},
  {value: 4, label: 'Heavy', short: 'HVY', description: 'Play harder for loud'},
  {
    value: 5,
    label: 'Super Heavy',
    short: 'S.HV',
    description: 'The widest dynamic range',
  },
];

export const KEY_TOUCH_MIN = 0;
export const KEY_TOUCH_MAX = 5;
export const KEY_TOUCH_DEFAULT = 3;

export function clampKeyTouch(level: number): number {
  return Math.max(KEY_TOUCH_MIN, Math.min(KEY_TOUCH_MAX, Math.round(level)));
}

export function keyTouchOption(level: number): KeyTouchOption | undefined {
  return KEY_TOUCH_OPTIONS.find(option => option.value === level);
}

export function keyTouchLabel(level: number): string {
  return keyTouchOption(level)?.label ?? String(level);
}

export function keyTouchShortLabel(level: number): string {
  return keyTouchOption(level)?.short ?? String(level);
}
